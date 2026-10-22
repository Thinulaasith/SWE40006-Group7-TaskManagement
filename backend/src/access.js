import { HttpError, validateId } from './validation.js';

export const accessSql = (alias = 't', user = '$1') => `((${alias}.project_id IS NULL AND ${alias}.owner_id=${user}) OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=${alias}.project_id AND pm.user_id=${user}))`;
export const taskColumns = `t.id::text,t.title,t.description,t.priority,t.status,to_char(t.due_date,'YYYY-MM-DD') AS due_date,to_char(t.start_date,'YYYY-MM-DD') AS start_date,t.completed_at,
  t.owner_id::text,t.project_id::text,t.assignee_id::text,t.created_at,t.updated_at,
  p.name AS project_name,u.name AS assignee_name,
  (SELECT COUNT(*)::integer FROM subtasks s WHERE s.task_id=t.id) AS subtask_count,
  (SELECT COUNT(*)::integer FROM subtasks s WHERE s.task_id=t.id AND s.done) AS subtask_done,
  (SELECT COUNT(*)::integer FROM comments c WHERE c.task_id=t.id) AS comment_count,
  (SELECT COUNT(*)::integer FROM attachments a WHERE a.task_id=t.id) AS attachment_count,
  COALESCE((SELECT json_agg(d.depends_on_id::text) FROM task_dependencies d WHERE d.task_id=t.id),'[]'::json) AS dependency_ids,
  NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=t.project_id AND pm.user_id=$1 AND pm.role='viewer') AS can_edit`;
export const taskJoins = 'LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assignee_id';
export async function taskAccess(db, taskId, userId, lock = false) {
  validateId(taskId);
  if(lock)await lockWorkspace(db);
  const { rows } = await db.query(`SELECT t.*,to_char(t.start_date,'YYYY-MM-DD') AS start_date,to_char(t.due_date,'YYYY-MM-DD') AS due_date FROM tasks t WHERE t.id=$2 AND ${accessSql()} ${lock ? 'FOR UPDATE OF t' : ''}`, [userId, taskId]);
  if (!rows.length) throw new HttpError(404, 'Task not found.');
  if (lock && rows[0].project_id) await projectWrite(db, rows[0].project_id, userId);
  return rows[0];
}
export async function projectAccess(db, projectId, userId, owner = false) {
  validateId(projectId);
  if(owner)await lockWorkspace(db);
  const { rows } = await db.query(`SELECT p.*,pm.role FROM projects p JOIN project_members pm ON pm.project_id=p.id WHERE p.id=$1 AND pm.user_id=$2`, [projectId, userId]);
  if (!rows.length) throw new HttpError(404, 'Project not found.');
  if (owner && rows[0].role !== 'owner') throw new HttpError(403, 'Only the project owner can manage this project.');
  return rows[0];
}
export async function checkAssignment(db, projectId, assigneeId, userId) {
  if (projectId) await projectWrite(db, projectId, userId);
  if (!assigneeId) return;
  if (!projectId) {
    if (String(assigneeId) !== String(userId)) throw new HttpError(400, 'Personal tasks can only be assigned to yourself.');
  } else {
    const { rowCount } = await db.query("SELECT 1 FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE project_id=$1 AND user_id=$2 AND pm.role<>'viewer' AND NOT u.disabled", [projectId, assigneeId]);
    if (!rowCount) throw new HttpError(400, 'Choose an assignee who belongs to this project.');
  }
}
export async function projectWrite(db, projectId, userId) {
  await lockWorkspace(db);
  const project = await projectAccess(db, projectId, userId);
  if (project.role === 'viewer') throw new HttpError(403, 'Viewers have read-only access to this project.');
  return project;
}
export async function taskResult(db, id, userId) {
  const { rows } = await db.query(`SELECT ${taskColumns} FROM tasks t ${taskJoins} WHERE t.id=$2 AND ${accessSql()}`, [userId, id]);
  if (!rows.length) throw new HttpError(404, 'Task not found.');
  return rows[0];
}
export async function notify(db, userId, taskId, message, key = null) {
  if (!userId) return;
  await db.query(`INSERT INTO notifications (user_id,task_id,message,event_key)
    SELECT id,$2,$3,$4 FROM users WHERE id=$1 AND notifications_enabled ON CONFLICT (user_id,event_key) DO NOTHING`, [userId, taskId, message, key]);
}

export const lockWorkspace = db => db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':taskflow-planning'))");
