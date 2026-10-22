import express, { Router } from 'express';
import { route } from './auth.js';
import { taskAccess, accessSql } from './access.js';
import { transaction, rateLimit } from './security.js';
import { HttpError, textInput, validateId, parseFilters } from './validation.js';
import { audit } from './activity.js';

const types = { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', txt:'text/plain', csv:'text/csv', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
export function validateFile(name, data) {
  name = textInput(name, 'File name', 180);
  if (/[\\/:\x00-\x1f\x7f]/.test(name) || name.startsWith('.') || name.endsWith('.')) throw new HttpError(400,'Use a plain file name without path separators or control characters.');
  const ext = name.split('.').pop().toLowerCase();
  if (!Object.hasOwn(types,ext)) throw new HttpError(400,'Supported files: PDF, PNG, JPEG, WebP, TXT, CSV, DOCX, XLSX and PPTX.');
  if (!Buffer.isBuffer(data) || !data.length) throw new HttpError(400,'Choose a non-empty file.');
  if (data.length > 10485760) throw new HttpError(413,'Files must be 10 MB or smaller.');
  const hex = data.subarray(0,12).toString('hex');
  let valid = true;
  if (ext==='pdf') valid=data.subarray(0,5).toString()==='%PDF-';
  if (ext==='png') valid=hex.startsWith('89504e470d0a1a0a');
  if (['jpg','jpeg'].includes(ext)) valid=hex.startsWith('ffd8ff');
  if (ext==='webp') valid=data.subarray(0,4).toString()==='RIFF' && data.subarray(8,12).toString()==='WEBP';
  if (['docx','xlsx','pptx'].includes(ext)) valid=hex.startsWith('504b0304');
  if (['txt','csv'].includes(ext)) {
    try { new TextDecoder('utf-8',{fatal:true}).decode(data); valid=!data.includes(0); } catch { valid=false; }
  }
  if (!valid) throw new HttpError(400,'The file content does not match its extension.');
  return {name,mime:types[ext]};
}
const columns = 'a.id::text,a.task_id::text,a.uploader_id::text,a.name,a.mime,a.size,a.created_at,t.title AS task_title,t.project_id::text,p.name AS project_name,u.name AS uploader_name';
export function fileRoutes(db) {
  const router=Router();
  router.get('/files',route(async(req,res)=>{
    const {q,limit=50,offset=0}=parseFilters(req.query);
    const values=[req.user.id]; const where=[accessSql()];
    if(req.query.task_id){validateId(req.query.task_id);values.push(req.query.task_id);where.push(`t.id=$${values.length}`);}
    if(req.query.project_id){validateId(req.query.project_id);values.push(req.query.project_id);where.push(`t.project_id=$${values.length}`);}
    if(q){values.push(`%${q.replace(/[\\%_]/g,'\\$&')}%`);where.push(`(a.name ILIKE $${values.length} OR t.title ILIKE $${values.length})`);}
    values.push(limit,offset);
    res.json((await db.query(`SELECT ${columns} FROM attachments a JOIN tasks t ON t.id=a.task_id LEFT JOIN projects p ON p.id=t.project_id JOIN users u ON u.id=a.uploader_id WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC,a.id DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values)).rows);
  }));
  router.post('/tasks/:id/attachments',route(async(req,_res,next)=>{
    await taskAccess(db,req.params.id,req.user.id);
    await rateLimit(db,`upload:${req.user.id}`,60);
    if(!req.is('application/octet-stream'))throw new HttpError(415,'Upload file bytes as application/octet-stream.');
    next();
  }),express.raw({type:'application/octet-stream',limit:'10mb',inflate:false}),route(async(req,res)=>{
    const file=validateFile(req.query.name,req.body);
    const result=await transaction(db,async client=>{
      const task=await taskAccess(client,req.params.id,req.user.id,true);
      const {rows:[usage]}=await client.query('SELECT COUNT(*)::int AS count,COALESCE(SUM(size),0)::bigint AS bytes FROM attachments WHERE task_id=$1',[task.id]);
      if(usage.count>=20 || Number(usage.bytes)+req.body.length>104857600)throw new HttpError(409,'Each task can hold up to 20 files and 100 MB.');
      const {rows}=await client.query('INSERT INTO attachments (task_id,uploader_id,name,mime,size,data) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id::text,name,size,mime,created_at',[task.id,req.user.id,file.name,file.mime,req.body.length,req.body]);
      await audit(client,req.user.id,'file.uploaded',`Uploaded ${file.name}`,task);
      return rows[0];
    });
    res.status(201).json(result);
  }));
  router.get('/files/:id/download',route(async(req,res)=>{
    validateId(req.params.id);
    const {rows}=await db.query(`SELECT a.name,a.mime,a.data FROM attachments a JOIN tasks t ON t.id=a.task_id WHERE a.id=$2 AND ${accessSql()}`,[req.user.id,req.params.id]);
    if(!rows.length)throw new HttpError(404,'File not found.');
    const file=rows[0];
    res.setHeader('Content-Type',file.mime);
    res.setHeader('Content-Disposition',`attachment; filename="${file.name.replace(/[^a-zA-Z0-9._ -]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`);
    res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");
    res.send(file.data);
  }));
  router.delete('/files/:id',route(async(req,res)=>{
    validateId(req.params.id);
    await transaction(db,async client=>{
      const {rows:[file]}=await client.query('SELECT task_id,name,uploader_id FROM attachments WHERE id=$1',[req.params.id]);
      if(!file)throw new HttpError(404,'File not found.');
      const task=await taskAccess(client,file.task_id,req.user.id,true);
      await client.query('DELETE FROM attachments WHERE id=$1',[req.params.id]);
      await audit(client,req.user.id,'file.deleted',`Deleted ${file.name}`,task);
    });res.status(204).end();
  }));
  return router;
}
