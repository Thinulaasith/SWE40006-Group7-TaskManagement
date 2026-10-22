import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getConfig } from '../src/config.js';
import { startApi } from './helpers.js';

const password='test-only-long-password-2026';
test('authenticated PostgreSQL workflows and access isolation', async t => {
  const connectionString=getConfig().databaseUrl;
  const schemaName='taskflow_test_'+randomUUID().replaceAll('-','');
  const admin=new pg.Pool({connectionString,connectionTimeoutMillis:5000});
  let db;
  t.after(async()=>{
    if(db)await db.end();
    // Only the random schema created by this test may be removed.
    if(!/^taskflow_test_[a-f0-9]{32}$/.test(schemaName))throw new Error('Unsafe test schema');
    await admin.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);await admin.end();
  });
  await admin.query(`CREATE SCHEMA ${schemaName}`);
  db=new pg.Pool({connectionString,options:`-c search_path=${schemaName}`,connectionTimeoutMillis:5000});
  const schema=await readFile(new URL('../sql/schema.sql',import.meta.url),'utf8');
  await db.query(schema);await db.query(schema);
  const owner=await startApi(t,db,{metricsToken:'test-only-metrics'});
  const member=owner.newClient(), outsider=owner.newClient(), anonymous=owner.newClient();
  let ownerUser,memberUser,project,personal,shared;
  await t.test('register/login/session cookies and profile settings',async()=>{
    ownerUser=(await owner('/api/auth/register',{method:'POST',body:{name:'Owner',email:'owner@example.test',password},status:201})).user;
    assert.match(owner.lastResponse.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
    assert.ok(!JSON.stringify(ownerUser).includes('password'));
    memberUser=(await member('/api/auth/register',{method:'POST',body:{name:'Member',email:'member@example.test',password},status:201})).user;
    await outsider('/api/auth/register',{method:'POST',body:{name:'Outsider',email:'outsider@example.test',password},status:201});
    await anonymous('/api/auth/register',{method:'POST',body:{name:'Duplicate',email:'OWNER@example.test',password},status:409});
    await anonymous('/api/auth/login',{method:'POST',body:{email:'owner@example.test',password:'wrong'},status:401});
    await anonymous('/api/tasks',{status:401});
    const me=await owner('/api/auth/me');assert.equal(me.user.id,ownerUser.id);
    const profile=await owner('/api/auth/profile',{method:'PATCH',body:{name:'Owner Updated',bio:'Project lead',theme:'dark',notifications_enabled:true}});
    assert.equal(profile.theme,'dark');assert.equal(profile.bio,'Project lead');
    await owner('/api/auth/profile',{method:'PATCH',body:{theme:'unknown'},status:400});
    const stored=await db.query('SELECT password_hash FROM users WHERE id=$1',[ownerUser.id]);assert.match(stored.rows[0].password_hash,/^scrypt\$/);
  });
  await t.test('demo and application cookies remain independent on the same host',async t=>{
    const demo = await startApi(t, db, {cookieName:'taskflow_demo_session'});
    await demo('/api/auth/login',{method:'POST',body:{email:'owner@example.test',password}});
    const demoCookie = demo.lastResponse.headers.get('set-cookie').split(';')[0];
    assert.match(demoCookie,/^taskflow_demo_session=/);
    await owner('/api/auth/me',{headers:{Cookie:demoCookie},status:401});
    // Use the valid demo token under the normal name to verify name separation,
    // independently of token validity in the shared isolated database.
    await demo('/api/auth/me',{headers:{Cookie:demoCookie.replace('taskflow_demo_session=','taskflow_session=')},status:401});
    assert.equal((await demo('/api/auth/me')).user.id,ownerUser.id);
    await demo('/api/auth/logout',{method:'POST',status:204});
    assert.match(demo.lastResponse.headers.get('set-cookie'),/^taskflow_demo_session=;.*Max-Age=0/);
    assert.equal((await owner('/api/auth/me')).user.id,ownerUser.id);
  });
  await t.test('private task CRUD, search, validation and CSRF protection',async()=>{
    personal=await owner('/api/tasks',{method:'POST',body:{title:'Personal 100%_task',description:'Needle',priority:'high',due_date:'2028-02-29'},status:201});
    assert.equal(personal.owner_id,ownerUser.id);assert.equal(personal.project_id,null);
    assert.deepEqual((await owner('/api/tasks?q=%25_')).map(t=>t.id),[personal.id]);
    assert.equal((await owner('/api/tasks?q=needle')).length,1);
    assert.equal((await owner('/api/tasks?limit=1&offset=1')).length,0);
    await member(`/api/tasks/${personal.id}`,{status:404});
    await member(`/api/tasks/${personal.id}`,{method:'PATCH',body:{status:'done'},status:404});
    await member(`/api/tasks/${personal.id}`,{method:'DELETE',status:404});
    await owner('/api/tasks',{method:'POST',body:{title:'Bad',due_date:'0000-01-01'},status:400});
    await owner('/api/tasks/9223372036854775808',{method:'DELETE',status:400});
    await owner(`/api/tasks/${personal.id}`,{method:'PATCH',body:{status:'done'},headers:{'X-CSRF-Token':'wrong'},status:403});
    await owner(`/api/tasks/${personal.id}`,{method:'PATCH',body:{status:'done'},headers:{Origin:'https://evil.example'},status:403});
    assert.equal((await owner(`/api/tasks/${personal.id}`,{method:'PATCH',body:{status:'done'}})).status,'done');
    assert.equal((await owner('/api/tasks/stats')).done,1);
    assert.equal((await member('/api/tasks')).length,0);
  });
  await t.test('project membership, permissions and assignments',async()=>{
    project=await owner('/api/projects',{method:'POST',body:{name:'Team launch',description:'A shared project',color:'#6256ec'},status:201});
    assert.equal((await outsider('/api/projects')).length,0);
    await outsider(`/api/projects/${project.id}/members`,{status:404});
    await owner(`/api/projects/${project.id}/members`,{method:'POST',body:{email:'member@example.test'},status:201});
    assert.equal((await member('/api/projects')).length,1);
    await member(`/api/projects/${project.id}/members`,{method:'POST',body:{email:'outsider@example.test'},status:403});
    await member(`/api/projects/${project.id}`,{method:'DELETE',status:403});
    shared=await owner('/api/tasks',{method:'POST',body:{title:'Shared deadline',project_id:project.id,assignee_id:memberUser.id,due_date:'2026-10-19'},status:201});
    assert.equal(shared.assignee_name,'Member');
    assert.equal((await member('/api/tasks')).length,1);
    await outsider(`/api/tasks/${shared.id}`,{status:404});
    await outsider('/api/tasks',{method:'POST',body:{title:'Injected',project_id:project.id},status:404});
    await member(`/api/tasks/${shared.id}`,{method:'PATCH',body:{project_id:null},status:403});
    await owner(`/api/tasks/${personal.id}`,{method:'PATCH',body:{assignee_id:memberUser.id},status:400});
    assert.equal((await member(`/api/tasks/${shared.id}`,{method:'PATCH',body:{status:'in_progress'}})).status,'in_progress');
  });
  await t.test('subtasks and comments enforce parent-task and author permissions',async()=>{
    const sub=await member(`/api/tasks/${shared.id}/subtasks`,{method:'POST',body:{title:'Write tests'},status:201});
    await outsider(`/api/tasks/${shared.id}/subtasks`,{method:'POST',body:{title:'Intrusion'},status:404});
    const checked=await owner(`/api/tasks/${shared.id}/subtasks/${sub.id}`,{method:'PATCH',body:{done:true}});assert.equal(checked.done,true);
    const comment=await member(`/api/tasks/${shared.id}/comments`,{method:'POST',body:{body:'Ready for review'},status:201});
    const details=await owner(`/api/tasks/${shared.id}/details`);assert.equal(details.comments[0].body,'Ready for review');assert.equal(details.subtasks[0].done,true);
    await outsider(`/api/tasks/${shared.id}/details`,{status:404});
    await owner(`/api/tasks/${shared.id}/comments/${comment.id}`,{method:'DELETE',status:404});
    await member(`/api/tasks/${shared.id}/comments/${comment.id}`,{method:'DELETE',status:204});
    await owner(`/api/tasks/${shared.id}/subtasks/${sub.id}`,{method:'DELETE',status:204});
  });
  await t.test('notifications are persistent, deduplicated and scoped to the recipient',async()=>{
    await member('/api/notifications/sync',{method:'POST',body:{date:'2026-10-19'},status:204});
    const notes=await member('/api/notifications');assert.ok(notes.some(n=>n.message.startsWith('Due soon:')));assert.ok(notes.some(n=>n.message.includes('assigned you')));
    await member('/api/notifications/sync',{method:'POST',body:{date:'2026-10-19'},status:204});assert.equal((await member('/api/notifications')).length,notes.length);
    await outsider(`/api/notifications/${notes[0].id}`,{method:'PATCH',status:404});
    await member('/api/notifications/read-all',{method:'PATCH',status:204});assert.ok((await member('/api/notifications')).every(n=>n.read_at));
    await member('/api/auth/profile',{method:'PATCH',body:{notifications_enabled:false}});
    await member('/api/notifications/sync',{method:'POST',body:{date:'2026-10-20'},status:204});assert.equal((await member('/api/notifications')).length,notes.length);
  });
  await t.test('removing a member revokes access and clears task assignments',async()=>{
    await owner(`/api/projects/${project.id}/members/${ownerUser.id}`,{method:'DELETE',status:400});
    await owner(`/api/projects/${project.id}/members/${memberUser.id}`,{method:'DELETE',status:204});
    await member(`/api/tasks/${shared.id}`,{status:404});
    assert.equal((await member('/api/notifications')).length,0);
    assert.equal((await owner(`/api/tasks/${shared.id}`)).assignee_id,null);
  });
  await t.test('password changes invalidate other sessions and logout invalidates current session',async()=>{
    const otherSession=owner.newClient();await otherSession('/api/auth/login',{method:'POST',body:{email:'owner@example.test',password}});
    await owner('/api/auth/password',{method:'POST',body:{current_password:'wrong',new_password:'new-test-password-2026'},status:400});
    await owner('/api/auth/password',{method:'POST',body:{current_password:password,new_password:'new-test-password-2026'}});
    await otherSession('/api/auth/me',{status:401});
    assert.equal((await owner('/api/auth/me')).user.id,ownerUser.id);
    await otherSession('/api/auth/login',{method:'POST',body:{email:'owner@example.test',password:'new-test-password-2026'}});
    await otherSession('/api/auth/logout',{method:'POST',status:204});await otherSession('/api/auth/me',{status:401});
  });
  await t.test('project deletion cascades only its own tasks and migrations preserve legacy rows',async()=>{
    await owner(`/api/projects/${project.id}`,{method:'DELETE',status:204});await owner(`/api/tasks/${shared.id}`,{status:404});
    assert.equal((await owner(`/api/tasks/${personal.id}`)).id,personal.id);
    await owner(`/api/tasks/${personal.id}`,{method:'DELETE',status:204});await owner(`/api/tasks/${personal.id}`,{status:404});
    await db.query("INSERT INTO tasks (title) VALUES ('Legacy task')");await db.query(schema);
    assert.equal((await owner('/api/tasks')).length,0);assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM tasks WHERE owner_id IS NULL')).rows[0].count,1);
  });
  await t.test('health and protected monitoring endpoint',async()=>{
    assert.equal((await owner('/api/health')).database,'connected');
    const response=await fetch(owner.base+'/api/metrics',{headers:{Authorization:'Bearer test-only-metrics'}});assert.equal(response.status,200);assert.match(await response.text(),/taskflow_http_requests_total/);
    await owner('/api/metrics',{status:404});
  });
  await t.test('login rate limiting persists across requests',async()=>{
    for(let i=0;i<15;i++) await anonymous('/api/auth/login',{method:'POST',body:{email:'absent@example.test',password},status:401});
    await anonymous('/api/auth/login',{method:'POST',body:{email:'absent@example.test',password},status:429});
  });
});
