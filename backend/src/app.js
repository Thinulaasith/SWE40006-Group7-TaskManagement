import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '50kb' }));
const priorities = ['low','medium','high'];
const statuses = ['todo','in_progress','done'];
const validDate = x => x === null || (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x);
export function parseTask(body) {
 const title = body.title;
 const description = body.description ?? '';
 const priority = body.priority ?? 'medium';
 const status = body.status ?? 'todo';
 const due_date = body.due_date === '' || body.due_date === undefined ? null : body.due_date;
 if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) return { error: 'Title is required (maximum 150 characters).' };
 if (typeof description !== 'string' || description.length > 2000) return { error: 'Description must be 2000 characters or fewer.' };
 if (!priorities.includes(priority) || !statuses.includes(status)) return { error: 'Invalid priority or status.' };
 if (!validDate(due_date)) return { error: 'Invalid due date (use YYYY-MM-DD).' };
 return { data: [title.trim(),description.trim(),priority,status,due_date] };
}
function errorHandler(res, err) { console.error(err); res.status(500).json({ error: 'Database or server error.' }); }
app.get('/api/health', async (_req,res) => { try { await pool.query('SELECT 1'); res.json({ status:'ok', database:'connected' }); } catch (err) { errorHandler(res,err); } });
app.get('/api/tasks', async (req,res) => { try {
 const status = req.query.status; const priority = req.query.priority;
 if ((status && status !== 'all' && !statuses.includes(status)) || (priority && priority !== 'all' && !priorities.includes(priority))) return res.status(400).json({error:'Invalid filter.'});
 const conditions = []; const params = [];
 if (status && status !== 'all') { params.push(status); conditions.push(`status = $${params.length}`); }
 if (priority && priority !== 'all') { params.push(priority); conditions.push(`priority = $${params.length}`); }
 const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
 const { rows } = await pool.query(`SELECT id::text,title,description,priority,status,to_char(due_date,'YYYY-MM-DD') AS due_date,created_at,updated_at FROM tasks ${where} ORDER BY created_at DESC,id DESC`,params);
 res.json(rows);
 } catch (err) { errorHandler(res,err); } });
app.post('/api/tasks', async (req,res) => { const result=parseTask(req.body ?? {}); if (result.error) return res.status(400).json({error:result.error}); try {
 const { rows } = await pool.query(`INSERT INTO tasks (title,description,priority,status,due_date) VALUES ($1,$2,$3,$4,$5) RETURNING id::text,title,description,priority,status,to_char(due_date,'YYYY-MM-DD') AS due_date,created_at,updated_at`,result.data);
 res.status(201).json(rows[0]);
 } catch (err) { errorHandler(res,err); } });
app.put('/api/tasks/:id', async (req,res) => { if (!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid task ID.'}); const result=parseTask(req.body ?? {}); if (result.error) return res.status(400).json({error:result.error}); try {
 const {rows}=await pool.query(`UPDATE tasks SET title=$1,description=$2,priority=$3,status=$4,due_date=$5,updated_at=NOW() WHERE id=$6 RETURNING id::text,title,description,priority,status,to_char(due_date,'YYYY-MM-DD') AS due_date,created_at,updated_at`,[...result.data,req.params.id]);
 if (!rows.length) return res.status(404).json({error:'Task not found.'}); res.json(rows[0]);
 } catch(err) {errorHandler(res,err);} });
app.delete('/api/tasks/:id', async (req,res) => { if (!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid task ID.'}); try { const result=await pool.query('DELETE FROM tasks WHERE id=$1',[req.params.id]); if (!result.rowCount) return res.status(404).json({error:'Task not found.'}); res.status(204).send(); } catch(err) {errorHandler(res,err);} });
export default app;
