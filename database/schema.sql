-- ============================================================
-- BSC Exclusive Tracking — PostgreSQL / Supabase Schema
-- Enterprise Process & Compliance Tracking System
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- AUTHENTICATION & USERS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category    VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  code        VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code        VARCHAR(50) NOT NULL UNIQUE,
  full_name            VARCHAR(150) NOT NULL,
  email                VARCHAR(150) NOT NULL UNIQUE,
  phone                VARCHAR(30),
  username             VARCHAR(50) NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  role_id              UUID NOT NULL REFERENCES roles(id),
  department_id        UUID REFERENCES departments(id) ON DELETE SET NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  profile_image        TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  reporting_manager_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ------------------------------------------------------------
-- LOCATIONS (registered office branches)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  code       VARCHAR(20) NOT NULL UNIQUE,
  address    TEXT,
  latitude   DOUBLE PRECISION,
  longitude  DOUBLE PRECISION,
  status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, location_id)
);

-- ------------------------------------------------------------
-- LIVE LOCATION TRACKING (updated every 30 minutes by clients)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS location_tracks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  accuracy      DOUBLE PRECISION,
  address       TEXT,
  battery_level DOUBLE PRECISION,
  tracked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_tracks_user ON location_tracks(user_id, tracked_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_tracks_time ON location_tracks(tracked_at DESC);

-- ------------------------------------------------------------
-- MODULES & CHECKPOINTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  name          VARCHAR(150) NOT NULL,
  slug          VARCHAR(150) NOT NULL UNIQUE,
  description   TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_department ON modules(department_id);
CREATE INDEX IF NOT EXISTS idx_modules_slug ON modules(slug);

CREATE TABLE IF NOT EXISTS checkpoints (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id                     UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title                         VARCHAR(200) NOT NULL,
  description                   TEXT,
  score                         INTEGER NOT NULL DEFAULT 5,
  is_accuracy_required          BOOLEAN NOT NULL DEFAULT FALSE,
  is_corrective_action_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_photo_required             BOOLEAN NOT NULL DEFAULT FALSE,
  display_order                 INTEGER NOT NULL DEFAULT 0,
  status                        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                    UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by                    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_module ON checkpoints(module_id);

-- ------------------------------------------------------------
-- ASSIGNMENTS & SUBMISSIONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS checkpoint_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date      DATE,
  frequency     VARCHAR(20) NOT NULL DEFAULT 'DAILY' CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY','ONE_TIME')),
  status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, checkpoint_id, assigned_date)
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON checkpoint_assignments(user_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_assignments_checkpoint ON checkpoint_assignments(checkpoint_id);

CREATE TABLE IF NOT EXISTS checkpoint_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id   UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id   UUID REFERENCES checkpoint_assignments(id) ON DELETE SET NULL,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','DRAFT','SUBMITTED','APPROVED','REJECTED','NOT_APPLICABLE','OVERDUE')),
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  review_comment  TEXT,
  auto_approved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_user ON checkpoint_submissions(user_id, submission_date);
CREATE INDEX IF NOT EXISTS idx_submissions_checkpoint ON checkpoint_submissions(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON checkpoint_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON checkpoint_submissions(submission_date);

CREATE TABLE IF NOT EXISTS submission_answers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL UNIQUE REFERENCES checkpoint_submissions(id) ON DELETE CASCADE,
  compliance_status VARCHAR(30) CHECK (compliance_status IN
                    ('FULLY_FOLLOWED','PARTIALLY_FOLLOWED','NOT_FOLLOWED','NO_TRANSACTION','YET_TO_IMPLEMENT')),
  accuracy_status   VARCHAR(30) CHECK (accuracy_status IN ('FULLY_ACCURATE','PARTLY_ACCURATE','INACCURATE','NA')),
  comments          TEXT,
  corrective_action TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES checkpoint_submissions(id) ON DELETE CASCADE,
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  file_size     INTEGER NOT NULL,
  storage_path  TEXT NOT NULL,
  public_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_submission ON evidence_files(submission_id);

-- ------------------------------------------------------------
-- AUDIT & SYSTEM
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   VARCHAR(100),
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(64),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  message    TEXT NOT NULL,
  type       VARCHAR(50) NOT NULL DEFAULT 'info',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  link_url   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS system_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        VARCHAR(100) NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  type       VARCHAR(20) NOT NULL DEFAULT 'string',
  category   VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- SUPERVISOR MODELS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS supervisor_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  designation          VARCHAR(150),
  joining_date         DATE,
  reporting_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  bio                  TEXT,
  specialization       VARCHAR(200),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supervisor_departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supervisor_id, department_id)
);

CREATE TABLE IF NOT EXISTS supervisor_employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id     UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assigned_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date   DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  assignment_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supervisor_id, employee_id)
);

CREATE TABLE IF NOT EXISTS supervisor_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id       UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  assigned_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  responsibility  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supervisor_id, module_id)
);

CREATE TABLE IF NOT EXISTS supervisor_approvals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id       UUID NOT NULL UNIQUE REFERENCES checkpoint_submissions(id) ON DELETE CASCADE,
  supervisor_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','ESCALATED')),
  request_type        VARCHAR(50),
  requested_by_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_date       TIMESTAMPTZ,
  rejection_reason    TEXT,
  supervisor_comments TEXT,
  escalation_level    INTEGER NOT NULL DEFAULT 0,
  escalated_to_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_sup ON supervisor_approvals(supervisor_id, status);
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_status ON supervisor_approvals(status);

CREATE TABLE IF NOT EXISTS supervisor_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     VARCHAR(100),
  details       JSONB,
  ip_address    VARCHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supervisor_activities_sup ON supervisor_activities(supervisor_id, created_at DESC);

-- ------------------------------------------------------------
-- MESSAGING / CHAT
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(150),
  is_group    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER','ADMIN','MEMBER')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  message_type    VARCHAR(20) NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT','IMAGE','FILE','SYSTEM')),
  is_edited       BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

CREATE TABLE IF NOT EXISTS message_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_msg ON message_reads(message_id);
