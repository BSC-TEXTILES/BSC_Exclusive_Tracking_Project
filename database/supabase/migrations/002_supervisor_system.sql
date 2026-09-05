-- ============================================================
-- BSC Exclusive Process Tracker - Supervisor System Migration
-- Run this in Supabase SQL Editor or via CLI:
--   supabase db push
--   or paste into Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. NEW ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================

-- Add reporting_manager_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS reporting_manager_id TEXT REFERENCES users(id);

-- ============================================================
-- 3. NEW TABLES
-- ============================================================

-- Supervisor Profiles - Extended supervisor profile
CREATE TABLE IF NOT EXISTS supervisor_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  designation TEXT,
  joining_date DATE,
  reporting_manager_id TEXT REFERENCES users(id),
  bio TEXT,
  specialization TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supervisor Departments - Supervisor-department assignment with history
CREATE TABLE IF NOT EXISTS supervisor_departments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  supervisor_id TEXT NOT NULL REFERENCES users(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date DATE,
  status entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(supervisor_id, department_id)
);

-- Supervisor Employees - Supervisor-employee relationship with history
CREATE TABLE IF NOT EXISTS supervisor_employees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  supervisor_id TEXT NOT NULL REFERENCES users(id),
  employee_id TEXT NOT NULL REFERENCES users(id),
  department_id TEXT REFERENCES departments(id),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date DATE,
  status entity_status NOT NULL DEFAULT 'ACTIVE',
  assignment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(supervisor_id, employee_id)
);

-- Supervisor Projects - Supervisor-module assignment
CREATE TABLE IF NOT EXISTS supervisor_projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  supervisor_id TEXT NOT NULL REFERENCES users(id),
  module_id TEXT NOT NULL REFERENCES modules(id),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date DATE,
  status entity_status NOT NULL DEFAULT 'ACTIVE',
  responsibility TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(supervisor_id, module_id)
);

-- Supervisor Approvals - Approval workflow
CREATE TABLE IF NOT EXISTS supervisor_approvals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  submission_id TEXT NOT NULL REFERENCES checkpoint_submissions(id) ON DELETE CASCADE,
  supervisor_id TEXT NOT NULL REFERENCES users(id),
  status approval_status NOT NULL DEFAULT 'PENDING',
  request_type TEXT NOT NULL DEFAULT 'SUBMISSION_REVIEW',
  requested_by TEXT REFERENCES users(id),
  approval_date TIMESTAMPTZ,
  rejection_reason TEXT,
  supervisor_comments TEXT,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  escalated_to TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supervisor Activities - Activity audit trail
CREATE TABLE IF NOT EXISTS supervisor_activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  supervisor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

-- Users reporting_manager_id index
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_id ON users(reporting_manager_id);

-- Supervisor Profiles indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_profiles_user_id ON supervisor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_profiles_reporting_manager_id ON supervisor_profiles(reporting_manager_id);

-- Supervisor Departments indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_departments_supervisor_id ON supervisor_departments(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_departments_department_id ON supervisor_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_departments_status ON supervisor_departments(status);
CREATE INDEX IF NOT EXISTS idx_supervisor_departments_supervisor_status ON supervisor_departments(supervisor_id, status);

-- Supervisor Employees indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_employees_supervisor_id ON supervisor_employees(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_employees_employee_id ON supervisor_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_employees_department_id ON supervisor_employees(department_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_employees_status ON supervisor_employees(status);
CREATE INDEX IF NOT EXISTS idx_supervisor_employees_supervisor_status ON supervisor_employees(supervisor_id, status);
CREATE INDEX IF NOT EXISTS idx_supervisor_employees_employee_status ON supervisor_employees(employee_id, status);

-- Supervisor Projects indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_projects_supervisor_id ON supervisor_projects(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_projects_module_id ON supervisor_projects(module_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_projects_status ON supervisor_projects(status);
CREATE INDEX IF NOT EXISTS idx_supervisor_projects_supervisor_status ON supervisor_projects(supervisor_id, status);

-- Supervisor Approvals indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_submission_id ON supervisor_approvals(submission_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_supervisor_id ON supervisor_approvals(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_status ON supervisor_approvals(status);
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_request_type ON supervisor_approvals(request_type);
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_requested_by ON supervisor_approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_escalated_to ON supervisor_approvals(escalated_to);
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_supervisor_status ON supervisor_approvals(supervisor_id, status);
CREATE INDEX IF NOT EXISTS idx_supervisor_approvals_created_at ON supervisor_approvals(created_at);

-- Supervisor Activities indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_activities_supervisor_id ON supervisor_activities(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_activities_action ON supervisor_activities(action);
CREATE INDEX IF NOT EXISTS idx_supervisor_activities_entity_type ON supervisor_activities(entity_type);
CREATE INDEX IF NOT EXISTS idx_supervisor_activities_entity_id ON supervisor_activities(entity_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_activities_created_at ON supervisor_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_supervisor_activities_supervisor_created ON supervisor_activities(supervisor_id, created_at);

-- ============================================================
-- 5. DATABASE VIEW - Supervisor Dashboard Aggregation
-- ============================================================

CREATE OR REPLACE VIEW v_supervisor_dashboard AS
SELECT
  u.id AS supervisor_id,
  u.full_name AS supervisor_name,
  u.employee_code AS supervisor_code,

  -- Employee counts
  COALESCE(emp_stats.total_employees, 0) AS total_employees,
  COALESCE(emp_stats.active_employees, 0) AS active_employees,

  -- Department count
  COALESCE(dept_stats.assigned_departments, 0) AS assigned_departments,

  -- Project/module count
  COALESCE(proj_stats.assigned_projects, 0) AS assigned_projects,

  -- Approval counts
  COALESCE(approval_stats.pending_approvals, 0) AS pending_approvals,
  COALESCE(approval_stats.approved_count, 0) AS approved_count,
  COALESCE(approval_stats.rejected_count, 0) AS rejected_count,

  -- Recent activity count (last 30 days)
  COALESCE(act_stats.recent_activity_count, 0) AS recent_activity_count

FROM users u
LEFT JOIN (
  SELECT
    supervisor_id,
    COUNT(*) AS total_employees,
    COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_employees
  FROM supervisor_employees
  GROUP BY supervisor_id
) emp_stats ON emp_stats.supervisor_id = u.id
LEFT JOIN (
  SELECT
    supervisor_id,
    COUNT(*) AS assigned_departments
  FROM supervisor_departments
  WHERE status = 'ACTIVE'
  GROUP BY supervisor_id
) dept_stats ON dept_stats.supervisor_id = u.id
LEFT JOIN (
  SELECT
    supervisor_id,
    COUNT(*) AS assigned_projects
  FROM supervisor_projects
  WHERE status = 'ACTIVE'
  GROUP BY supervisor_id
) proj_stats ON proj_stats.supervisor_id = u.id
LEFT JOIN (
  SELECT
    supervisor_id,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_approvals,
    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_count
  FROM supervisor_approvals
  GROUP BY supervisor_id
) approval_stats ON approval_stats.supervisor_id = u.id
LEFT JOIN (
  SELECT
    supervisor_id,
    COUNT(*) AS recent_activity_count
  FROM supervisor_activities
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY supervisor_id
) act_stats ON act_stats.supervisor_id = u.id;

-- ============================================================
-- 6. UPDATED_AT TRIGGER FUNCTION (already exists from 001)
-- Reuse existing update_updated_at_column() function
-- ============================================================

-- Apply updated_at triggers to new tables
CREATE OR REPLACE TRIGGER update_supervisor_profiles_updated_at
  BEFORE UPDATE ON supervisor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_supervisor_approvals_updated_at
  BEFORE UPDATE ON supervisor_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- Enable RLS on all new tables but allow service_role full access
-- ============================================================

ALTER TABLE supervisor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_activities ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies for service_role (Supabase backend)
-- service_role bypasses RLS by default in Supabase, but these policies
-- ensure explicit full access if RLS is ever enforced

-- supervisor_profiles
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_full_access_supervisor_profiles" ON supervisor_profiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE POLICY "service_role_full_access_supervisor_profiles"
  ON supervisor_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- supervisor_departments
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_full_access_supervisor_departments" ON supervisor_departments;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE POLICY "service_role_full_access_supervisor_departments"
  ON supervisor_departments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- supervisor_employees
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_full_access_supervisor_employees" ON supervisor_employees;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE POLICY "service_role_full_access_supervisor_employees"
  ON supervisor_employees FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- supervisor_projects
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_full_access_supervisor_projects" ON supervisor_projects;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE POLICY "service_role_full_access_supervisor_projects"
  ON supervisor_projects FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- supervisor_approvals
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_full_access_supervisor_approvals" ON supervisor_approvals;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE POLICY "service_role_full_access_supervisor_approvals"
  ON supervisor_approvals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- supervisor_activities
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_full_access_supervisor_activities" ON supervisor_activities;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE POLICY "service_role_full_access_supervisor_activities"
  ON supervisor_activities FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 8. SEED SUPERVISOR ROLE PERMISSIONS
-- ============================================================

-- Add new supervisor-specific permissions
INSERT INTO permissions (id, name, description, category, created_at, updated_at) VALUES
  ('perm_supervisor_access', 'supervisor:access', 'Access supervisor dashboard and features', 'supervisor', NOW(), NOW()),
  ('perm_supervisor_manage_team', 'supervisor:manage_team', 'Manage team members and assignments', 'supervisor', NOW(), NOW()),
  ('perm_supervisor_review_approvals', 'supervisor:review_approvals', 'Review and process approval requests', 'supervisor', NOW(), NOW()),
  ('perm_supervisor_view_reports', 'supervisor:view_reports', 'View supervisor-level reports and analytics', 'supervisor', NOW(), NOW()),
  ('perm_supervisor_manage_departments', 'supervisor:manage_departments', 'Manage department assignments for supervisors', 'supervisor', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Assign new permissions to SUPERVISOR role
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'rp_supervisor_' || p.id,
  'role_supervisor',
  p.id,
  NOW()
FROM permissions p
WHERE p.name IN (
  'supervisor:access',
  'supervisor:manage_team',
  'supervisor:review_approvals',
  'supervisor:view_reports',
  'supervisor:manage_departments'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Also assign new permissions to ADMIN role (admins should have all supervisor permissions)
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'rp_admin_' || p.id,
  'role_admin',
  p.id,
  NOW()
FROM permissions p
WHERE p.name IN (
  'supervisor:access',
  'supervisor:manage_team',
  'supervisor:review_approvals',
  'supervisor:view_reports',
  'supervisor:manage_departments'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
