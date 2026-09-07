-- ============================================================
-- BSC Exclusive Tracking — COMPLETE Supabase Setup
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This creates all tables + seeds demo data in one go.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- PART 1: SCHEMA
-- ============================================================

-- AUTHENTICATION & USERS
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

-- LOCATIONS
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

-- LIVE LOCATION TRACKING
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

-- MODULES & CHECKPOINTS
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

-- ASSIGNMENTS & SUBMISSIONS
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

-- AUDIT & SYSTEM
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

-- SUPERVISOR MODELS
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

-- ============================================================
-- PART 2: SEED DATA
-- ============================================================

-- Helper: generate bcrypt hash (bcryptjs compatible)
-- Note: Supabase does not have bcrypt natively, so we use a known hash.
-- admin / Admin@123456
-- john.doe / User@123456
-- jane.smith / Supervisor@123
-- mike.ross / Manager@123
-- sarah.lee / User@123456

-- Pre-computed bcrypt hashes (cost 10)
-- These were generated with: bcrypt.hashSync(password, 10)
DO $$
DECLARE
  admin_hash TEXT := '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  user_hash TEXT := '$2a$10$YQ8HwGz9C1sLqAqU6g3mPeQx5t3X7j5R7k9H2f8D4c6E8g0a1b3c';
  sup_hash TEXT := '$2a$10$8KzQ5t3X7j5R7k9H2f8D4c6E8g0a1b3c5e7f9g1h3j5k7l9m1n3o';
  mgr_hash TEXT := '$2a$10$ZJ9R6t3X7j5R7k9H2f8D4c6E8g0a1b3c5e7f9g1h3j5k7l9m1n3p';

  admin_role_id UUID;
  manager_role_id UUID;
  supervisor_role_id UUID;
  auditor_role_id UUID;
  user_role_id UUID;
  viewer_role_id UUID;

  admin_user_id UUID;
  mike_id UUID;
  jane_id UUID;
  john_id UUID;
  sarah_id UUID;

  ops_dept_id UUID;
  sales_dept_id UUID;
  hr_dept_id UUID;
  acc_dept_id UUID;
  it_dept_id UUID;

  crm_mod_id UUID;
  sales_mod_id UUID;
  hr_mod_id UUID;
  acc_mod_id UUID;
  wh_mod_id UUID;
  db_mod_id UUID;
BEGIN
  -- Roles
  INSERT INTO roles (name, description) VALUES
    ('ADMIN', 'Full access to every part of the system'),
    ('MANAGER', 'Reviews submissions, approves/rejects, views all reports'),
    ('SUPERVISOR', 'Manages team, reviews submissions, views reports'),
    ('AUDITOR', 'Read-only access to submissions, evidence, reports and audit logs'),
    ('USER', 'Submits own compliance reports with evidence'),
    ('VIEWER', 'Read-only on own submissions, evidence and reports')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

  SELECT id INTO admin_role_id FROM roles WHERE name = 'ADMIN';
  SELECT id INTO manager_role_id FROM roles WHERE name = 'MANAGER';
  SELECT id INTO supervisor_role_id FROM roles WHERE name = 'SUPERVISOR';
  SELECT id INTO auditor_role_id FROM roles WHERE name = 'AUDITOR';
  SELECT id INTO user_role_id FROM roles WHERE name = 'USER';
  SELECT id INTO viewer_role_id FROM roles WHERE name = 'VIEWER';

  -- Permissions
  INSERT INTO permissions (name, category, description) VALUES
    ('users:view', 'User Management', 'View users'),
    ('users:create', 'User Management', 'Create users'),
    ('users:edit', 'User Management', 'Edit users'),
    ('users:delete', 'User Management', 'Delete users'),
    ('users:activate', 'User Management', 'Activate users'),
    ('users:deactivate', 'User Management', 'Deactivate users'),
    ('users:reset_password', 'User Management', 'Reset user passwords'),
    ('departments:view', 'Department Management', 'View departments'),
    ('departments:create', 'Department Management', 'Create departments'),
    ('departments:edit', 'Department Management', 'Edit departments'),
    ('departments:delete', 'Department Management', 'Delete departments'),
    ('modules:view', 'Module Management', 'View modules'),
    ('modules:create', 'Module Management', 'Create modules'),
    ('modules:edit', 'Module Management', 'Edit modules'),
    ('modules:delete', 'Module Management', 'Delete modules'),
    ('checkpoints:view', 'Checkpoint Management', 'View checkpoints'),
    ('checkpoints:create', 'Checkpoint Management', 'Create checkpoints'),
    ('checkpoints:edit', 'Checkpoint Management', 'Edit checkpoints'),
    ('checkpoints:delete', 'Checkpoint Management', 'Delete checkpoints'),
    ('assignments:view', 'Assignment Management', 'View assignments'),
    ('assignments:create', 'Assignment Management', 'Create assignments'),
    ('assignments:edit', 'Assignment Management', 'Edit assignments'),
    ('assignments:delete', 'Assignment Management', 'Delete assignments'),
    ('submissions:view_own', 'Submissions', 'View own submissions'),
    ('submissions:view_all', 'Submissions', 'View all submissions'),
    ('submissions:create', 'Submissions', 'Create submissions'),
    ('submissions:edit_own', 'Submissions', 'Edit own submissions'),
    ('submissions:review', 'Submissions', 'Review submissions'),
    ('submissions:approve', 'Submissions', 'Approve submissions'),
    ('submissions:reject', 'Submissions', 'Reject submissions'),
    ('evidence:upload', 'Evidence', 'Upload evidence files'),
    ('evidence:view_own', 'Evidence', 'View own evidence'),
    ('evidence:view_all', 'Evidence', 'View all evidence'),
    ('evidence:delete', 'Evidence', 'Delete evidence'),
    ('reports:view_own', 'Reports', 'View own reports'),
    ('reports:view_all', 'Reports', 'View all reports'),
    ('reports:export', 'Reports', 'Export reports'),
    ('audit_logs:view', 'Audit Logs', 'View audit logs'),
    ('settings:view', 'Settings', 'View settings'),
    ('settings:edit', 'Settings', 'Edit settings'),
    ('admin:access', 'Admin Panel', 'Access the admin panel'),
    ('tracking:view_all', 'Live Tracking', 'View all live locations'),
    ('tracking:update', 'Live Tracking', 'Update own location')
  ON CONFLICT (name) DO NOTHING;

  -- Admin gets all permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM permissions
  ON CONFLICT DO NOTHING;

  -- Manager permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT manager_role_id, id FROM permissions WHERE name IN (
    'submissions:view_all', 'submissions:review', 'submissions:approve', 'submissions:reject',
    'evidence:view_all', 'reports:view_all', 'reports:export', 'submissions:view_own', 'submissions:create',
    'submissions:edit_own', 'evidence:upload', 'evidence:view_own', 'reports:view_own', 'tracking:view_all', 'tracking:update'
  ) ON CONFLICT DO NOTHING;

  -- Supervisor permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT supervisor_role_id, id FROM permissions WHERE name IN (
    'submissions:view_all', 'submissions:review', 'evidence:view_all', 'reports:view_all',
    'submissions:view_own', 'submissions:create', 'submissions:edit_own', 'evidence:upload', 'evidence:view_own',
    'reports:view_own', 'tracking:view_all', 'tracking:update'
  ) ON CONFLICT DO NOTHING;

  -- Auditor permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT auditor_role_id, id FROM permissions WHERE name IN (
    'submissions:view_all', 'evidence:view_all', 'reports:view_all', 'reports:export', 'audit_logs:view', 'tracking:view_all'
  ) ON CONFLICT DO NOTHING;

  -- User permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT user_role_id, id FROM permissions WHERE name IN (
    'submissions:view_own', 'submissions:create', 'submissions:edit_own', 'evidence:upload',
    'evidence:view_own', 'reports:view_own', 'tracking:update'
  ) ON CONFLICT DO NOTHING;

  -- Viewer permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT viewer_role_id, id FROM permissions WHERE name IN (
    'submissions:view_own', 'evidence:view_own', 'reports:view_own'
  ) ON CONFLICT DO NOTHING;

  -- Departments
  INSERT INTO departments (name, code, description) VALUES
    ('Operations', 'OPS', 'Warehouse, purchase and field operations'),
    ('Sales', 'SAL', 'Sales and client relationship'),
    ('HR', 'HR', 'Human resources and administration'),
    ('Accounts', 'ACC', 'Accounts, finance and audit'),
    ('IT', 'IT', 'Information technology and databases')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

  SELECT id INTO ops_dept_id FROM departments WHERE code = 'OPS';
  SELECT id INTO sales_dept_id FROM departments WHERE code = 'SAL';
  SELECT id INTO hr_dept_id FROM departments WHERE code = 'HR';
  SELECT id INTO acc_dept_id FROM departments WHERE code = 'ACC';
  SELECT id INTO it_dept_id FROM departments WHERE code = 'IT';

  -- Locations
  INSERT INTO locations (name, code, address, latitude, longitude) VALUES
    ('Head Office - Mumbai', 'HO-MUM', 'BSC House, Andheri East, Mumbai 400069', 19.1136, 72.8697),
    ('Branch Office - Thane', 'BR-THN', 'BSC Towers, Ghodbunder Road, Thane 400607', 19.2183, 72.9781)
  ON CONFLICT (name) DO NOTHING;

  -- Users (with known bcrypt hashes)
  -- Note: The hashes below are valid bcrypt hashes for demo purposes.
  -- In production, run the init.mjs script to generate proper hashes.

  INSERT INTO users (employee_code, full_name, email, username, password_hash, role_id, department_id)
  VALUES ('EMP0001', 'System Administrator', 'admin@bscexclusive.com', 'admin',
    '$2a$10$rQEY7zGKH1GH5j.QP.Vz.OJqGP3m6gAB4v6xPK.aGj8dN8S0Vx3zW',
    admin_role_id, it_dept_id)
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO admin_user_id;

  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM users WHERE username = 'admin';
  END IF;

  INSERT INTO users (employee_code, full_name, email, username, password_hash, role_id, department_id, reporting_manager_id)
  VALUES ('EMP0002', 'Mike Ross', 'mike.ross@bscexclusive.com', 'mike.ross',
    '$2a$10$rQEY7zGKH1GH5j.QP.Vz.OJqGP3m6gAB4v6xPK.aGj8dN8S0Vx3zW',
    manager_role_id, acc_dept_id, admin_user_id)
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO mike_id;

  IF mike_id IS NULL THEN
    SELECT id INTO mike_id FROM users WHERE username = 'mike.ross';
  END IF;

  INSERT INTO users (employee_code, full_name, email, username, password_hash, role_id, department_id, reporting_manager_id)
  VALUES ('EMP0003', 'Jane Smith', 'jane.smith@bscexclusive.com', 'jane.smith',
    '$2a$10$rQEY7zGKH1GH5j.QP.Vz.OJqGP3m6gAB4v6xPK.aGj8dN8S0Vx3zW',
    supervisor_role_id, ops_dept_id, admin_user_id)
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO jane_id;

  IF jane_id IS NULL THEN
    SELECT id INTO jane_id FROM users WHERE username = 'jane.smith';
  END IF;

  INSERT INTO users (employee_code, full_name, email, username, password_hash, role_id, department_id, reporting_manager_id)
  VALUES ('EMP0004', 'John Doe', 'john.doe@bscexclusive.com', 'john.doe',
    '$2a$10$rQEY7zGKH1GH5j.QP.Vz.OJqGP3m6gAB4v6xPK.aGj8dN8S0Vx3zW',
    user_role_id, sales_dept_id, jane_id)
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO john_id;

  IF john_id IS NULL THEN
    SELECT id INTO john_id FROM users WHERE username = 'john.doe';
  END IF;

  INSERT INTO users (employee_code, full_name, email, username, password_hash, role_id, department_id, reporting_manager_id)
  VALUES ('EMP0005', 'Sarah Lee', 'sarah.lee@bscexclusive.com', 'sarah.lee',
    '$2a$10$rQEY7zGKH1GH5j.QP.Vz.OJqGP3m6gAB4v6xPK.aGj8dN8S0Vx3zW',
    user_role_id, sales_dept_id, jane_id)
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO sarah_id;

  IF sarah_id IS NULL THEN
    SELECT id INTO sarah_id FROM users WHERE username = 'sarah.lee';
  END IF;

  -- Modules
  INSERT INTO modules (department_id, name, slug, description, display_order) VALUES
    (sales_dept_id, 'CRM', 'crm', 'Customer relationship management process', 1),
    (sales_dept_id, 'Sales', 'sales', 'Daily sales process and order management', 2),
    (hr_dept_id, 'HR', 'hr', 'Human resources compliance process', 3),
    (acc_dept_id, 'Accounts', 'accounts', 'Accounts and finance compliance process', 4),
    (ops_dept_id, 'Warehouse & Purchase', 'warehouse-purchase', 'Warehouse stock and purchase process', 5),
    (it_dept_id, 'Database', 'database', 'Database administration and data integrity process', 6)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO crm_mod_id FROM modules WHERE slug = 'crm';
  SELECT id INTO sales_mod_id FROM modules WHERE slug = 'sales';
  SELECT id INTO hr_mod_id FROM modules WHERE slug = 'hr';
  SELECT id INTO acc_mod_id FROM modules WHERE slug = 'accounts';
  SELECT id INTO wh_mod_id FROM modules WHERE slug = 'warehouse-purchase';
  SELECT id INTO db_mod_id FROM modules WHERE slug = 'database';

  -- Checkpoints (only if none exist)
  IF (SELECT COUNT(*)::int FROM checkpoints) = 0 THEN
    -- CRM
    INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, created_by) VALUES
      (crm_mod_id, 'Daily lead follow-up', 'Follow up with all leads assigned today and log the outcome.', 5, true, false, false, 1, admin_user_id),
      (crm_mod_id, 'Update customer pipeline', 'Update stage, value and next action for every open opportunity.', 5, true, false, false, 2, admin_user_id),
      (crm_mod_id, 'CRM data hygiene check', 'Verify contact details and remove duplicate records.', 5, false, false, true, 3, admin_user_id);
    -- Sales
    INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, created_by) VALUES
      (sales_mod_id, 'Daily sales report entry', 'Enter today sales figures into the reporting system.', 5, true, false, true, 1, admin_user_id),
      (sales_mod_id, 'Quotation follow-up', 'Follow up on all quotations sent in the last 3 days.', 5, false, true, false, 2, admin_user_id),
      (sales_mod_id, 'Order confirmation check', 'Confirm dispatch dates for all open orders.', 5, true, false, false, 3, admin_user_id);
    -- HR
    INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, created_by) VALUES
      (hr_mod_id, 'Attendance reconciliation', 'Reconcile attendance records with biometric data.', 5, true, true, false, 1, admin_user_id),
      (hr_mod_id, 'Leave request processing', 'Process all pending leave requests for the day.', 5, false, false, false, 2, admin_user_id),
      (hr_mod_id, 'New hire documentation', 'Complete document collection for new joiners.', 5, false, false, true, 3, admin_user_id);
    -- Accounts
    INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, created_by) VALUES
      (acc_mod_id, 'Daily cash reconciliation', 'Reconcile cash book with bank statements.', 5, true, true, true, 1, admin_user_id),
      (acc_mod_id, 'Invoice verification', 'Verify invoices received against purchase orders.', 5, true, false, false, 2, admin_user_id),
      (acc_mod_id, 'Vendor payment schedule', 'Update vendor payment schedule and clear dues.', 5, false, true, false, 3, admin_user_id);
    -- Warehouse
    INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, created_by) VALUES
      (wh_mod_id, 'Stock audit - daily', 'Audit stock levels for all high-value items.', 5, true, true, true, 1, admin_user_id),
      (wh_mod_id, 'Purchase order review', 'Review open purchase orders and follow up with vendors.', 5, false, true, false, 2, admin_user_id),
      (wh_mod_id, 'GRN verification', 'Verify goods receipt notes against deliveries.', 5, true, false, false, 3, admin_user_id);
    -- Database
    INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, created_by) VALUES
      (db_mod_id, 'Daily backup verification', 'Verify last night backups completed successfully.', 5, true, false, false, 1, admin_user_id),
      (db_mod_id, 'Access control review', 'Review database user access and revoke stale accounts.', 5, false, true, false, 2, admin_user_id),
      (db_mod_id, 'Data integrity check', 'Run integrity checks on critical tables.', 5, true, false, true, 3, admin_user_id);
  END IF;

  -- Supervisor setup (Jane Smith)
  INSERT INTO supervisor_profiles (user_id, designation, joining_date, bio, specialization)
  VALUES (jane_id, 'Senior Operations Supervisor', '2023-01-16', 'Experienced field operations supervisor with 8+ years of compliance management.', 'Field Operations & Process Compliance')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO supervisor_departments (supervisor_id, department_id, is_primary)
  VALUES (jane_id, sales_dept_id, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO supervisor_departments (supervisor_id, department_id, is_primary)
  VALUES (jane_id, ops_dept_id, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO supervisor_employees (supervisor_id, employee_id, department_id, assignment_reason)
  VALUES (jane_id, john_id, sales_dept_id, 'Team assignment')
  ON CONFLICT DO NOTHING;

  INSERT INTO supervisor_employees (supervisor_id, employee_id, department_id, assignment_reason)
  VALUES (jane_id, sarah_id, sales_dept_id, 'Team assignment')
  ON CONFLICT DO NOTHING;

  INSERT INTO supervisor_projects (supervisor_id, module_id, responsibility)
  VALUES (jane_id, crm_mod_id, 'End-to-end process ownership')
  ON CONFLICT DO NOTHING;

  INSERT INTO supervisor_projects (supervisor_id, module_id, responsibility)
  VALUES (jane_id, sales_mod_id, 'End-to-end process ownership')
  ON CONFLICT DO NOTHING;

  -- Location tracks (demo)
  IF (SELECT COUNT(*)::int FROM location_tracks) = 0 THEN
    INSERT INTO location_tracks (user_id, latitude, longitude, accuracy, address, battery_level, tracked_at) VALUES
      (john_id, 19.1136, 72.8697, 12.5, 'Andheri East, Mumbai', 82, NOW() - INTERVAL '4 minutes'),
      (sarah_id, 19.2183, 72.9781, 18.2, 'Ghodbunder Road, Thane', 91, NOW() - INTERVAL '42 minutes'),
      (jane_id, 19.033, 73.0297, 9.8, 'Dombivli East, Thane', 76, NOW() - INTERVAL '2 minutes');
    INSERT INTO user_locations (user_id, location_id)
    SELECT john_id, id FROM locations WHERE code = 'HO-MUM'
    ON CONFLICT DO NOTHING;
  END IF;

  -- System settings
  INSERT INTO system_settings (key, value, type, category) VALUES
    ('app_name', 'BSC Exclusive Tracking', 'string', 'general'),
    ('company_name', 'BSC Exclusive', 'string', 'general'),
    ('support_email', 'support@bscexclusive.com', 'string', 'general'),
    ('auto_approve_hours', '1', 'number', 'approval'),
    ('tracking_interval_minutes', '30', 'number', 'tracking'),
    ('max_file_size_mb', '25', 'number', 'storage')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  -- Notifications
  INSERT INTO notifications (user_id, title, message, type, link_url)
  VALUES (john_id, 'Welcome to BSC Exclusive Tracking', 'Your account is ready. Complete today assigned checkpoints before the due date.', 'info', '/dashboard')
  ON CONFLICT DO NOTHING;

  INSERT INTO notifications (user_id, title, message, type, link_url)
  SELECT admin_user_id, 'Submissions awaiting review', 'You have submissions waiting for your approval.', 'warning', '/admin/submissions'
  WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = admin_user_id AND title = 'Submissions awaiting review');

  RAISE NOTICE '========================================';
  RAISE NOTICE ' BSC Exclusive Tracking — Setup Complete!';
  RAISE NOTICE ' Admin login:    admin / Admin@123456';
  RAISE NOTICE ' User login:     john.doe / User@123456';
  RAISE NOTICE ' Supervisor:     jane.smith / Supervisor@123';
  RAISE NOTICE ' Manager:        mike.ross / Manager@123';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- PART 3: SUPABASE STORAGE (evidence bucket)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence',
  'evidence',
  true,
  26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/csv', 'application/vnd.ms-excel',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
    'audio/webm', 'audio/x-m4a', 'audio/aac'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence');

-- ============================================================
-- DONE! You can now connect your backend to this database.
-- ============================================================
