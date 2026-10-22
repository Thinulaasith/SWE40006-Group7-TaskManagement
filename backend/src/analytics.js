import { Router } from 'express';
import { route } from './auth.js';
import { accessSql } from './access.js';
import { HttpError, parseTask, validateId } from './validation.js';
const day=value=>new Date(value).toISOString().slice(0,10);
export function analyticsRoutes(db){
  const router=Router();
  router.get('/',route(async(req,res)=>{
    const today=parseTask({due_date:req.query.today||day(new Date())},true).due_date;
    const to=parseTask({due_date:req.query.to||today},true).due_date;
    const from=parseTask({due_date:req.query.from||day(Date.parse(to)-29*86400000)},true).due_date;
    const days=(Date.parse(to)-Date.parse(from))/86400000+1;
    if(!from||!to||!today||!Number.isFinite(days)||days<1||days>366)throw new HttpError(400,'Choose a report range between 1 and 366 days.');
    const values=[req.user.id];let filter='';
    if(req.query.project_id){validateId(req.query.project_id);values.push(req.query.project_id);filter='AND t.project_id=$2';}
    const {rows}=await db.query(`SELECT t.id::text,t.title,t.status,t.priority,to_char(t.due_date,'YYYY-MM-DD') AS due_date,t.created_at,t.completed_at,t.project_id::text,p.name AS project_name,u.name AS assignee_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assignee_id WHERE ${accessSql()} ${filter} ORDER BY t.completed_at DESC NULLS LAST,t.id DESC`,values);
    const done=rows.filter(t=>t.status==='done');
    const report=done.filter(t=>t.completed_at&&day(t.completed_at)>=from&&day(t.completed_at)<=to);
    const groups=new Map();
    for(const task of rows){const key=task.project_id||'personal';if(!groups.has(key))groups.set(key,{id:key,name:task.project_name||'Personal tasks',total:0,done:0});const group=groups.get(key);group.total++;if(task.status==='done')group.done++;}
    const series=Array.from({length:days},(_,i)=>({date:day(Date.parse(from)+i*86400000),completed:0}));
    for(const task of report)series[Math.floor((Date.parse(day(task.completed_at))-Date.parse(from))/86400000)].completed++;
    res.json({from,to,stats:{total:rows.length,done:done.length,in_progress:rows.filter(t=>t.status==='in_progress').length,todo:rows.filter(t=>t.status==='todo').length,overdue:rows.filter(t=>t.status!=='done'&&t.due_date&&t.due_date<today).length,completion_rate:rows.length?Math.round(done.length/rows.length*100):0,completed_in_range:report.length,unknown_completion_dates:done.filter(t=>!t.completed_at).length},projects:[...groups.values()],series,report});
  }));return router;
}
