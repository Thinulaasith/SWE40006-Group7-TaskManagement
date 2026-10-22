import { Router } from 'express';
import { route } from './auth.js';
import { HttpError, parseTask, validateId } from './validation.js';
import { accessSql } from './access.js';

export function notificationRoutes(db) {
  const router = Router();
  router.post('/sync', route(async (req, res) => {
    const { due_date: date } = parseTask({ due_date: req.body.date }, true);
    if (!date) throw new HttpError(400, 'Provide today\'s date.');
    if (req.user.notifications_enabled) {
      await db.query(`INSERT INTO notifications (user_id,task_id,message,event_key)
        SELECT $1,t.id,CASE WHEN t.due_date<$2::date THEN 'Overdue: ' ELSE 'Due soon: ' END || t.title,
        'deadline:' || t.id || ':' || t.due_date || ':' || CASE WHEN t.due_date<$2::date THEN 'overdue' ELSE 'soon' END
        FROM tasks t WHERE ${accessSql()} AND (t.owner_id=$1 OR t.assignee_id=$1)
        AND t.status<>'done' AND t.due_date<=$2::date+1 ON CONFLICT (user_id,event_key) DO NOTHING`, [req.user.id, date]);
    }
    res.status(204).end();
  }));
  router.get('/', route(async (req, res) => {
    const { rows } = await db.query(`SELECT n.id::text,n.task_id::text,n.message,n.read_at,n.created_at FROM notifications n
      LEFT JOIN tasks t ON t.id=n.task_id WHERE n.user_id=$1 AND (n.task_id IS NULL OR ${accessSql()}) ORDER BY n.created_at DESC,n.id DESC LIMIT 100`, [req.user.id]);
    res.json(rows);
  }));
  router.patch('/read-all', route(async (req, res) => {
    await db.query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1', [req.user.id]); res.status(204).end();
  }));
  router.patch('/:id', route(async (req, res) => {
    validateId(req.params.id);
    const { rowCount } = await db.query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!rowCount) throw new HttpError(404, 'Notification not found.');
    res.status(204).end();
  }));
  return router;
}
