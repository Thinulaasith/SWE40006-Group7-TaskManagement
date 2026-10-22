# Implementation status

Final implementation checkpoint: 20 October 2026 (Australia/Sydney).

## Delivered in this workspace

- Registration, login, logout, server-side sessions, profile settings and password changes.
- Persistent PostgreSQL task APIs, priorities, statuses, deadlines and personal-task isolation.
- Projects, project membership, task assignment and permission checks.
- Dashboard statistics, searchable/filterable task list, drag-and-drop Kanban and calendar.
- Subtasks, comments, deadline warnings and stored in-app notifications.
- Responsive layouts and light, dark and system themes.
- Unit and PostgreSQL integration tests.
- Docker configuration, GitHub Actions validation and manual image-release workflows.
- Health endpoints, protected Prometheus metrics, monitoring configuration and an isolated demo.

Deployment files only were requested. Nothing has been published or hosted.

## New feature expansion: 20 October 2026

Implemented task attachments and a searchable file library; analytics with charts, completion timestamps and CSV reports; project viewer roles, global account administration and scoped activity history; Timeline/Gantt with date ranges, dependencies, conflict indicators and milestones. Navigation, task dialogs, read-only controls, light/dark styling and responsive layouts are connected. See [NEW-FEATURES.md](NEW-FEATURES.md) for usage and exact limits.

Feature verification results:

- Six backend unit tests and four frontend unit tests passed.
- Nineteen reported PostgreSQL integration tests passed (17 scenarios plus two parent tests), on native PostgreSQL and again inside the rebuilt Linux container.
- Production frontend builds passed locally and in Docker.
- Server-render smoke checks passed for Timeline, Files, Analytics, Administration, Activity, Team, Dependencies and TaskModal. These checks do not test browser interactions or layout.
- Native additive migration passed; all four original unclaimed tasks remain intact.
- Docker rebuild/migration completed; app, database and monitoring are healthy.
- Deployment smoke checks passed for frontend assets, database health, access protection, metrics, Prometheus scraping and alert rules.
- Documentation, demo seed data and CI now include the new features and integration tests.

Browser interaction and visual checks for the new screens remain outstanding. The screenshot review covers the previous version only. No public deployment or remote workflow run was performed.

The updated Docker app is running at http://localhost:8080 with its separate persistent database. For native development, run the migration and restart the servers; for the demo, stop the old demo from its original terminal and run npm.cmd run demo. Your backend/.env was preserved.

## Previous-version verification

- Six backend unit tests and three frontend unit tests passed.
- Eleven PostgreSQL integration scenarios passed (12 reported tests including their parent), both on native PostgreSQL and inside the built Linux container. These include separation of demo and application session cookies.
- The production frontend build passed.
- Docker Compose configuration validation passed.
- The Docker image built successfully; PostgreSQL and the application reported healthy, and migrations completed successfully.
- The deployment smoke check passed: database readiness, built frontend/assets, security headers, unauthenticated API protection and authenticated metrics.
- Prometheus successfully scraped the application's metrics. Both alert rules loaded; `promtool` validated the configuration and rules.
- Dependency audits reported zero known vulnerabilities for backend production dependencies and frontend dependencies at verification time.
- Native API health on port 5000 and frontend on port 5173 returned HTTP 200.
- The application database still contains all four original, unclaimed tasks.
- Earlier browser checks exercised login, Kanban movement, projects, assignment, subtasks, comments, calendar, settings and notification read state.
- Visual review used screenshots of the desktop dashboard, Kanban, calendar and agenda, task creation form, team, dark settings, dark task-details dialog and narrow dashboard/settings. No obvious overlapping controls or horizontal clipping were visible in those views. Subtask completion counts matched the checked items; the settings screenshot showed a successful save confirmation.

Docker Desktop was started and the local Docker/monitoring checks are now complete. The local stack is available at http://localhost:8080 with monitoring at http://localhost:9090. It uses a separate database from the native development app. Stop the stack with `npm.cmd run docker:down`; this preserves its data volumes.

## Outstanding verification

- Visual review was based on screenshots. It does not establish new interaction or persistence test results. The narrow navigation drawer and true phone-width behavior still require verification. Earlier interaction checks and automated test results provide the functional evidence recorded above.
- GitHub workflows are prepared but have not run remotely. The build, integration, container and monitoring steps were exercised locally. Publishing or running GitHub Actions requires a repository and is outside the requested deployment-files-only scope.

Stop a running demo with Ctrl+C in its original terminal so it can remove its temporary schema. Never remove application tables for demo cleanup.

## Run

Keep PostgreSQL running, then run from the project root:

```powershell
npm.cmd run db:init
npm.cmd run dev
```

Open http://localhost:5173 and register an account. Existing `backend/.env` configuration was preserved. If the development servers are already running, open the URL without starting duplicates.

To associate the original tasks with your registered account:

```powershell
npm.cmd run db:claim-legacy --prefix backend -- your@email.com
```

See `README.md`, `docs/DEMO.md` and `docs/DEPLOYMENT.md` for usage and operational details.

## Gantt presentation update

Redesigned task bars, month/day axis, weekend shading, Today marker and milestone styling. Replaced diagonal curves with rounded orthogonal connectors routed through row gaps; prerequisite ordering, connection focus/hide controls and conflict icons improve readability. Seven frontend tests pass, including connector geometry at all zoom levels; the production build and server-render check pass. Visual and interactive verification of the updated chart remains outstanding. Refresh the running demo to load the rebuilt frontend; no database migration or demo reset is needed.

## Presentation dataset

The demo now includes three additional TaskFlow delivery projects with 18 tasks, six text attachments, four additional team members, 54 subtasks, comments, dependencies and three milestones. The running demo has been populated and future demo starts recreate the scenario. See [PRESENTATION-DATA.md](PRESENTATION-DATA.md) for the account details and presentation walkthrough. Database checks confirmed valid assignments, intact attachments and no scheduling conflicts in the new project chains.
