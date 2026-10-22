CREATE TABLE IF NOT EXISTS tasks (
 id BIGSERIAL PRIMARY KEY,
 title VARCHAR(150) NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
 status VARCHAR(15) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
 due_date DATE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
