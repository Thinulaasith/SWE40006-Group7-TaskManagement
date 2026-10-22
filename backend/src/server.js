import { createApp } from './app.js';
import { createPool } from './db.js';
import { getConfig } from './config.js';

let pool;
try {
  const config = getConfig();
  pool = createPool(config.databaseUrl);
  await pool.query('SELECT t.id,t.owner_id,t.start_date,t.completed_at,u.role,u.disabled,a.id,d.task_id,m.id,h.id FROM tasks t FULL JOIN users u ON FALSE FULL JOIN attachments a ON FALSE FULL JOIN task_dependencies d ON FALSE FULL JOIN milestones m ON FALSE FULL JOIN activity h ON FALSE LIMIT 0');
  const app = createApp({ db: pool, ...config });
  const server = app.listen(config.port);
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  console.log(`API running at http://localhost:${config.port}`);
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    console.log('Stopping API...');
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      try { await pool.end(); clearTimeout(timeout); }
      catch { process.exitCode = 1; }
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  if (!pool) console.error(error.message);
  else console.error('Backend startup failed:', error.code || error.name, 'Check PostgreSQL, backend/.env and run npm run db:init --prefix backend.');
  if (pool) await pool.end();
  process.exitCode = 1;
}
