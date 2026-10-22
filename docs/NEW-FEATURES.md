# Files, analytics, administration and timeline

## Upgrade and run

Keep the existing `backend/.env`. With PostgreSQL running, run from the project root:

```powershell
npm.cmd run db:init
npm.cmd run dev
```

Open http://localhost:5173. Restart an older running development process before starting another. The migration adds tables and columns without deleting existing tasks. Old completed tasks retain an unknown completion date rather than an invented one.

For the disposable demonstration, stop the old demo in its original terminal with Ctrl+C, then run `npm.cmd run demo` and open http://localhost:5050. The demo rebuilds the frontend and creates new isolated data; its data is removed when it exits normally. Alex (`alex@example.test`, password `Alex123`) is an administrator in the demo only. Jamie (`jamie@example.test`, password `Jamie123`) is a regular user.

## Files

Open **Files**, choose a task, choose a file and upload. Alternatively, open a task's details and use **Files & attachments**. Search filenames/task names, filter by project, download or delete attachments. Files follow the task's project access, including when a task moves. Deleting a task/project deletes its attachments.

- Supported: PDF, PNG, JPEG, WebP, UTF-8 TXT/CSV and DOCX/XLSX/PPTX.
- Limit: 10 MiB per file, 20 files and 100 MiB per task. Empty files are rejected.
- Binary contents and metadata are stored in PostgreSQL, so normal database backups include attachments. Docker's database volume preserves files across container replacement.
- Session and CSRF checks precede upload parsing; extension/signature checks, size limits and task permissions apply. Downloads require access and are forced as attachments, with no inline HTML execution.
- Signature checks are not malware scanning. Office files receive ZIP-signature checks, not full document validation. There is no antivirus or document sanitization service bundled. Files are downloaded, not previewed inline.

## Analytics

Open **Analytics**, choose a project and date range (up to 366 days), then refresh as needed. View current totals, completion rate, overdue count, status bars, project progress, daily completion counts and the completion report. Export the report as CSV; spreadsheet formula prefixes are neutralized.

Current cards use accessible tasks now. Date reports include currently completed tasks with a recorded completion timestamp in the selected inclusive UTC date range. Reopening clears that timestamp; completing again records the latest completion. Deleted tasks are excluded. Editing an already completed task does not change its completion time. Older completed tasks with unknown completion dates are counted in current totals but excluded from date reports. The chart includes a table alternative.

## Roles and activity

Project roles are managed under **Team** by the project owner:

| Action | Owner | Member | Viewer |
|---|---|---|---|
| Read project work, files and activity | Yes | Yes | Yes |
| Edit tasks, subtasks, comments, attachments, dependencies and milestones | Yes | Yes | No |
| Manage project settings and membership | Yes | No | No |

Only a comment author can delete their comment, and they must still have write access. Only a task creator can move it between projects. Viewers cannot be assigned work. Changing a member to viewer or removing them clears their project assignments. Removed members lose API access immediately on subsequent requests.

Global account administrators are separate from project owners. To make your registered, active account an administrator, run:

```powershell
npm.cmd run db:make-admin --prefix backend -- your@email.com
```

Sign in again. **Administration** allows account search, granting/removing admin privileges and disabling/re-enabling accounts. Access changes revoke the affected account's sessions. Users cannot disable themselves or remove the last active administrator. Regular registration cannot grant administrator privileges. An administrator does not gain access to unrelated private tasks or files.

**Activity** records new task, subtask, comment, file, dependency, milestone, project and membership changes, with actor and time. It is scoped to personal ownership/current project membership. Account administration history is separate and administrator-only. Previous changes before this upgrade are not reconstructed. Records are database-backed; a database operator can change them, so this is not a tamper-proof audit service.

## Timeline / Gantt

Open **Timeline**. Set start and due dates in the task form to show an inclusive calendar-day duration. One dated endpoint shows a one-day bar; undated work is listed under **Unscheduled tasks**. Filter by project, move earlier/later, jump to Today, or choose 4/8/12 weeks. The chart scrolls horizontally inside its panel on small screens.

Click a task bar to open details. Under **Prerequisites**, link tasks in the same project. Arrows connect visible tasks; conflicts are highlighted if a task starts on/before a prerequisite's due date. Dates are manually controlled, with no automatic rescheduling. Circular and cross-project dependencies are rejected. Prerequisites must be completed first; reopen completed dependents before reopening their prerequisite. Remove links before moving a linked task to another project.

Create, edit, complete or delete dated project milestones using the milestone controls. They appear as diamonds in the chart. Task deletion removes its dependency links.

## API additions

All routes below require an authenticated session. Mutations also require `X-Taskflow-Request: 1` and the session's CSRF token. Ordinary bodies are JSON.

| Route | Purpose |
|---|---|
| `GET /api/files?q=&project_id=&task_id=&limit=&offset=` | Scoped file library |
| `POST /api/tasks/:id/attachments?name=filename` | Raw file bytes with `Content-Type: application/octet-stream` |
| `GET /api/files/:id/download`, `DELETE /api/files/:id` | Download/delete attachment |
| `GET /api/analytics?project_id=&from=YYYY-MM-DD&to=YYYY-MM-DD&today=YYYY-MM-DD` | Current statistics and dated report |
| `GET /api/activity?project_id=&limit=&offset=` | Scoped project/personal history |
| `GET /api/admin/users?q=&limit=&offset=` | Admin account list |
| `PATCH /api/admin/users/:id` | `{role: "user" or "admin", disabled: boolean}`; either field may be omitted |
| `GET /api/admin/activity?limit=&offset=` | Account administration history |
| `PATCH /api/projects/:id/members/:userId` | `{role: "member" or "viewer"}` |
| `POST /api/tasks/:id/dependencies` | `{depends_on_id: "task-id"}` |
| `DELETE /api/tasks/:id/dependencies/:dependencyId` | Remove prerequisite |
| `GET /api/milestones?project_id=` | Accessible milestones |
| `POST /api/projects/:id/milestones` | `{title, due_date, done}` |
| `PUT /api/milestones/:id`, `DELETE /api/milestones/:id` | Update/delete milestone |

Task creation/editing now accepts `start_date`. Task responses include `completed_at`, `attachment_count`, `dependency_ids` and `can_edit`. Existing routes remain available.

## Verification

Run `npm.cmd test`, `npm.cmd run test:integration` and `npm.cmd run build`. PostgreSQL integration tests create and remove only randomly named test schemas. They cover upload bytes/download headers, validation/quotas, viewer isolation, project-role changes, dependency ordering/cycles, milestone permissions, completion reporting, admin restrictions and session revocation. See `IMPLEMENTATION-STATUS.md` for the latest execution results and browser verification limits.

Upload handling follows [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) and uses [Express raw body parsing](https://expressjs.com/en/4x/api/#express.raw).

### Gantt presentation update

Tasks are ordered with prerequisites first. Rounded elbow connectors travel through row gaps and around intervening bars; orange links and warning icons identify scheduling conflicts. Hover or keyboard-focus a task to highlight connected work, or use the Connections control to show all links, show only focused links, or hide them. The chart includes month/day headings, shaded weekends, a Today marker, a status legend and task details on hover/focus. These display changes do not move task dates or modify dependencies.
