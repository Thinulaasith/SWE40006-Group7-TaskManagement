# Group 7 — TaskFlow (Phase 1)

A working full-stack Task Management Web Application with **React (Vite)**, **Node.js/Express**, and **PostgreSQL**.

> Phase 1 intentionally does **not** include Docker, GitHub Actions, Render deployments, Playwright or Grafana. Those are Phase 2 onward.

## What works
- Create, list, edit, delete and complete tasks
- Task title, optional description, priority, status and due date
- Filter by status and search by title/description
- Dashboard counts for total, todo, in-progress and done
- Persistent PostgreSQL storage; parameterised queries and input validation
- Health check that tests database connectivity

## Windows setup (PowerShell)

### 1. Install prerequisites
Install Node.js **LTS** (https://nodejs.org/) and PostgreSQL (https://www.postgresql.org/download/windows/). During PostgreSQL installation, remember the password for the `postgres` user. Install VS Code if desired. Ensure `node`, `npm` and `psql` commands are available (restart the terminal after installation).

### 2. Create a database
In pgAdmin 4: open pgAdmin → Databases → Create → Database → Name: `group7_tasks` → Save.

Alternatively, if `psql` is in your PATH:
```powershell
psql -U postgres -h localhost -c "CREATE DATABASE group7_tasks;"
```

### 3. Create database tables
From the extracted project root, in PowerShell (if `psql` is on PATH):
```powershell
psql -U postgres -h localhost -d group7_tasks -f backend/sql/schema.sql
```

Or in pgAdmin: click the **group7_tasks** database → Query Tool → open `backend/sql/schema.sql` → Execute. The script is safe to run again.

### 4. Configure backend connection
```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```
Change `YOUR_PASSWORD` to your PostgreSQL password. If the password contains reserved URL characters (`@`, `#`, `:`, `/`, `%`, `?`, etc.) URL-encode them in `DATABASE_URL` (or set a simple development-only password). `backend/.env` is gitignored; **never commit credentials**.

### 5. Install dependencies
```powershell
npm install
npm run install:all
```

### 6. Start frontend + API together
```powershell
npm run dev
```
Open **http://localhost:5173**. The API health endpoint is **http://localhost:5000/api/health**; it should show `{"status":"ok","database":"connected"}`.

### 7. Test the UI
1. Click **New task**, enter a title, priority, due date and click **Create task**.
2. Create another task, edit it using the pencil, and complete it using the circle/check icon.
3. Use status filters and search. Refresh the browser: tasks should persist.
4. Delete a task and confirm that it disappears after refresh.

## Project layout
```
group7-phase1/
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── sql/schema.sql
│   └── src/{app.js,db.js,server.js}
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/{App.jsx,main.jsx,styles.css}
├── .gitignore
├── package.json
└── README.md
```

## REST endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Database health check |
| GET | `/api/tasks` | All tasks; optional `?status=todo&priority=high` |
| POST | `/api/tasks` | Add task |
| PUT | `/api/tasks/:id` | Replace task data |
| DELETE | `/api/tasks/:id` | Delete task |

Example JSON body for POST/PUT:
```json
{"title":"Prepare demo","description":"Create project demo","priority":"high","status":"todo","due_date":"2026-11-10"}
```

## Troubleshooting
- **API cannot connect to PostgreSQL:** Check PostgreSQL service is running and `DATABASE_URL` user/password/database name are correct. Verify `group7_tasks` exists.
- **relation tasks does not exist:** Execute `backend/sql/schema.sql` against the `group7_tasks` database.
- **`psql` not recognised:** Use pgAdmin Query Tool or add PostgreSQL `bin` directory (e.g. `C:\Program Files\PostgreSQL\<version>\bin`) to PATH.
- **Port in use:** Close processes already listening on ports 5000 or 5173; these are the configured local ports.
- **`npm` blocked by PowerShell policy:** Use `npm.cmd` instead of `npm` or open Command Prompt.
- **Frontend fails to fetch tasks:** Keep both processes running with `npm run dev`; verify http://localhost:5000/api/health and that backend startup did not show connection errors.

## Next phases
Phase 2: Docker + Docker Compose. Phase 3: Jest/Supertest + Playwright. Phase 4: GitHub Actions. Phase 5: Render staging and production. Phase 6: metrics and Grafana monitoring.
