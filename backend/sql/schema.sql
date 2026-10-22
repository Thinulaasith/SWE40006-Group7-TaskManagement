CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(80) NOT NULL,
 email VARCHAR(254) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 bio VARCHAR(500) NOT NULL DEFAULT '',
 theme VARCHAR(10) NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
 notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash VARCHAR(64) PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf VARCHAR(64) NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_limits (key VARCHAR(64) PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS projects (
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 description VARCHAR(2000) NOT NULL DEFAULT '',
 color VARCHAR(7) NOT NULL DEFAULT '#6256ec',
 owner_id BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_members (
 project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role VARCHAR(10) NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
 joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (project_id,user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members(user_id);
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
-- Additive migration: existing tasks remain intact and unclaimed until an administrator imports them.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks(assignee_id);
CREATE TABLE IF NOT EXISTS subtasks (
 id BIGSERIAL PRIMARY KEY,
 task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 title VARCHAR(150) NOT NULL,
 done BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subtasks_task_idx ON subtasks(task_id);
CREATE TABLE IF NOT EXISTS comments (
 id BIGSERIAL PRIMARY KEY,
 task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 author_id BIGINT NOT NULL REFERENCES users(id),
 body VARCHAR(2000) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comments_task_idx ON comments(task_id);
CREATE TABLE IF NOT EXISTS notifications (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
 message VARCHAR(500) NOT NULL,
 event_key VARCHAR(200),
 read_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (user_id,event_key)
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);

-- Version 2 additions: safe to run repeatedly on an existing database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check CHECK (role IN ('owner','member','viewer'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_date_order;
ALTER TABLE tasks ADD CONSTRAINT tasks_date_order CHECK (start_date IS NULL OR due_date IS NULL OR start_date<=due_date);
CREATE OR REPLACE FUNCTION taskflow_completion_date() RETURNS TRIGGER AS $$
BEGIN
 IF NEW.status='done' THEN
  IF TG_OP='INSERT' THEN NEW.completed_at=NOW();
  ELSIF OLD.status<>'done' THEN NEW.completed_at=NOW();
  ELSE NEW.completed_at=OLD.completed_at;
  END IF;
 ELSE NEW.completed_at=NULL;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS taskflow_completion ON tasks;
CREATE TRIGGER taskflow_completion BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION taskflow_completion_date();
CREATE INDEX IF NOT EXISTS tasks_completed_idx ON tasks(completed_at);
CREATE TABLE IF NOT EXISTS attachments (
 id BIGSERIAL PRIMARY KEY,
 task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 uploader_id BIGINT NOT NULL REFERENCES users(id),
 name VARCHAR(180) NOT NULL,
 mime VARCHAR(100) NOT NULL,
 size INTEGER NOT NULL CHECK (size>0 AND size<=10485760),
 data BYTEA NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (octet_length(data)=size)
);
CREATE INDEX IF NOT EXISTS attachments_task_idx ON attachments(task_id);
CREATE TABLE IF NOT EXISTS task_dependencies (
 task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 depends_on_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 PRIMARY KEY (task_id,depends_on_id),
 CHECK (task_id<>depends_on_id)
);
CREATE INDEX IF NOT EXISTS dependencies_predecessor_idx ON task_dependencies(depends_on_id);
CREATE TABLE IF NOT EXISTS milestones (
 id BIGSERIAL PRIMARY KEY,
 project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 title VARCHAR(150) NOT NULL,
 due_date DATE NOT NULL,
 done BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS milestones_project_idx ON milestones(project_id);
-- Keep identifiers after deletion so activity history remains useful.
CREATE TABLE IF NOT EXISTS activity (
 id BIGSERIAL PRIMARY KEY,
 actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 project_id BIGINT,
 owner_id BIGINT,
 task_id BIGINT,
 action VARCHAR(80) NOT NULL,
 detail VARCHAR(500) NOT NULL,
 admin_only BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_project_idx ON activity(project_id,id DESC);
CREATE INDEX IF NOT EXISTS activity_owner_idx ON activity(owner_id,id DESC);
