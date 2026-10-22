import { Router } from 'express';
import { route } from './auth.js';
import { HttpError, parseTask, parseFilters, validateId, textInput } from './validation.js';
import { transaction } from './security.js';
import { accessSql, taskColumns, taskJoins, taskAccess, taskResult, checkAssignment, notify } from './access.js';
import { lockPlanning, validateSchedule } from './planning.js';
import { audit } from './activity.js';

export function taskRoutes(db) {
  const router = Router();
  router.get('/stats', route(async (req, res) => {
    const { rows } = await db.query(`SELECT COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE status='todo')::integer AS todo,
      COUNT(*) FILTER (WHERE status='in_progress')::integer AS in_progress,
      COUNT(*) FILTER (WHERE status='done')::integer AS done FROM tasks t WHERE ${accessSql()}`, [req.user.id]);
    res.json(rows[0]);
  }));
  router.get('/', route(async (req, res) => {
    const { status, priority, q, limit, offset } = parseFilters(req.query);
    const conditions = [accessSql()]; const params = [req.user.id];
    for (const [field, value] of Object.entries({ status, priority })) {
      if (value && value !== 'all') { params.push(value); conditions.push(`t.${field}=$${params.length}`); }
    }
    if (req.query.project_id === 'personal') conditions.push('t.project_id IS NULL');
    else if (req.query.project_id !== undefined) { validateId(req.query.project_id); params.push(req.query.project_id); conditions.push(`t.project_id=$${params.length}`); }
    if (req.query.assignee_id !== undefined) { validateId(req.query.assignee_id); params.push(req.query.assignee_id); conditions.push(`t.assignee_id=$${params.length}`); }
    if (q) { params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); conditions.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`); }
    let sql = `SELECT ${taskColumns} FROM tasks t ${taskJoins} WHERE ${conditions.join(' AND ')} ORDER BY t.created_at DESC,t.id DESC`;
    if (limit !== undefined) { params.push(limit); sql += ` LIMIT $${params.length}`; }
    if (offset !== undefined) { params.push(offset); sql += ` OFFSET $${params.length}`; }
    res.json((await db.query(sql, params)).rows);
  }));
  router.post('/', route(async (req, res) => {
    const task = parseTask(req.body);
    const id = await transaction(db, async client => {
      await checkAssignment(client, task.project_id, task.assignee_id, req.user.id);
      const { rows } = await client.query(`INSERT INTO tasks (title,description,priority,status,due_date,project_id,assignee_id,start_date,owner_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text`, [...Object.values(task), req.user.id]);
      await audit(client,req.user.id,'task.created',task.title,{...task,id:rows[0].id,owner_id:req.user.id});
      if (task.assignee_id !== req.user.id) await notify(client, task.assignee_id, rows[0].id, `${req.user.name} assigned you: ${task.title}`);
      return rows[0].id;
    });
    res.location(`/api/tasks/${id}`).status(201).json(await taskResult(db, id, req.user.id));
  }));
  router.get('/:id', route(async (req, res) => {
    validateId(req.params.id); res.json(await taskResult(db, req.params.id, req.user.id));
  }));
  const update = partial => route(async (req, res) => {
    const task = parseTask(req.body, partial);
    await transaction(db, async client => {
      await lockPlanning(client);
      const old = await taskAccess(client, req.params.id, req.user.id, true);
      const merged = { ...old, ...task };
      if (Object.hasOwn(task, 'project_id') && String(task.project_id) !== String(old.project_id) && old.owner_id !== req.user.id) throw new HttpError(403, 'Only the task creator can move it to another project.');
      await checkAssignment(client, merged.project_id, merged.assignee_id, req.user.id);
      await validateSchedule(client,merged);
      if(merged.project_id!==old.project_id){
        const {rowCount}=await client.query('SELECT 1 FROM task_dependencies WHERE task_id=$1 OR depends_on_id=$1',[old.id]);
        if(rowCount)throw new HttpError(409,'Remove dependency links before moving this task to another project.');
      }
      if(old.status==='done' && merged.status!=='done'){
        const {rowCount}=await client.query("SELECT 1 FROM task_dependencies d JOIN tasks t ON t.id=d.task_id WHERE d.depends_on_id=$1 AND t.status='done'",[old.id]);
        if(rowCount)throw new HttpError(409,'Reopen completed dependent tasks first.');
      }
      const values = Object.values(task);
      const assignments = Object.keys(task).map((field, i) => `${field}=$${i + 1}`);
      values.push(req.params.id);
      await client.query(`UPDATE tasks SET ${assignments.join(',')},updated_at=NOW() WHERE id=$${values.length}`, values);
      await audit(client,req.user.id,old.status!==merged.status?'task.status_changed':'task.updated',`${merged.title}${old.status!==merged.status?' → '+merged.status:''}`,merged);
      if (merged.assignee_id && merged.assignee_id !== old.assignee_id && merged.assignee_id !== req.user.id) await notify(client, merged.assignee_id, req.params.id, `${req.user.name} assigned you: ${merged.title}`);
    });
    res.json(await taskResult(db, req.params.id, req.user.id));
  });
  router.put('/:id', update(false));
  router.patch('/:id', update(true));
  router.delete('/:id', route(async (req, res) => {
    await transaction(db, async client => { await lockPlanning(client);const task=await taskAccess(client, req.params.id, req.user.id, true); await audit(client,req.user.id,'task.deleted',task.title,task);await client.query('DELETE FROM tasks WHERE id=$1', [req.params.id]); });
    res.status(204).end();
  }));
  router.get('/:id/details', route(async (req, res) => {
    await taskAccess(db, req.params.id, req.user.id);
    const subtasks = await db.query('SELECT id::text,title,done,created_at FROM subtasks WHERE task_id=$1 ORDER BY created_at,id', [req.params.id]);
    const comments = await db.query('SELECT c.id::text,c.body,c.author_id::text,u.name AS author_name,c.created_at FROM comments c JOIN users u ON u.id=c.author_id WHERE c.task_id=$1 ORDER BY c.created_at,c.id', [req.params.id]);
    res.json({ subtasks: subtasks.rows, comments: comments.rows });
  }));
  router.post('/:id/subtasks', route(async (req, res) => {
    const title = textInput(req.body.title, 'Subtask title', 150);
    const result = await transaction(db, async client => {
      const task=await taskAccess(client, req.params.id, req.user.id, true);
      await audit(client,req.user.id,'subtask.created',title,task);
      return (await client.query('INSERT INTO subtasks (task_id,title) VALUES ($1,$2) RETURNING id::text,title,done,created_at', [req.params.id, title])).rows[0];
    });
    res.status(201).json(result);
  }));
  router.patch('/:id/subtasks/:subId', route(async (req, res) => {
    validateId(req.params.subId);
    if (typeof req.body.done !== 'boolean') throw new HttpError(400, 'done must be true or false.');
    const result = await transaction(db, async client => {
      const task=await taskAccess(client, req.params.id, req.user.id, true);
      const { rows } = await client.query('UPDATE subtasks SET done=$1 WHERE task_id=$2 AND id=$3 RETURNING id::text,title,done,created_at', [req.body.done, req.params.id, req.params.subId]);
      if (!rows.length) throw new HttpError(404, 'Subtask not found.');
      await audit(client,req.user.id,'subtask.updated',rows[0].title+': '+(rows[0].done?'completed':'reopened'),task);
      return rows[0];
    });
    res.json(result);
  }));
  router.delete('/:id/subtasks/:subId', route(async (req, res) => {
    validateId(req.params.subId);
    await transaction(db, async client => {
      const task=await taskAccess(client, req.params.id, req.user.id, true);
      const { rowCount } = await client.query('DELETE FROM subtasks WHERE task_id=$1 AND id=$2', [req.params.id, req.params.subId]);
      if (!rowCount) throw new HttpError(404, 'Subtask not found.');
      await audit(client,req.user.id,'subtask.deleted','Subtask removed from '+task.title,task);
    });
    res.status(204).end();
  }));
  router.post('/:id/comments', route(async (req, res) => {
    const body = textInput(req.body.body, 'Comment', 2000);
    const result = await transaction(db, async client => {
      const task = await taskAccess(client, req.params.id, req.user.id, true);
      await audit(client,req.user.id,'comment.created',`Comment on ${task.title}`,task);
      const { rows } = await client.query('INSERT INTO comments (task_id,author_id,body) VALUES ($1,$2,$3) RETURNING id::text,body,author_id::text,created_at', [req.params.id, req.user.id, body]);
      for (const id of new Set([task.owner_id, task.assignee_id].filter(id => id && id !== req.user.id))) {
        await notify(client, id, req.params.id, `${req.user.name} commented on: ${task.title}`);
      }
      return { ...rows[0], author_name: req.user.name };
    });
    res.status(201).json(result);
  }));
  router.delete('/:id/comments/:commentId', route(async (req, res) => {
    validateId(req.params.commentId);
    await transaction(db, async client => {
      const task=await taskAccess(client, req.params.id, req.user.id, true);
      const { rowCount } = await client.query('DELETE FROM comments WHERE task_id=$1 AND id=$2 AND author_id=$3', [req.params.id, req.params.commentId, req.user.id]);
      if (!rowCount) throw new HttpError(404, 'Comment not found or not owned by you.');
      await audit(client,req.user.id,'comment.deleted','Comment removed from '+task.title,task);
    });
    res.status(204).end();
  }));
  return router;
}
