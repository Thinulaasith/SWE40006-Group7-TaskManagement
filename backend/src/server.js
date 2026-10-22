import app from './app.js';
import { pool } from './db.js';
const port = Number(process.env.PORT || 5000);
(async () => { try { await pool.query('SELECT 1'); app.listen(port, () => console.log(`API running at http://localhost:${port}`)); } catch (error) { console.error('Could not connect to PostgreSQL:',error.message); process.exit(1); } })();
