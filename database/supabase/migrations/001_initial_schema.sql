-- ============================================================
-- BSC Exclusive Process Tracker - Supabase Schema Migration
-- Run this in Supabase SQL Editor or via CLI:
--   supabase db push
--   or paste into Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE checkpoint_status AS ENUM ('PENDING', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'NOT_APPLICABLE', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance_status AS ENUM ('FULLY_FOLLOWED', 'PARTIALLY_FOLLOWED', 'NOT_FOLLOWED', 'NO_TRANSACTION', 'YET_TO_IMPLEMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE accuracy_status AS ENUM ('FULLY_ACCURATE', 'PARTLY_ACCURATE', 'INACCURATE', 'NA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE assignment_frequency AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE entity_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLES
-- ============================================================

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role Permissions (junction table)
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  status entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  status entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  department_id TEXT REFERENCES departments(id),
  status user_status NOT NULL DEFAULT 'ACTIVE',
  profile_image TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- User Locations (junction table)
CREATE TABLE IF NOT EXISTS user_locations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Modules
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  department_id TEXT NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checkpoints
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  module_id TEXT NOT NULL REFERENCES modules(id),
  title TEXT NOT NULL,
  description TEXT,
  score INTEGER NOT NULL DEFAULT 5,
  is_accuracy_required BOOLEAN NOT NULL DEFAULT false,
  is_corrective_action_required BOOLEAN NOT NULL DEFAULT false,
  is_photo_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  status entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id)
);

-- Checkpoint Assignments
CREATE TABLE IF NOT EXISTS checkpoint_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  checkpoint_id TEXT NOT NULL REFERENCES checkpoints(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  assigned_date DATE NOT NULL,
  due_date DATE,
  frequency assignment_frequency NOT NULL DEFAULT 'DAILY',
  status entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, checkpoint_id, assigned_date)
);

-- Checkpoint Submissions
CREATE TABLE IF NOT EXISTS checkpoint_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  checkpoint_id TEXT NOT NULL REFERENCES checkpoints(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  assignment_id TEXT REFERENCES checkpoint_assignments(id),
  submission_date DATE NOT NULL,
  status checkpoint_status NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES users(id),
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submission Answers (1-to-1 with submission)
CREATE TABLE IF NOT EXISTS submission_answers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  submission_id TEXT UNIQUE NOT NULL REFERENCES checkpoint_submissions(id) ON DELETE CASCADE,
  compliance_status compliance_status,
  accuracy_status accuracy_status,
  comments TEXT,
  corrective_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evidence Files
CREATE TABLE IF NOT EXISTS evidence_files (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  submission_id TEXT NOT NULL REFERENCES checkpoint_submissions(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_modules_department_id ON modules(department_id);
CREATE INDEX IF NOT EXISTS idx_modules_slug ON modules(slug);
CREATE INDEX IF NOT EXISTS idx_checkpoints_module_id ON checkpoints(module_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_assignments_user_id ON checkpoint_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_assignments_checkpoint_id ON checkpoint_assignments(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_assignments_assigned_date ON checkpoint_assignments(assigned_date);
CREATE INDEX IF NOT EXISTS idx_checkpoint_assignments_user_date ON checkpoint_assignments(user_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_checkpoint_submissions_user_id ON checkpoint_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_submissions_checkpoint_id ON checkpoint_submissions(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_submissions_submission_date ON checkpoint_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_checkpoint_submissions_status ON checkpoint_submissions(status);
CREATE INDEX IF NOT EXISTS idx_checkpoint_submissions_user_date ON checkpoint_submissions(user_id, submission_date);
CREATE INDEX IF NOT EXISTS idx_checkpoint_submissions_user_checkpoint_date ON checkpoint_submissions(user_id, checkpoint_id, submission_date);
CREATE INDEX IF NOT EXISTS idx_evidence_files_submission_id ON evidence_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Supabase specific
-- Enable RLS on all tables but allow service_role full access
-- ============================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoint_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCTIONS (updated_at trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables that have it
CREATE OR REPLACE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_checkpoints_updated_at BEFORE UPDATE ON checkpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_checkpoint_assignments_updated_at BEFORE UPDATE ON checkpoint_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_checkpoint_submissions_updated_at BEFORE UPDATE ON checkpoint_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_submission_answers_updated_at BEFORE UPDATE ON submission_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
