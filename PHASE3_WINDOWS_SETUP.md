# Phase 3 — Automated Testing (Windows)

Run these commands from the **project root** on the `feature/automated-testing` branch.

## 1. Copy these files into your existing repository

Use the **Phase 3 changed-files ZIP**. Copy its contents into your existing `group7-phase1` folder, preserving the folder structure and accepting replacements for `package.json`, `backend/package.json`, `backend/src/app.js`, and `.gitignore`. Do NOT overwrite your local `.env` files, database, or `.git` folder.

## 2. Install packages and update lockfiles

```powershell
npm.cmd install
npm.cmd install --prefix backend
```

This updates the root and backend `package-lock.json` files. Commit both lockfiles along with the tests to make builds reproducible.

## 3. Run Jest unit and Supertest API tests

```powershell
npm.cmd run test:coverage
```

The API uses an **isolated mock database** for these tests. Real personal tasks are never altered. The suite tests actual Express HTTP routes through Supertest, plus task validation in isolation. Coverage is recorded in `backend/coverage/`, excluded from Git. The test command fails if statement coverage is below 75%. Inspect the coverage report rather than claiming a target was met before running it.

## 4. Run Playwright browser tests against Docker

```powershell
docker compose up -d --build
npm.cmd exec -- playwright install chromium
npm.cmd run test:e2e
```

Make sure `http://127.0.0.1:5173` is reachable first. The test creates a unique temporary task, checks task management functionality, and attempts cleanup even if it fails. **Use a development/test database, not production.**

For the HTML report:

```powershell
npm.cmd run test:e2e:report
```

## 5. Save the results to your GitHub feature branch

```powershell
git branch --show-current
git status
git add .
git diff --cached --name-only
```

Ensure `.env` files and generated `coverage/`, `playwright-report/`, `test-results/` are excluded. Then:

```powershell
git commit -m "test: add Jest Supertest and Playwright suites"
git push -u origin feature/automated-testing
```

Open a pull request into `main`. Record the measured coverage value and screenshots/report results in the PR, not unverified estimates.

## Important notes

- The backend Jest/Supertest tests mock DB responses, so they are route/contract tests and **do not replace real PostgreSQL integration tests**. Docker Playwright exercises the real application and PostgreSQL end to end.
- The browser test temporarily creates and deletes a task. Never run this suite against production.
- Phase 4 will execute these tests from GitHub Actions and introduce deployment quality gates.
- Never share or commit `.env` or credentials. Rotate any passwords exposed in prior screenshots.
