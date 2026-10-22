import { Router } from 'express';
import { route } from './auth.js';
import { HttpError, validateId, parseFilters } from './validation.js';
import { transaction } from './security.js';
import { audit } from './activity.js';

export function administrationRoutes(db) {
  const router=Router();
  router.get('/activity',route(async(req,res)=>{
    const {limit=50,offset=0}=parseFilters(req.query);const values=[req.user.id];
    let filter='';
    if(req.query.project_id){validateId(req.query.project_id);values.push(req.query.project_id);filter=`AND a.project_id=$${values.length}`;}
    values.push(limit,offset);
    res.json((await db.query(`SELECT a.id::text,a.action,a.detail,a.created_at,a.task_id::text,a.project_id::text,u.name AS actor_name,p.name AS project_name
      FROM activity a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN projects p ON p.id=a.project_id
      WHERE NOT a.admin_only AND (((a.project_id IS NULL OR p.id IS NULL) AND a.owner_id=$1) OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=a.project_id AND pm.user_id=$1)) ${filter}
      ORDER BY a.id DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows);
  }));
  router.use('/admin', (req,_res,next)=>req.user.role==='admin'?next():next(new HttpError(403,'Administrator access is required.')));
  router.get('/admin/users',route(async(req,res)=>{
    const {q='',limit=50,offset=0}=parseFilters(req.query);
    const search=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
    res.json((await db.query('SELECT id::text,name,email,role,disabled,created_at FROM users WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3',[search,limit,offset])).rows);
  }));
  router.patch('/admin/users/:id',route(async(req,res)=>{
    validateId(req.params.id);
    if(!Object.hasOwn(req.body,'role')&&!Object.hasOwn(req.body,'disabled'))throw new HttpError(400,'Provide role or disabled.');
    const user=await transaction(db,async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':taskflow-admin'))");
      // Recheck after obtaining the lock: another admin might have revoked this actor.
      const {rows:[actor]}=await client.query('SELECT role,disabled FROM users WHERE id=$1',[req.user.id]);
      if(actor?.role!=='admin'||actor.disabled)throw new HttpError(403,'Administrator access is required.');
      const {rows:[old]}=await client.query('SELECT id::text,name,email,role,disabled FROM users WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!old)throw new HttpError(404,'Account not found.');
      const role=req.body.role??old.role,disabled=req.body.disabled??old.disabled;
      if(!['user','admin'].includes(role)||typeof disabled!=='boolean')throw new HttpError(400,'Invalid role or account state.');
      if(old.id===req.user.id&&disabled)throw new HttpError(400,'You cannot disable your own account.');
      if(old.role==='admin'&&!old.disabled&&(role!=='admin'||disabled)){
        const {rows:[count]}=await client.query("SELECT COUNT(*)::int AS total FROM users WHERE role='admin' AND NOT disabled");
        if(count.total<=1)throw new HttpError(409,'Keep at least one active administrator.');
      }
      const {rows}=await client.query('UPDATE users SET role=$1,disabled=$2 WHERE id=$3 RETURNING id::text,name,email,role,disabled,created_at',[role,disabled,old.id]);
      if(role!==old.role||disabled!==old.disabled)await client.query('DELETE FROM sessions WHERE user_id=$1',[old.id]);
      await audit(client,req.user.id,'account.updated',`${old.email}: ${role}, ${disabled?'disabled':'active'}`,{},true);
      return rows[0];
    });res.json(user);
  }));
  router.get('/admin/activity',route(async(req,res)=>{
    const {limit=50,offset=0}=parseFilters(req.query);
    res.json((await db.query(`SELECT a.id::text,a.action,a.detail,a.created_at,u.name AS actor_name FROM activity a LEFT JOIN users u ON u.id=a.actor_id WHERE a.admin_only ORDER BY a.id DESC LIMIT $1 OFFSET $2`,[limit,offset])).rows);
  }));return router;
}
