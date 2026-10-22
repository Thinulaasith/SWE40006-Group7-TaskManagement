import test from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './helpers.js';
import { parseTask, parseFilters, validateId } from '../src/validation.js';

const noDatabase = { query() { throw new Error('Unexpected database access'); } };
test('task inputs reject malformed dates, enums, lengths, nulls and IDs', () => {
  for (const body of [{}, [], null, {title:' '}, {title:42}, {title:'x'.repeat(151)}, {title:'a',description:'x'.repeat(2001)}, {title:'a',description:null}, {title:'a',priority:'urgent'}, {title:'a',status:'invalid'}, {title:'a',due_date:'0000-01-01'}, {title:'a',due_date:'2026-02-30'}, {title:'a',due_date:'2025-02-29'}, {title:'a',due_date:123}, {title:'bad\u0000title'}, {title:'a',project_id:['1']}, {title:'a',assignee_id:'0'}]) assert.throws(()=>parseTask(body), {status:400});
  for(const id of ['0','-1','1.5','abc','9223372036854775808', ['1'], null]) assert.throws(()=>validateId(id),{status:400});
  for(const query of [{status:'bad'},{priority:'urgent'},{status:['todo','done']},{q:{}},{q:'\u0000'},{limit:'0'},{limit:'101'},{offset:'-1'}]) assert.throws(()=>parseFilters(query),{status:400});
  assert.throws(()=>parseTask({},true),{status:400});
  assert.equal(parseTask({title:'  Task  ',due_date:'2028-02-29'}).title,'Task');
});
test('all private resources require authentication', async t => {
  const request=await startApi(t,noDatabase);
  for(const path of ['/tasks','/tasks/stats','/tasks/1','/tasks/1/details','/projects','/notifications','/auth/me']) await request('/api'+path,{status:401});
  await request('/api/tasks',{method:'POST',body:{title:'task'},status:401});
});
test('request parsing, CSRF preflight guard, origin check and error format', async t => {
  const request=await startApi(t,noDatabase);
  await request('/api/auth/register',{method:'POST',raw:'{',status:400});
  await request('/api/auth/register',{method:'POST',body:{title:'x'.repeat(60*1024)},status:413});
  await request('/api/auth/register',{method:'POST',raw:'text',headers:{'Content-Type':'text/plain'},status:415});
  await request('/api/auth/register',{method:'POST',body:{},headers:{'X-Taskflow-Request':''},status:403});
  await request('/api/auth/register',{method:'POST',body:{},headers:{Origin:'https://evil.example'},status:403});
  await request('/api/metrics',{status:404});
});
test('health reports database unavailability without leaking details', async t => {
  const request=await startApi(t,{async query(){throw new Error('secret connection string');}});
  const health=await request('/api/health',{status:503});
  assert.equal(health.database,'unavailable');
  assert.ok(!JSON.stringify(health).includes('secret'));
  assert.equal((await request('/api/health/live')).status,'ok');
});
