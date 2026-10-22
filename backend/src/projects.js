import { Router } from 'express';
import { route } from './auth.js';
import { HttpError, textInput, emailInput, validateId } from './validation.js';
import { transaction } from './security.js';
import { projectAccess } from './access.js';
import { audit } from './activity.js';

function projectInput(body) {
  const name = textInput(body.name, 'Project name', 100);
  const description = textInput(body.description, 'Description', 2000, true);
  const color = body.color ?? '#6256ec';
  if (typeof color !== 'string' || !/^#[a-f0-9]{6}$/i.test(color)) throw new HttpError(400, 'Invalid project color.');
  return [name, description, color];
}
export function projectRoutes(db) {
  const router = Router();
  router.get('/', route(async (req, res) => {
    const { rows } = await db.query(`SELECT p.id::text,p.name,p.description,p.color,p.owner_id::text,p.created_at,pm.role,
      (SELECT COUNT(*)::integer FROM tasks t WHERE t.project_id=p.id) AS task_count,
      (SELECT COUNT(*)::integer FROM project_members m WHERE m.project_id=p.id) AS member_count
      FROM projects p JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=$1 ORDER BY p.created_at DESC,p.id DESC`, [req.user.id]);
    res.json(rows);
  }));
  router.post('/', route(async (req, res) => {
    const values = projectInput(req.body);
    const project = await transaction(db, async client => {
      const { rows } = await client.query('INSERT INTO projects (name,description,color,owner_id) VALUES ($1,$2,$3,$4) RETURNING id::text,name,description,color,owner_id::text,created_at', [...values, req.user.id]);
      await client.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')", [rows[0].id, req.user.id]);
      await audit(client,req.user.id,'project.created',values[0],{project_id:rows[0].id,owner_id:req.user.id});
      return { ...rows[0], role: 'owner', task_count: 0, member_count: 1 };
    });
    res.status(201).json(project);
  }));
  router.put('/:id', route(async (req, res) => {
    const project=await transaction(db,async client=>{
      await projectAccess(client,req.params.id,req.user.id,true);
      const {rows}=await client.query('UPDATE projects SET name=$1,description=$2,color=$3 WHERE id=$4 RETURNING id::text,name,description,color,owner_id::text',[...projectInput(req.body),req.params.id]);
      if(!rows.length)throw new HttpError(404,'Project not found.');
      await audit(client,req.user.id,'project.updated',rows[0].name,{project_id:req.params.id,owner_id:req.user.id});return rows[0];
    });res.json(project);
  }));
  router.delete('/:id', route(async (req, res) => {
    await transaction(db,async client=>{
      const project=await projectAccess(client,req.params.id,req.user.id,true);
      await audit(client,req.user.id,'project.deleted',project.name,{project_id:project.id,owner_id:req.user.id});
      await client.query('DELETE FROM projects WHERE id=$1',[req.params.id]);
    });
    res.status(204).end();
  }));
  router.get('/:id/members', route(async (req, res) => {
    await projectAccess(db, req.params.id, req.user.id);
    const { rows } = await db.query('SELECT u.id::text,u.name,u.email,u.disabled,pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 ORDER BY pm.role DESC,u.name', [req.params.id]);
    res.json(rows);
  }));
  router.post('/:id/members', route(async (req, res) => {
    const email = emailInput(req.body.email);
    const role=req.body.role??'member';if(!['member','viewer'].includes(role))throw new HttpError(400,'Choose member or viewer.');
    const member=await transaction(db,async client=>{
      await projectAccess(client,req.params.id,req.user.id,true);
      const {rows}=await client.query('SELECT id::text,name,email FROM users WHERE email=$1 AND NOT disabled',[email]);
      if(!rows.length)throw new HttpError(404,'No active account has that email. Ask your teammate to register first.');
      const {rowCount}=await client.query('INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[req.params.id,rows[0].id,role]);
      if(!rowCount)throw new HttpError(409,'This person is already a member.');
      await audit(client,req.user.id,'member.added',`${rows[0].name}: ${role}`,{project_id:req.params.id});return {...rows[0],role};
    });res.status(201).json(member);
  }));
  router.patch('/:id/members/:userId',route(async(req,res)=>{
    validateId(req.params.userId);const role=req.body.role;
    if(!['member','viewer'].includes(role))throw new HttpError(400,'Choose member or viewer.');
    await transaction(db,async client=>{
      await projectAccess(client,req.params.id,req.user.id,true);
      const {rows:[member]}=await client.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2 FOR UPDATE',[req.params.id,req.params.userId]);
      if(!member)throw new HttpError(404,'Member not found.');if(member.role==='owner')throw new HttpError(400,'The project owner role cannot be changed.');
      await client.query('UPDATE project_members SET role=$1 WHERE project_id=$2 AND user_id=$3',[role,req.params.id,req.params.userId]);
      if(role==='viewer')await client.query('UPDATE tasks SET assignee_id=NULL,updated_at=NOW() WHERE project_id=$1 AND assignee_id=$2',[req.params.id,req.params.userId]);
      await audit(client,req.user.id,'member.role_changed',`Member #${req.params.userId}: ${role}`,{project_id:req.params.id});
    });res.json({message:'Role updated.'});
  }));
  router.delete('/:id/members/:userId', route(async (req, res) => {
    validateId(req.params.userId);
    await transaction(db, async client => {
      await projectAccess(client, req.params.id, req.user.id, true);
      const { rows } = await client.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2 FOR UPDATE', [req.params.id, req.params.userId]);
      if (!rows.length) throw new HttpError(404, 'Member not found.');
      if (rows[0].role === 'owner') throw new HttpError(400, 'The project owner cannot be removed.');
      await client.query('UPDATE tasks SET assignee_id=NULL,updated_at=NOW() WHERE project_id=$1 AND assignee_id=$2', [req.params.id, req.params.userId]);
      await client.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
      await audit(client,req.user.id,'member.removed',`Removed member #${req.params.userId}`,{project_id:req.params.id});
    });
    res.status(204).end();
  }));
  return router;
}
