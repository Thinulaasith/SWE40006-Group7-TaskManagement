import { seedPresentation } from './presentation-data.js';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../src/config.js';
import { hashPassword } from '../src/security.js';
import { createApp } from '../src/app.js';

// A separate disposable schema, never the user's application tables.
const schemaName = `taskflow_demo_${randomUUID().replaceAll('-', '')}`;
const connectionString = getConfig().databaseUrl;
const admin = new pg.Pool({ connectionString });
let db, server, closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.end();
  if (!/^taskflow_demo_[a-f0-9]{32}$/.test(schemaName)) throw new Error('Unsafe demo schema');
  await admin.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await admin.end();
  console.log('Demo stopped and its temporary data removed.');
}
try {
  await admin.query(`CREATE SCHEMA ${schemaName}`);
  db = new pg.Pool({ connectionString, options: `-c search_path=${schemaName}` });
  await db.query(await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
  const alexPassword = 'Alex123';
  const jamiePassword = 'Jamie123';
  const hashes = await Promise.all([hashPassword(alexPassword), hashPassword(jamiePassword)]);
  const { rows: users } = await db.query("INSERT INTO users (name,email,password_hash) VALUES ('Alex Morgan','alex@example.test',$1),('Jamie Chen','jamie@example.test',$2) RETURNING id", hashes);
  await db.query("UPDATE users SET role='admin' WHERE id=$1",[users[0].id]);
  const { rows: projects } = await db.query("INSERT INTO projects (name,description,color,owner_id) VALUES ('Product launch','Bring the next release to life.','#6256ec',$1),('Team operations','Keep the team organized.','#23876b',$1) RETURNING id", [users[0].id]);
  for (const project of projects) {
    await db.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner'),($1,$3,'member')", [project.id, users[0].id, users[1].id]);
  }
  const now = new Date();
  const date = offset => { const d = new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const samples = [
    ['Prepare launch checklist','Review the last details before the release.','high','in_progress',date(0),projects[0].id,users[0].id],
    ['Review landing page','Check layout, copy and mobile interactions.','high','todo',date(-1),projects[0].id,users[1].id],
    ['Write release notes','Explain what changed and how to get started.','medium','todo',date(1),projects[0].id,users[0].id],
    ['Finalize design assets','Export the approved illustrations and icons.','low','done',date(-2),projects[0].id,users[1].id],
    ['Plan weekly team sync','Collect updates and discuss blockers.','medium','todo',date(3),projects[1].id,users[0].id],
    ['Make time for learning','Choose a topic to explore this week.','low','todo',null,null,users[0].id]
  ];
  let first; const taskIds=[];
  for (const values of samples) {
    const { rows } = await db.query('INSERT INTO tasks (title,description,priority,status,due_date,project_id,assignee_id,owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [...values,users[0].id]);
    first ??= rows[0].id; taskIds.push(rows[0].id);
  }
  for(let i=0;i<5;i++)await db.query('UPDATE tasks SET start_date=$1 WHERE id=$2',[date(i===3?-5:-3),taskIds[i]]);
  await db.query('INSERT INTO task_dependencies (task_id,depends_on_id) VALUES ($1,$2),($3,$1)',[taskIds[0],taskIds[3],taskIds[2]]);
  await db.query("INSERT INTO milestones (project_id,title,due_date) VALUES ($1,'Release day',$2)",[projects[0].id,date(4)]);
  const document=Buffer.from('Product launch brief\nScope: review, test, and publish the next release.\n');
  await db.query("INSERT INTO attachments (task_id,uploader_id,name,mime,size,data) VALUES ($1,$2,'launch-brief.txt','text/plain',$3,$4)",[first,users[0].id,document.length,document]);
  await db.query("INSERT INTO activity (actor_id,project_id,action,detail) VALUES ($1,$2,'demo.created','Demo project with files, dependencies and a milestone')",[users[0].id,projects[0].id]);
  await db.query("INSERT INTO subtasks (task_id,title,done) VALUES ($1,'Run regression tests',true),($1,'Confirm release date',false)", [first]);
  await db.query("INSERT INTO comments (task_id,author_id,body) VALUES ($1,$2,'The design review is complete. Ready for the final checks.')", [first,users[1].id]);
  await seedPresentation(db);
  const port = Number(process.env.DEMO_PORT || 5050);
  const app = createApp({ db, origin:`http://localhost:${port}`, cookieName:'taskflow_demo_session', staticDir:fileURLToPath(new URL('../../frontend/dist',import.meta.url)) });
  server = app.listen(port,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  console.log(`Demo: http://localhost:${port}\nAlex: alex@example.test / ${alexPassword}\nJamie: jamie@example.test / ${jamiePassword}\nIncludes the Group 7 presentation projects, tasks, files and four additional members.\nSee docs/PRESENTATION-DATA.md for the walkthrough and demo accounts.\nData is isolated from your real tasks. Press Ctrl+C to stop and remove demo data.`);
  process.on('SIGINT',close);process.on('SIGTERM',close);
} catch (error) { console.error('Demo failed:',error.code||error.message);await close();process.exitCode=1; }
