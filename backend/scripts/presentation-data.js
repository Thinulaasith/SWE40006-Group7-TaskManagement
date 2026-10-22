import { hashPassword, transaction } from '../src/security.js';

// Fictional presentation data. Restricted to the disposable demo schemas.
export const presentationMembers = [
  {name:'Priya Shah',email:'priya@example.test',password:'Priya-Demo-2026!',bio:'Frontend developer — task views, responsive layouts and accessibility.'},
  {name:'Daniel Brooks',email:'daniel@example.test',password:'Daniel-Demo-2026!',bio:'Backend developer — APIs, data integrity and permissions.'},
  {name:'Sofia Martinez',email:'sofia@example.test',password:'Sofia-Demo-2026!',bio:'QA engineer — acceptance tests, usability and release readiness.'},
  {name:'Ethan Wilson',email:'ethan@example.test',password:'Ethan-Demo-2026!',bio:'DevOps engineer — Docker, monitoring and release preparation.'}
];

const projects = [
  {
    name:'TaskFlow Web Experience',color:'#7056d9',
    description:'Presentation scenario: deliver a clear and accessible task-management experience. Scope includes dashboard navigation, task forms, file attachments and the project timeline. Alex coordinates sign-off; Jamie leads UX.',
    dates:[[-6,-5],[-4,-3],[-2,0],[1,2],[3,4],[5,6]],
    milestone:'Web experience ready for review',milestoneOffset:6,
    tasks:[
      ['Agree user journeys and acceptance criteria','Alex Morgan','high','done','Document how a student creates a project, assigns a task, attaches evidence and tracks delivery. Acceptance: each journey has a clear success condition and an owner.',['Define the four presentation journeys','Agree acceptance criteria with the team','Confirm scope with the project lead']],
      ['Approve dashboard and navigation design','Jamie Chen','medium','done','Review the dashboard hierarchy, sidebar labels and mobile navigation. Acceptance: task status and the next action are understandable without explanation.',['Review desktop navigation','Check the mobile menu','Approve labels and spacing']],
      ['Refine the task form and validation messages','Priya Shah','high','in_progress','Make task creation clear on desktop and mobile. Show title, dates, project and assignee validation beside the relevant fields. Acceptance: a first-time user can create an assigned task without assistance.',['Review required-field messages','Check start and due date validation','Verify keyboard navigation']],
      ['Review attachment permissions and file limits','Daniel Brooks','high','todo','Verify that project members can upload supporting documents while viewers can only read and download. Acceptance: unrelated users cannot download files and oversized uploads show a clear message.',['Check upload and download access','Verify the 10 MiB limit','Confirm files stay with their task']],
      ['Run responsive and accessibility acceptance review','Sofia Martinez','high','todo','Test the agreed user journeys at desktop and phone widths. Acceptance: controls remain readable, dialogs support keyboard use and the timeline scrolls inside its panel.',['Check phone-width task forms','Review focus indicators and dialog navigation','Record findings with reproduction steps']],
      ['Prepare the web preview handover','Ethan Wilson','medium','todo','Package the reviewed frontend for the presentation environment. Acceptance: the build loads, the run instructions work and the team knows how to refresh the demo.',['Build the frontend bundle','Verify the preview entry point','Share the handover checklist']]
    ],
    files:[
      [0,'web-experience-brief.txt',`TASKFLOW WEB EXPERIENCE — PROJECT BRIEF
Presentation sample: fictional team delivery work.

Goal
Help a student team plan work, share supporting files and see what must happen next.

Primary users
Project owner: creates a project, assigns work and manages membership.
Team member: updates tasks, adds subtasks and attaches evidence.
Viewer: reads project progress and downloads authorized attachments.

Presentation journeys
1. Create a task with a title, start date, due date and assignee.
2. Add a text attachment and find it again in the Files library.
3. Move work from To do to In progress to Completed.
4. Open the timeline and follow a prerequisite connection.

Success criteria
Labels are understandable, changes persist after refresh, and private work stays private.
Start dates follow prerequisite due dates in this sample project.

Out of scope
Public deployment, email invitations and external integrations.
`],
      [2,'task-form-review-checklist.txt',`TASK FORM — REVIEW CHECKLIST
Presentation sample; use this checklist while demonstrating the form.

[ ] A blank title cannot be submitted.
[ ] A due date earlier than the start date is rejected.
[ ] Assignee choices match the selected project's writable members.
[ ] Saving returns to the workspace with the new task visible.
[ ] Cancel and Escape close the dialog without creating a task.
[ ] Keyboard focus remains in the open dialog.
[ ] Controls remain readable at a narrow viewport.

Review owner: Priya Shah
Acceptance reviewer: Sofia Martinez
Evidence to capture: desktop form, narrow form and saved task card.
`]
    ]
  },
  {
    name:'TaskFlow Quality Assurance',color:'#208c78',
    description:'Presentation scenario: verify the application before release. Cover account access, task workflows, analytics and dependency rules, then record a concise acceptance report.',
    dates:[[-6,-5],[-4,-3],[-2,-1],[0,1],[2,3],[4,5]],
    milestone:'Acceptance report approved',milestoneOffset:5,
    tasks:[
      ['Define the acceptance test matrix','Sofia Martinez','high','done','List the main features, roles and expected outcomes. Acceptance: every core feature has a happy-path check and an access or validation check.',['List feature coverage','Add owner, member and viewer cases','Prioritize the presentation smoke checks']],
      ['Review authentication and project access checks','Daniel Brooks','high','done','Review sign-in, sign-out, private task access and member removal behavior. Acceptance: removed members lose access and regular accounts cannot open administration routes.',['Review session restoration','Check private task isolation','Check membership revocation']],
      ['Review keyboard and mobile interaction findings','Priya Shah','high','in_progress','Follow up the accessibility review before presentation sign-off. This sample task is intentionally overdue so deadline warnings can be demonstrated. Acceptance: each finding has a fix or documented follow-up.',['Reproduce the keyboard findings','Check narrow-screen dialogs','Record final review notes']],
      ['Validate analytics and completion reporting','Alex Morgan','medium','todo','Compare dashboard totals with the project task list and export a completion report. Acceptance: completed counts agree, date filters work and reopening a task removes its current completion from the report.',['Compare project totals','Check the completion date range','Download and inspect the CSV report']],
      ['Review Gantt dependencies and milestone clarity','Jamie Chen','medium','todo','Follow the dependency chain and review the visible milestone. Acceptance: arrows identify prerequisites clearly, cycles are rejected and date overlaps show a warning without changing dates automatically.',['Trace the task connections','Check a milestone label','Review the scheduling warning explanation']],
      ['Prepare the acceptance evidence package','Ethan Wilson','medium','todo','Collect the agreed test commands, result summaries and screenshots in a handover folder. Acceptance: another team member can reproduce the final checks from the notes.',['List the verification commands','Collect the review evidence','Prepare the acceptance handover']]
    ],
    files:[
      [0,'acceptance-test-matrix.txt',`TASKFLOW — ACCEPTANCE TEST MATRIX
Presentation sample: these are planned checks, not a claim that a test run occurred.

Area                 Role         Expected outcome
Sign-in              Registered   Valid credentials open the workspace.
Personal tasks       Owner        Other accounts cannot read the task.
Project tasks        Member       Can create, assign and update work.
Project tasks        Viewer       Can read but cannot edit.
Attachments          Member       Can upload supported files within limits.
Attachments          Outsider     Cannot download another project's file.
Analytics            Member       Totals match accessible current tasks.
Gantt dependencies   Member       Circular links are rejected.
Administration       Admin        Can disable a different account.
Administration       User         Cannot access account management.

Record for each check
Steps, expected result, observed result, reviewer and evidence filename.

Exit criteria
No unresolved issue prevents the presentation journeys.
Any remaining limitation is explained in the handover notes.
`],
      [2,'accessibility-review-notes.txt',`ACCESSIBILITY AND RESPONSIVE REVIEW
Presentation sample working notes.

Review owner: Priya Shah
QA contact: Sofia Martinez

Checks to finish
1. Navigate from the sidebar into task details using only the keyboard.
2. Confirm visible focus on buttons, dropdowns and form fields.
3. Close a dialog with Escape and check that focus returns to its trigger.
4. Check form labels and validation messages at a narrow window width.
5. Confirm the Gantt timeline scrolls inside its panel.
6. Use the chart data table as an alternative to the analytics bars.

Evidence format
Finding / steps / expected behavior / observed behavior / follow-up owner.

Scheduling note
This task is intentionally overdue in the sample data to demonstrate deadline notifications.
`]
    ]
  },
  {
    name:'TaskFlow Release & Presentation',color:'#c68a2d',
    description:'Presentation scenario: prepare a repeatable local release and a clear Group 7 demonstration. Keep the environment, talking points, backups and rehearsal checklist together. No public deployment is included.',
    dates:[[-6,-5],[-4,-3],[-1,1],[2,3],[4,5],[6,7]],
    milestone:'Group 7 presentation ready',milestoneOffset:7,
    tasks:[
      ['Agree the presentation storyline and roles','Alex Morgan','high','done','Introduce the problem, show a realistic team workflow and finish with engineering evidence. Acceptance: each speaker knows their section and the audience sees one coherent project story.',['Agree the opening problem statement','Assign speaking sections','Choose the feature demonstration order']],
      ['Prepare the local release checklist','Ethan Wilson','high','done','Document prerequisites, startup commands, local URLs and stopping the demo. Acceptance: the presenter can start the app without guessing and understands which data is temporary.',['List Node and PostgreSQL prerequisites','Document demo and development URLs','Explain restart and data behavior']],
      ['Review sample data and presentation attachments','Jamie Chen','medium','in_progress','Check that project names, task descriptions and supporting files are meaningful. Acceptance: each sample task has an owner and a clear outcome, and no private credentials appear in uploaded files.',['Review the three project briefs','Check task assignments and dates','Review attachment content']],
      ['Prepare the feature demonstration script','Priya Shah','medium','todo','Write a short click-by-click script for dashboard, tasks, files, timeline, analytics and team roles. Acceptance: the walkthrough fits within the allotted demonstration time.',['Draft the feature sequence','Choose one task to edit live','Add recovery steps for a missed click']],
      ['Verify release health and recovery commands','Daniel Brooks','high','todo','Review the health endpoint, migration command and startup troubleshooting notes. Acceptance: the team knows how to recover from a stopped database or an occupied port.',['Review database readiness checks','Verify documented migration command','Prepare troubleshooting notes']],
      ['Run the final presentation rehearsal','Sofia Martinez','high','todo','Rehearse the complete demonstration with a second team member. Acceptance: all speakers stay on time and a backup walkthrough is available if live interaction is interrupted.',['Time the full demonstration','Review the handovers between speakers','Confirm the backup screenshots and notes']]
    ],
    files:[
      [1,'local-release-checklist.txt',`TASKFLOW — LOCAL RELEASE CHECKLIST
Presentation sample handover document.

Before starting
[ ] PostgreSQL is running.
[ ] The terminal is in the TaskFlow project folder.
[ ] The configured backend/.env is present; do not display its credentials.
[ ] Stop an older demo in its own terminal before starting another.

Demo
Command: npm.cmd run demo
Open: http://localhost:5050
The demo uses isolated, disposable sample data.

Regular development app
Commands: npm.cmd run db:init
          npm.cmd run dev
Open: http://localhost:5173
The development app keeps its data in the configured database.

Engineering checks
npm.cmd test
npm.cmd run test:integration
npm.cmd run build

After the presentation
Stop the demo with Ctrl+C. Its temporary schema is removed on normal shutdown.
Keep presentation notes in the repository so the scenario can be recreated.
`],
      [3,'presentation-run-of-show.txt',`GROUP 7 — TASKFLOW PRESENTATION RUN OF SHOW
Presentation sample. Target duration: approximately 8 minutes.

00:00–00:45  Explain the problem: scattered tasks and unclear ownership.
00:45–01:30  Open Projects and introduce the three delivery workstreams.
01:30–02:30  Open a task, show its owner, dates, subtasks and comments.
02:30–03:15  Download a text attachment from Files and explain project access.
03:15–04:15  Open Timeline, follow a dependency, and point out a milestone.
04:15–05:00  Show Kanban status changes and the refreshed dashboard totals.
05:00–06:00  Show Analytics, the completion table and CSV export.
06:00–07:00  Explain owner/member/viewer roles and account administration.
07:00–08:00  Summarize tests, Docker, monitoring and future improvements.

Suggested live task
Use “Prepare the feature demonstration script” for a small title or subtask update.

Backup plan
Keep screenshots and these notes available. Do not claim a live test succeeded
if it could not be demonstrated; explain the recorded verification separately.
`]
    ]
  }
];

function sydneyToday() {
  const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const value=type=>parts.find(p=>p.type===type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function seedPresentation(db) {
  const hashes=await Promise.all(presentationMembers.map(member=>hashPassword(member.password)));
  return transaction(db,async client=>{
    const {rows:[scope]}=await client.query('SELECT current_schema() AS name');
    if(!/^taskflow_demo_[a-f0-9]{32}$/.test(scope.name))throw new Error('Presentation data can only be added to an isolated demo schema.');
    await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':presentation-seed'))");
    const {rowCount}=await client.query("SELECT 1 FROM activity WHERE action='demo.presentation_seeded' AND detail='Group 7 presentation dataset v1'");
    if(rowCount)return {alreadyPresent:true};
    const {rows:[alex]}=await client.query("SELECT id,name FROM users WHERE email='alex@example.test'");
    const {rows:[jamie]}=await client.query("SELECT id,name FROM users WHERE email='jamie@example.test'");
    if(!alex||!jamie)throw new Error('Alex and Jamie must exist before presentation setup.');
    const people=new Map([[alex.name,alex.id],[jamie.name,jamie.id]]);
    for(let i=0;i<presentationMembers.length;i++){
      const person=presentationMembers[i];
      await client.query('INSERT INTO users (name,email,password_hash,bio) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING',[person.name,person.email,hashes[i],person.bio]);
      const {rows:[user]}=await client.query('SELECT id FROM users WHERE email=$1',[person.email]);
      people.set(person.name,user.id);
    }
    const anchor=sydneyToday();
    const date=offset=>new Date(Date.parse(anchor+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
    let taskCount=0,fileCount=0,subtaskCount=0;
    const created=[];
    for(const project of projects){
      const {rows:[record]}=await client.query('INSERT INTO projects (name,description,color,owner_id) VALUES ($1,$2,$3,$4) RETURNING id',[project.name,project.description,project.color,alex.id]);
      created.push({id:record.id,name:project.name});
      for(const [name,id] of people)await client.query('INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,$3)',[record.id,id,name==='Alex Morgan'?'owner':'member']);
      const taskIds=[];
      for(let i=0;i<project.tasks.length;i++){
        const [title,assignee,priority,status,description,steps]=project.tasks[i], [start,due]=project.dates[i];
        const {rows:[task]}=await client.query('INSERT INTO tasks (title,description,priority,status,start_date,due_date,project_id,assignee_id,owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[title,description,priority,status,date(start),date(due),record.id,people.get(assignee),alex.id]);
        taskIds.push(task.id);taskCount++;
        for(let j=0;j<steps.length;j++){
          await client.query('INSERT INTO subtasks (task_id,title,done) VALUES ($1,$2,$3)',[task.id,steps[j],status==='done'||(status==='in_progress'&&j===0)]);
          subtaskCount++;
        }
        if(i>0)await client.query('INSERT INTO task_dependencies (task_id,depends_on_id) VALUES ($1,$2)',[task.id,taskIds[i-1]]);
        if(status==='in_progress')await client.query("INSERT INTO comments (task_id,author_id,body) VALUES ($1,$2,$3)",[task.id,people.get(assignee),'The first checklist item is complete. I will finish the remaining review and attach any follow-up evidence before handover.']);
        await client.query("INSERT INTO activity (actor_id,project_id,owner_id,task_id,action,detail) VALUES ($1,$2,$1,$3,'task.created',$4)",[alex.id,record.id,task.id,'Presentation sample: '+title]);
      }
      for(const [index,name,content] of project.files){
        const bytes=Buffer.from(content,'utf8');
        await client.query("INSERT INTO attachments (task_id,uploader_id,name,mime,size,data) VALUES ($1,$2,$3,'text/plain',$4,$5)",[taskIds[index],people.get(project.tasks[index][1]),name,bytes.length,bytes]);
        await client.query("INSERT INTO activity (actor_id,project_id,owner_id,task_id,action,detail) VALUES ($1,$2,$1,$3,'file.uploaded',$4)",[alex.id,record.id,taskIds[index],'Presentation sample: '+name]);
        fileCount++;
      }
      await client.query('INSERT INTO milestones (project_id,title,due_date) VALUES ($1,$2,$3)',[record.id,project.milestone,date(project.milestoneOffset)]);
      await client.query("INSERT INTO activity (actor_id,project_id,owner_id,action,detail) VALUES ($1,$2,$1,'project.created',$3)",[alex.id,record.id,'Presentation sample: '+project.name]);
    }
    await client.query("INSERT INTO activity (actor_id,owner_id,action,detail) VALUES ($1,$1,'demo.presentation_seeded','Group 7 presentation dataset v1')",[alex.id]);
    return {alreadyPresent:false,anchor,projects:created,tasks:taskCount,files:fileCount,subtasks:subtaskCount,members:presentationMembers.length,milestones:projects.length};
  });
}
