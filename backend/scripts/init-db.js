import { readFile } from 'node:fs/promises';
import { getConfig } from '../src/config.js';
import { createPool } from '../src/db.js';

let pool;
try {
  pool = createPool(getConfig().databaseUrl);
  const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  console.log('Database tables and indexes are ready. Existing tasks were preserved.');
} catch (error) {
  console.error('Database setup failed:', pool ? error.code || error.name : error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
