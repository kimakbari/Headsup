-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Members ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  initials      VARCHAR(3)   NOT NULL,
  color         VARCHAR(7)   NOT NULL DEFAULT '#E07A5F',
  is_admin      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Teams ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7)   NOT NULL DEFAULT '#E07A5F',
  icon       VARCHAR(8)   NOT NULL DEFAULT '👥',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '#E07A5F';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS icon VARCHAR(8) NOT NULL DEFAULT '👥';

-- ─── Team members (roster + default permissions) ─────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  team_id     UUID    NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
  member_id   UUID    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  perm_view   BOOLEAN NOT NULL DEFAULT TRUE,
  perm_edit   BOOLEAN NOT NULL DEFAULT FALSE,
  perm_create BOOLEAN NOT NULL DEFAULT FALSE,
  perm_delete BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (team_id, member_id)
);

-- ─── Projects ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  deadline    DATE,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Project members (per-project permission overrides) ──────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id   UUID    NOT NULL REFERENCES members(id)  ON DELETE CASCADE,
  perm_view   BOOLEAN NOT NULL DEFAULT TRUE,
  perm_edit   BOOLEAN NOT NULL DEFAULT FALSE,
  perm_create BOOLEAN NOT NULL DEFAULT FALSE,
  perm_delete BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (project_id, member_id)
);

-- ─── Tasks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       VARCHAR(300) NOT NULL,
  deadline    DATE,
  priority    VARCHAR(10)  NOT NULL DEFAULT 'Medium'
                CHECK (priority IN ('Low', 'Medium', 'High')),
  status      VARCHAR(20)  NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo','doing','done','pending','approval','cancelled')),
  description TEXT,
  weighted    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Task owners (many-to-many; a task can have any number of owners) ─────────
CREATE TABLE IF NOT EXISTS task_owners (
  task_id   UUID NOT NULL REFERENCES tasks(id)   ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, member_id)
);

-- ─── Subtasks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subtasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      VARCHAR(300) NOT NULL,
  done       BOOLEAN      NOT NULL DEFAULT FALSE,
  weight     INTEGER      NOT NULL DEFAULT 0,
  position   INTEGER      NOT NULL DEFAULT 0,
  deadline   DATE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS deadline DATE;

-- ─── Subtask assignees (many-to-many; drawn from the parent task's owners) ────
CREATE TABLE IF NOT EXISTS subtask_assignees (
  subtask_id UUID NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id)  ON DELETE CASCADE,
  PRIMARY KEY (subtask_id, member_id)
);

-- ─── Attachments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Activity log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id   UUID         REFERENCES members(id) ON DELETE SET NULL,
  member_name VARCHAR(100),
  action      TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Task comments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id   UUID         REFERENCES members(id) ON DELETE SET NULL,
  member_name VARCHAR(100),
  body        TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_task_owners_task   ON task_owners(task_id);
CREATE INDEX IF NOT EXISTS idx_task_owners_member ON task_owners(member_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task    ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtask_assignees_subtask ON subtask_assignees(subtask_id);
CREATE INDEX IF NOT EXISTS idx_subtask_assignees_member  ON subtask_assignees(member_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_task    ON activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_projects_team    ON projects(team_id);
