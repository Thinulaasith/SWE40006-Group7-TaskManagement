# Demonstration walkthrough

Run `npm.cmd run demo` from the root and visit http://localhost:5050. This creates disposable, isolated sample data. Sign in as `alex@example.test` with `Alex123`, or `jamie@example.test` with `Jamie123`.

1. **Dashboard**: show live counts and click a summary card. Search for “release”; change priority and project filters. Clear the filters.
2. **Task CRUD**: create a task, select a project and assignee, add a deadline, edit its title, mark complete and reopen. Delete only the temporary task you created and show the confirmation dialog.
3. **Kanban**: drag a card using its “Move task” handle into another status column. Show the persisted status after refresh. Demonstrate the dropdown alternative for keyboard and touch use.
4. **Calendar**: show today's agenda and the upcoming tasks. Select another date, move to another month, then click Today.
5. **Projects**: create a project with a description/color. Open its tasks, then edit the project. Explain that project deletion removes the project's tasks for all members.
6. **Team**: select a project you own and add `jamie@example.test` if not already a member. Assign a project task to Jamie.
7. **Subtasks/comments**: open “Prepare launch checklist,” add a step, check it off, and add a comment. Explain that comments can only be deleted by their author.
8. **Notifications**: show deadline notices, then mark them read. Assignments and comments produce stored notifications for relevant users.
9. **Settings**: edit your display name/bio, switch to dark mode, save, and refresh to show persistence. Change password only if you want to change this disposable demo account's password.
10. **Permissions**: use a private/incognito browser window to sign in as `jamie@example.test` with password `Jamie123`. Jamie sees project work but not Alex's personal tasks and cannot manage project members. Keep accounts in separate browser profiles because tabs share session cookies.
11. **Responsive and keyboard**: narrow the window to phone width, open the navigation drawer, use Tab through a dialog and Escape to close it.
12. **Engineering**: run `npm.cmd test` and `npm.cmd run test:integration`. Show Docker/CI files and health checks. If Docker Desktop is running, use the separate stack to demonstrate Prometheus following `docs/DEPLOYMENT.md`.

Stop the demo using Ctrl+C. Its schema is removed on graceful shutdown, and the ordinary application database tables remain untouched. Never use the sample credentials for your real account.

## New version walkthrough

Restart an older demo before running this version. Alex is a demo administrator.

1. **Files**: download the seeded launch brief, upload a small image or document to a task, search it and verify it is still present after refresh.
2. **Analytics**: inspect status and project charts, daily completions, the data table and CSV export. Complete another task and refresh the report.
3. **Timeline**: inspect seeded start/due dates, prerequisite arrows and the Release day milestone. Change a task date, add a milestone and test cycle rejection.
4. **Team**: change Jamie to viewer and verify Jamie can read/download but cannot change project work. Change back to member to continue editing.
5. **Administration**: inspect accounts and administration history. Disable/re-enable Jamie and verify the existing Jamie session is revoked.
6. **Activity**: confirm new upload, task, dependency and membership events are recorded.

See `NEW-FEATURES.md` for exact permissions and report definitions.

## Presentation dataset

The demo now includes three additional TaskFlow delivery projects with 18 tasks, six text attachments, four additional team members, 54 subtasks, comments, dependencies and three milestones. The running demo has been populated and future demo starts recreate the scenario. See [PRESENTATION-DATA.md](PRESENTATION-DATA.md) for the account details and presentation walkthrough. Database checks confirmed valid assignments, intact attachments and no scheduling conflicts in the new project chains.
