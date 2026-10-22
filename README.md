# Taskflow - Group 7

A task management app with React, Express and PostgreSQL. Accounts, project membership and persisted data power the dashboard, task list, Kanban board and calendar.

## Run on your computer

Keep PostgreSQL running. Your existing `backend/.env` is preserved.

From the project folder in VS Code:

```powershell
npm.cmd run db:init
npm.cmd run dev
```

Open **http://localhost:5173** and choose **Create an account**. Use a password with at least 12 characters. Later visits use the same account. Stop the servers with **Ctrl+C**.

The schema update has already been applied on this computer. Repeating `db:init` is safe and does not delete tasks.

### Import your existing tasks after registering

The original shared tasks remain in PostgreSQL. They are not automatically exposed to every new account. Register your account first, then run this once with the email you registered:

```powershell
npm.cmd run db:claim-legacy --prefix backend -- your@email.com
```

Refresh the dashboard. The command imports only unclaimed personal tasks; it does not change tasks already owned by another account. A JSON backup of the four original tasks was saved under `tmp/backups/` before migration. That folder is ignored by Git and Docker.

### First-time setup elsewhere

1. Install Node.js 24 and PostgreSQL.
2. Create a database, for example `group7_tasks`.
3. Create `backend/.env` (keep the file if already configured):

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/group7_tasks
PORT=5000
FRONTEND_ORIGIN=http://localhost:5173
```

4. Run:

```powershell
npm.cmd ci
npm.cmd ci --prefix backend
npm.cmd ci --prefix frontend
npm.cmd run db:init
npm.cmd run dev
```

Backend only: `npm.cmd run start:api`. Frontend build: `npm.cmd run build`.

## New version: files, analytics, administration and timeline

See [the new feature guide](docs/NEW-FEATURES.md) for usage, administrator setup, API additions and limits. Run the migration and restart your servers to load this version.

## Features

- Registration, sign-in, sign-out, and persistent server-side sessions.
- Profile name/bio, light/dark/device theme, notification preferences, and password changes that revoke other sessions.
- Personal tasks plus shared projects with owner-managed team membership.
- Create, edit, delete, complete and reopen tasks; priorities, deadlines and project-member assignment.
- A dashboard with counts that refresh every 15 seconds while the page is visible, and when the browser window regains focus.
- Task list with search, status, priority, project and assignee filters; sorting by newest, due date or priority.
- Drag-and-drop Kanban status columns. Use the status dropdown on touch screens or with a keyboard. Dragging changes status; manual ordering within a column is not supported.
- Monthly calendar with date selection, month navigation and a selected-day agenda. Undated tasks stay in the task list/board.
- Task details with subtask checklists and comments. Click a task title or its details link.
- Stored in-app notifications for assignments, comments and approaching/overdue deadlines; mark one or all read.
- Task attachments with a searchable, project-filtered file library and authorized downloads.
- Progress charts, dated completion reports and CSV export.
- Project viewers, account administration, session revocation and scoped activity history.
- Timeline/Gantt with start/end dates, task dependencies and project milestones.
- Responsive navigation, visible focus indicators, modal focus trapping and Escape-to-close.

### Sharing rules

Personal tasks are visible only to their owner. A project's owners and members can read, edit, complete, delete and discuss its tasks. Viewers can read and download only. Only the task creator can move a task to another project or make it personal. Only the project owner can edit/delete the project or add/remove members. Removed members immediately lose API access and their task assignments are cleared. Project deletion also deletes its tasks, subtasks, comments and task notifications after confirmation.

To add a teammate: ask them to register, open **Team**, select a project you own and enter their exact registered email. No email invitation is sent. Members cannot discover unrelated users or projects through list APIs. Comment deletion is restricted to its author.

Deadline notifications are synchronized while an authenticated user is using the app. They use the browser's current local date and are deduplicated per task/deadline/warning type. They are in-app notifications, not email, push or background reminders when everyone is offline. The notification screen shows the latest 100 accessible notifications. Disable future notifications in account settings; existing notifications remain available.

## Automated checks

```powershell
npm.cmd test
npm.cmd run test:integration
npm.cmd run build
```

`npm test` runs backend validation/auth boundary/password tests and frontend filter/sort/deadline tests. Integration tests use real PostgreSQL and cover registration, sessions, profiles, password changes, CRUD, team permissions, assignment, subtasks, comments, notifications, membership revocation, migrations and monitoring.

Integration tests create a uniquely named `taskflow_test_*` schema and remove only that schema. Your regular tables and tasks are not modified. The database role must be allowed to create schemas. Tests run sequentially within their isolated schema.

## Demonstration

```powershell
npm.cmd run demo
```

Open **http://localhost:5050**. Demo accounts:

- `alex@example.test` - project owner.
- `jamie@example.test` - project member.
- Alex password: `Alex123`. Jamie password: `Jamie123`.

These credentials exist only in the disposable demo schema and are never created in your real application tables. The demo is bound to the local computer. Press **Ctrl+C** to stop it and remove its demo schema. An abnormal OS/process termination can leave a `taskflow_demo_*` schema; it is isolated and can be removed by a database administrator after confirming no demo process is using it.

Follow [the demo walkthrough](docs/DEMO.md) to demonstrate the checklist.

## Docker, CI/CD and monitoring

See [deployment instructions](docs/DEPLOYMENT.md). Deployment files are prepared; nothing has been published or hosted.

```powershell
npm.cmd run docker:setup
npm.cmd run docker:up
```

Docker Desktop must be running. Open **http://localhost:8080**. This stack has its own PostgreSQL volume and does not contain your native PostgreSQL tasks. Register a new account in that stack. `docker:down` stops containers without deleting the data volume.

Check the running stack with `npm.cmd run docker:verify`. When the optional monitoring profile is running, use `npm.cmd run docker:verify -- --monitoring` to also check the Prometheus scrape and alert rules.

GitHub Actions definitions are included for automatic tests/build checks and manual publication of a tested image to GitHub Container Registry. Running those workflows requires putting this folder in a GitHub repository; this downloaded folder currently has no `.git` repository. No workflow has been run remotely.

## API overview

All task/project/account data APIs require a session. Registration/login return `{user, csrf}` and an HttpOnly cookie. `/api/auth/me` restores the current session and CSRF value. Mutations require `X-Taskflow-Request: 1`, JSON bodies when a body is present, and `X-CSRF-Token` for authenticated requests. Browser requests must come from `FRONTEND_ORIGIN`. Do not store the session cookie in local storage.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Create account / sign in |
| GET | `/api/auth/me` | Current user and CSRF token |
| POST | `/api/auth/logout` | Revoke current session |
| PATCH | `/api/auth/profile` | Name, bio, theme, notification preference |
| POST | `/api/auth/password` | `current_password`, `new_password`; rotates sessions |
| GET, POST | `/api/projects` | List accessible projects / create project |
| PUT, DELETE | `/api/projects/:id` | Owner manages project |
| GET, POST | `/api/projects/:id/members` | List members / owner adds registered email |
| DELETE | `/api/projects/:id/members/:userId` | Owner removes member |
| GET, POST | `/api/tasks` | List accessible tasks / create task |
| GET | `/api/tasks/stats` | Accessible task counts |
| GET, PUT, PATCH, DELETE | `/api/tasks/:id` | Read / replace / partially update / delete |
| GET | `/api/tasks/:id/details` | Subtasks and comments |
| POST | `/api/tasks/:id/subtasks` | Add `{title}` |
| PATCH, DELETE | `/api/tasks/:id/subtasks/:subId` | Toggle `{done}` / delete |
| POST | `/api/tasks/:id/comments` | Add `{body}` |
| DELETE | `/api/tasks/:id/comments/:commentId` | Author deletes own comment |
| POST | `/api/notifications/sync` | Synchronize warnings with `{date: YYYY-MM-DD}` |
| GET | `/api/notifications` | Latest 100 accessible notifications |
| PATCH | `/api/notifications/:id`, `/api/notifications/read-all` | Mark read |
| GET | `/api/health/live`, `/api/health` | Process / database readiness |
| GET | `/api/metrics` | Prometheus metrics with configured bearer token |

Task fields: `title` (1-150 characters), `description` (up to 2000), `priority` (`low`, `medium`, `high`), `status` (`todo`, `in_progress`, `done`), `due_date` (real YYYY-MM-DD date or null), `project_id` and `assignee_id` (string IDs or null). PUT resets omitted optional fields; PATCH preserves them. Extra body fields are ignored. SQL uses parameters and field allowlists. IDs are strings to preserve bigint precision.

List filters: `status`, `priority`, literal case-insensitive `q`, `project_id` (ID or `personal`), `assignee_id`, optional `limit` (1-100), `offset`. Responses remain arrays. Unpaginated lists support the current frontend; large installations should add paginated UI loading.

Errors have an `error` string. Expect 400 validation, 401 unauthenticated, 403 forbidden/CSRF, 404 missing or inaccessible records, 409 conflicts, 413 oversized bodies, 415 content type, 429 rate limits, 500 unexpected failures, and 503 failed health checks.

## Security and operational notes

Passwords use salted scrypt; raw session tokens are random and only their SHA-256 hashes are stored. Sessions expire after seven days. Auth throttling is persisted in PostgreSQL. Production uses Secure cookies unless explicitly disabled for the local HTTP Docker demo. HTTPS, trusted proxy configuration and a proper public origin are required before hosting publicly. Account email is currently read-only after registration; email verification, forgotten-password recovery and MFA are not implemented.

See the implementation references in [deployment instructions](docs/DEPLOYMENT.md).
