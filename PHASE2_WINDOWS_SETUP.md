# Group 7 TaskFlow — Phase 2 (Docker Compose) on Windows

This is the Phase 1 app with Docker added; no API/task feature changes. Docker Desktop (WSL 2 Linux containers) and Git are needed.

## 1. Prepare your branch and project

In the existing shared GitHub checkout in VS Code (PowerShell):

```powershell
git status
git switch main
git pull origin main
git switch -c feature/docker-setup
```

Copy the **Phase 2 files** from this ZIP into your existing repository root. Do not copy any `.git` directory. Do not replace your local `backend/.env` or your installed `node_modules`. Commit only after testing.

If Git reports uncommitted changes, commit or resolve them first rather than discarding work.

## 2. Install / start Docker Desktop

Install from https://www.docker.com/products/docker-desktop/ . Enable WSL 2 when prompted, and ensure **Linux containers** are selected. Restart Windows if required. Start Docker Desktop, and wait until the Engine is running.

Verify in VS Code PowerShell:

```powershell
docker --version
docker compose version
docker info
```

If `docker info` cannot reach the engine, open Docker Desktop and wait for it to start.

## 3. Set Docker-only credentials

At the project **root** (beside `compose.yaml`):

```powershell
Copy-Item .env.example .env
notepad .env
```

Replace `CHANGE_ME_TO_A_NEW_LOCAL_PASSWORD` with a new, unique alphanumeric password **for the Docker database only**. Keep the root `.env` secret. This is separate from `backend/.env`, which is for the older Windows-local PostgreSQL setup. The Compose database does **not** reuse your existing pgAdmin data.

For Phase 2 use an alphanumeric password (avoid `@`, `:`, `/`, `#`, `$` in this Compose URI). The `.env` file is ignored by Git and Docker build contexts. Never share its contents.

## 4. Run the whole application

At the project root:

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

The first build can take several minutes. When `db` and `backend` are healthy and `frontend` is up, open:

- App: http://localhost:5173
- Health endpoint: http://localhost:5173/api/health (should show `status: ok` and `database: connected`)

If your previous Vite/Express `npm run dev` server is still running, stop it with **Ctrl+C** before `docker compose up` to free port 5173.

## 5. Verify persistence (new Docker database)

Create a task in the app, edit it, mark it completed, and refresh the browser. Restart containers:

```powershell
docker compose down
docker compose up -d
```

Refresh the app. The task should remain saved in the Docker PostgreSQL named volume.

IMPORTANT: `docker compose down -v` **deletes Docker database data**. Do not run it unless you intentionally want to reset test tasks.

To view the database through a SQL query without exposing a port:

```powershell
docker compose exec db psql -U taskflow -d group7_tasks -c "SELECT id, title, status FROM tasks ORDER BY id DESC;"
```

Your existing Windows PostgreSQL `group7_tasks` data is separate; Docker starts its own empty DB on first launch and runs `backend/sql/schema.sql` automatically.

## 6. Troubleshooting

```powershell
docker compose ps
docker compose logs --tail=80 db
docker compose logs --tail=80 backend
docker compose logs --tail=80 frontend
```

- **Port 5173 already in use:** stop the old `npm run dev` server, then retry.
- **Docker daemon unavailable:** start Docker Desktop and verify Linux/WSL 2 mode.
- **Database auth fails:** root `.env` is read on *first* DB initialization. Changing the password later does not rotate the existing database user's password; do not delete a volume that contains data to fix this. Ask for help if you hit this.
- **Frontend shows blank/errors:** open DevTools Network; API is proxied at `/api` by Nginx. Check logs.
- **Frontend rebuild:** `docker compose up --build -d` after code changes.

## 7. Commit and open a pull request

Check secrets are excluded:

```powershell
git status
git check-ignore .env backend/.env
git add compose.yaml Dockerfile docker/nginx.conf backend/Dockerfile .dockerignore backend/.dockerignore .env.example .gitignore PHASE2_WINDOWS_SETUP.md
git diff --cached --name-only
git commit -m "feat: containerize frontend backend and PostgreSQL with Compose"
git push -u origin feature/docker-setup
```

Then on GitHub open a PR **feature/docker-setup → main**, ask teammates to review, and merge when checks/tests pass. Record the Phase 2 milestone and attach screenshots of `docker compose ps`, the running UI, and persistence test.
