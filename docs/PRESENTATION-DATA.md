# Group 7 presentation workspace

The demo at http://localhost:5050 includes a fictional, coherent TaskFlow delivery scenario. It adds 18 tasks across three projects, four additional accounts, six text attachments, 54 subtasks, three comments, 15 dependency links and three milestones. The earlier sample work is preserved, giving a fresh demo 24 tasks and five projects in total.

The dataset is saved in `backend/scripts/presentation-data.js` and is added automatically by `npm.cmd run demo`. It is restricted to disposable demo schemas. Repeating the population step in the same schema does not create duplicates. The current running demo has already been populated: refresh the page.

## Projects

| Project | Story | Tasks | Status mix |
|---|---|---:|---|
| TaskFlow Web Experience | Requirements, design, task forms, files, accessibility and preview handover | 6 | 2 completed, 1 in progress, 3 to do |
| TaskFlow Quality Assurance | Test planning, account access, mobile review, reporting, timeline and evidence | 6 | 2 completed, 1 in progress, 3 to do |
| TaskFlow Release & Presentation | Storyline, local release, sample data, demo script, health checks and rehearsal | 6 | 2 completed, 1 in progress, 3 to do |

Each project has all six people: Alex is its owner and the other five are members. Each task has an assignee, a useful description with acceptance criteria, priority, dates and three subtasks. Dependencies follow a clear sequence without overlapping planned prerequisite dates. Each project ends with a named milestone.

Dates are relative to the day a new demo is created, using Australia/Sydney. One QA task is intentionally overdue to demonstrate deadline warnings. The new project chains have no scheduling conflicts. Completed sample tasks receive completion timestamps when created; the analytics chart therefore shows those completions on the setup date, not invented historical completion dates.

## Demo accounts

These are fictional accounts for local presentation use.

| Name | Role in the scenario | Email | Password |
|---|---|---|---|
| Alex Morgan | Project lead; demo administrator | alex@example.test | Alex123 |
| Jamie Chen | UX designer | jamie@example.test | Jamie123 |
| Priya Shah | Frontend developer | priya@example.test | Priya-Demo-2026! |
| Daniel Brooks | Backend developer | daniel@example.test | Daniel-Demo-2026! |
| Sofia Martinez | QA engineer | sofia@example.test | Sofia-Demo-2026! |
| Ethan Wilson | DevOps engineer | ethan@example.test | Ethan-Demo-2026! |

Alex and Jamie's existing passwords are preserved when populating a running demo. Use separate browser profiles or a private window when demonstrating two accounts simultaneously.

## Attached text files

| Project | File | Attached to |
|---|---|---|
| Web Experience | web-experience-brief.txt | Agree user journeys and acceptance criteria |
| Web Experience | task-form-review-checklist.txt | Refine the task form and validation messages |
| Quality Assurance | acceptance-test-matrix.txt | Define the acceptance test matrix |
| Quality Assurance | accessibility-review-notes.txt | Review keyboard and mobile interaction findings |
| Release & Presentation | local-release-checklist.txt | Prepare the local release checklist |
| Release & Presentation | presentation-run-of-show.txt | Prepare the feature demonstration script |

Files contain practical briefs, checklists, role/permission test cases, run instructions and an eight-minute presentation plan. They are labelled as presentation samples rather than evidence of real completed work.

## Suggested presentation

1. Open **Projects** and introduce the three workstreams.
2. Open **Team**, select **TaskFlow Web Experience**, and show the six assigned people.
3. Open **Refine the task form and validation messages**. Show its acceptance criteria, completed subtask, remaining steps, comment and attachment.
4. Open **Files**, filter by Web Experience, and download the brief.
5. Open **Timeline**, select Web Experience and follow the six-task dependency chain to its milestone. Hover a task to highlight its connections.
6. Open **Kanban** and show the status mix. Avoid completing a task with unfinished prerequisites; use a subtask or comment for a safe live edit.
7. Open **Analytics**, select the same project and explain the 2/6 completion rate, date report and CSV export.
8. Switch to Quality Assurance to show the intentionally overdue review and notification.
9. Finish with Release & Presentation and download the run-of-show or local-release checklist.

Filter by these new projects to keep the presentation focused. Older sample projects remain available.

## Persistence

The current demo changes appear after refresh; no restart is needed. On normal demo shutdown the temporary database schema is removed. Restarting `npm.cmd run demo` recreates this saved presentation scenario with new relative dates; ad hoc edits made during a demo are not preserved. The regular app at http://localhost:5173 uses a separate persistent database and is not modified by this setup.

## Verification

The populated database was checked for 18 new tasks, 6 text attachments with intact bytes, 54 subtasks, valid project-member assignments and zero dependency date conflicts in the new projects. All four new passwords were verified against their stored hashes. Repeating the seed returned without adding duplicates.
