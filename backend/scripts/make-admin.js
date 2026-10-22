import pg from 'pg';
import { getConfig } from '../src/config.js';
import { emailInput } from '../src/validation.js';
import { transaction } from '../src/security.js';
import { audit } from '../src/activity.js';
const pool=new pg.Pool({connectionString:getConfig().databaseUrl});
try {
  const email=emailInput(process.argv[2]);
  await transaction(pool,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':taskflow-admin'))");
    const {rows:[user]}=await client.query("UPDATE users SET role='admin' WHERE email=$1 AND NOT disabled RETURNING id",[email]);
    if(!user)throw new Error('Register this account first; it must be active.');
    await client.query('DELETE FROM sessions WHERE user_id=$1',[user.id]);
    await audit(client,null,'account.admin_bootstrap',`Administrator granted to ${email} by the local database operator`,{},true);
  });
  console.log('Administrator role granted. Sign in again to open Administration.');
} catch(error){console.error(error.message);process.exitCode=1;}finally{await pool.end();}
