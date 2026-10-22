import pg from 'pg';
import { getConfig } from '../src/config.js';
import { seedPresentation } from './presentation-data.js';

const schema=process.argv[2];
if(!/^taskflow_demo_[a-f0-9]{32}$/.test(schema||''))throw new Error('Provide the exact running demo schema name. Regular application schemas are not allowed.');
const db=new pg.Pool({connectionString:getConfig().databaseUrl,options:`-c search_path=${schema}`});
try {console.log(JSON.stringify(await seedPresentation(db),null,2));}
finally {await db.end();}
