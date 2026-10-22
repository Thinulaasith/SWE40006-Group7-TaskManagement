import { createPool } from '../src/db.js';
import { getConfig } from '../src/config.js';
import { emailInput } from '../src/validation.js';
import { transaction } from '../src/security.js';

let pool;
try {
  const email = emailInput(process.argv[2]);
  pool = createPool(getConfig().databaseUrl);
  const count = await transaction(pool, async client => {
    const { rows } = await client.query('SELECT id FROM users WHERE email=$1', [email]);
    if (!rows.length) throw new Error('Register that email in Taskflow first.');
    const result = await client.query('UPDATE tasks SET owner_id=$1 WHERE owner_id IS NULL AND project_id IS NULL', [rows[0].id]);
    return result.rowCount;
  });
  console.log(`Imported ${count} existing tasks into the selected account. No tasks were deleted.`);
} catch (error) { console.error(error.code || error.message); process.exitCode = 1; }
finally { if (pool) await pool.end(); }
