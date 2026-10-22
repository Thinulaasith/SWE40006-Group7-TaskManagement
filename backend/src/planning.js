import { Router } from 'express';
import { route } from './auth.js';
import { HttpError, parseTask, textInput, validateId } from './validation.js';
import { taskAccess, projectWrite, lockWorkspace } from './access.js';
import { transaction } from './security.js';
import { audit } from './activity.js';

// Serialize graph changes in this database schema, including task moves/deletes.
export const lockPlanning = lockWorkspace;
export async function validateSchedule(db,task) {
  const asDate=value=>value instanceof Date?value.toISOString().slice(0,10):value;
  if(task.start_date && task.due_date && asDate(task.start_date)>asDate(task.due_date))throw new HttpError(400,'Start date must be on or before the due date.');
  if(task.status==='done' && task.id){
    const {rowCount}=await db.query("SELECT 1 FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on_id WHERE d.task_id=$1 AND t.status<>'done'",[task.id]);
    if(rowCount)throw new HttpError(409,'Complete the prerequisite tasks before completing this task.');
  }
}
export function planningRoutes(db){
  const router=Router();
  router.post('/tasks/:id/dependencies',route(async(req,res)=>{
    validateId(req.body.depends_on_id);
    await transaction(db,async client=>{
      await lockPlanning(client);
      const task=await taskAccess(client,req.params.id,req.user.id,true);
      const predecessor=await taskAccess(client,req.body.depends_on_id,req.user.id);
      if(task.id===predecessor.id || !task.project_id || task.project_id!==predecessor.project_id)throw new HttpError(400,'Dependencies must link different tasks in the same project.');
      const {rowCount}=await client.query(`WITH RECURSIVE chain(id) AS (SELECT $1::bigint UNION SELECT d.depends_on_id FROM task_dependencies d JOIN chain c ON c.id=d.task_id) SELECT 1 FROM chain WHERE id=$2`,[predecessor.id,task.id]);
      if(rowCount)throw new HttpError(409,'This dependency would create a cycle.');
      if(task.status==='done' && predecessor.status!=='done')throw new HttpError(409,'A completed task cannot depend on unfinished work.');
      await client.query('INSERT INTO task_dependencies (task_id,depends_on_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[task.id,predecessor.id]);
      await audit(client,req.user.id,'dependency.added',`Depends on: ${predecessor.title}`,task);
    });res.status(201).json({message:'Dependency added.'});
  }));
  router.delete('/tasks/:id/dependencies/:dependencyId',route(async(req,res)=>{
    validateId(req.params.dependencyId);
    await transaction(db,async client=>{
      await lockPlanning(client);const task=await taskAccess(client,req.params.id,req.user.id,true);
      const {rowCount}=await client.query('DELETE FROM task_dependencies WHERE task_id=$1 AND depends_on_id=$2',[task.id,req.params.dependencyId]);
      if(!rowCount)throw new HttpError(404,'Dependency not found.');
      await audit(client,req.user.id,'dependency.removed','Removed a prerequisite',task);
    });res.status(204).end();
  }));
  router.get('/milestones',route(async(req,res)=>{
    const values=[req.user.id];let filter='';
    if(req.query.project_id){validateId(req.query.project_id);values.push(req.query.project_id);filter='AND m.project_id=$2';}
    res.json((await db.query(`SELECT m.id::text,m.project_id::text,m.title,to_char(m.due_date,'YYYY-MM-DD') AS due_date,m.done,p.name AS project_name,pm.role<>'viewer' AS can_edit FROM milestones m JOIN projects p ON p.id=m.project_id JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=$1 ${filter} ORDER BY m.due_date,m.id`,values)).rows);
  }));
  const milestoneInput=body=>{
    const title=textInput(body.title,'Milestone title',150);const {due_date}=parseTask({due_date:body.due_date},true);
    if(!due_date || typeof (body.done??false)!=='boolean')throw new HttpError(400,'A milestone needs a date and valid completion state.');
    return [title,due_date,body.done??false];
  };
  router.post('/projects/:id/milestones',route(async(req,res)=>{
    const fields=milestoneInput(req.body);
    const row=await transaction(db,async client=>{
      await projectWrite(client,req.params.id,req.user.id);
      const {rows}=await client.query('INSERT INTO milestones (project_id,title,due_date,done) VALUES ($1,$2,$3,$4) RETURNING id::text',[req.params.id,...fields]);
      await audit(client,req.user.id,'milestone.created',fields[0],{project_id:req.params.id});return rows[0];
    });res.status(201).json(row);
  }));
  router.put('/milestones/:id',route(async(req,res)=>{
    validateId(req.params.id);const fields=milestoneInput(req.body);
    await transaction(db,async client=>{
      await lockPlanning(client);
      const {rows:[milestone]}=await client.query('SELECT * FROM milestones WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!milestone)throw new HttpError(404,'Milestone not found.');await projectWrite(client,milestone.project_id,req.user.id);
      await client.query('UPDATE milestones SET title=$1,due_date=$2,done=$3 WHERE id=$4',[...fields,milestone.id]);
      await audit(client,req.user.id,'milestone.updated',fields[0],{project_id:milestone.project_id});
    });res.json({message:'Milestone updated.'});
  }));
  router.delete('/milestones/:id',route(async(req,res)=>{
    validateId(req.params.id);await transaction(db,async client=>{
      await lockPlanning(client);
      const {rows:[milestone]}=await client.query('SELECT * FROM milestones WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!milestone)throw new HttpError(404,'Milestone not found.');await projectWrite(client,milestone.project_id,req.user.id);
      await client.query('DELETE FROM milestones WHERE id=$1',[milestone.id]);
      await audit(client,req.user.id,'milestone.deleted',milestone.title,{project_id:milestone.project_id});
    });res.status(204).end();
  }));return router;
}
