-- ============================================================
-- BSC Exclusive Process Tracker - Supabase Seed Data
-- Run this after the schema migration to populate initial data
-- ============================================================

-- ============================================================
-- ROLES
-- ============================================================
INSERT INTO roles (id, name, description, created_at, updated_at) VALUES
  ('role_admin', 'ADMIN', 'Full system access with all permissions', NOW(), NOW()),
  ('role_manager', 'MANAGER', 'Review and approve submissions, manage team', NOW(), NOW()),
  ('role_supervisor', 'SUPERVISOR', 'Review submissions and view reports', NOW(), NOW()),
  ('role_auditor', 'AUDITOR', 'View all data and export reports', NOW(), NOW()),
  ('role_user', 'USER', 'Submit checkpoints and view own data', NOW(), NOW()),
  ('role_viewer', 'VIEWER', 'Read-only access to own submissions', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (id, name, description, category, created_at, updated_at) VALUES
  -- Users
  ('perm_users_view', 'users:view', 'View user list', 'users', NOW(), NOW()),
  ('perm_users_create', 'users:create', 'Create new users', 'users', NOW(), NOW()),
  ('perm_users_edit', 'users:edit', 'Edit user details', 'users', NOW(), NOW()),
  ('perm_users_delete', 'users:delete', 'Delete/deactivate users', 'users', NOW(), NOW()),
  ('perm_users_reset_password', 'users:reset_password', 'Reset user passwords', 'users', NOW(), NOW()),
  -- Roles
  ('perm_roles_view', 'roles:view', 'View roles', 'roles', NOW(), NOW()),
  ('perm_roles_manage', 'roles:manage', 'Manage role permissions', 'roles', NOW(), NOW()),
  -- Departments
  ('perm_departments_view', 'departments:view', 'View departments', 'departments', NOW(), NOW()),
  ('perm_departments_create', 'departments:create', 'Create departments', 'departments', NOW(), NOW()),
  ('perm_departments_edit', 'departments:edit', 'Edit departments', 'departments', NOW(), NOW()),
  ('perm_departments_delete', 'departments:delete', 'Delete departments', 'departments', NOW(), NOW()),
  -- Modules
  ('perm_modules_view', 'modules:view', 'View modules', 'modules', NOW(), NOW()),
  ('perm_modules_create', 'modules:create', 'Create modules', 'modules', NOW(), NOW()),
  ('perm_modules_edit', 'modules:edit', 'Edit modules', 'modules', NOW(), NOW()),
  ('perm_modules_delete', 'modules:delete', 'Delete/deactivate modules', 'modules', NOW(), NOW()),
  -- Checkpoints
  ('perm_checkpoints_view', 'checkpoints:view', 'View checkpoints', 'checkpoints', NOW(), NOW()),
  ('perm_checkpoints_create', 'checkpoints:create', 'Create checkpoints', 'checkpoints', NOW(), NOW()),
  ('perm_checkpoints_edit', 'checkpoints:edit', 'Edit checkpoints', 'checkpoints', NOW(), NOW()),
  ('perm_checkpoints_delete', 'checkpoints:delete', 'Delete checkpoints', 'checkpoints', NOW(), NOW()),
  -- Assignments
  ('perm_assignments_view', 'assignments:view', 'View assignments', 'assignments', NOW(), NOW()),
  ('perm_assignments_create', 'assignments:create', 'Create assignments', 'assignments', NOW(), NOW()),
  ('perm_assignments_delete', 'assignments:delete', 'Delete assignments', 'assignments', NOW(), NOW()),
  -- Submissions
  ('perm_submissions_view', 'submissions:view', 'View all submissions', 'submissions', NOW(), NOW()),
  ('perm_submissions_approve', 'submissions:approve', 'Approve submissions', 'submissions', NOW(), NOW()),
  ('perm_submissions_reject', 'submissions:reject', 'Reject submissions', 'submissions', NOW(), NOW()),
  ('perm_submissions_own', 'submissions:own', 'View own submissions', 'submissions', NOW(), NOW()),
  -- Evidence
  ('perm_evidence_view', 'evidence:view', 'View all evidence', 'evidence', NOW(), NOW()),
  ('perm_evidence_upload', 'evidence:upload', 'Upload evidence', 'evidence', NOW(), NOW()),
  ('perm_evidence_delete', 'evidence:delete', 'Delete evidence', 'evidence', NOW(), NOW()),
  -- Reports
  ('perm_reports_view', 'reports:view', 'View reports', 'reports', NOW(), NOW()),
  ('perm_reports_export', 'reports:export', 'Export reports as CSV', 'reports', NOW(), NOW()),
  -- Audit Logs
  ('perm_audit_logs_view', 'audit_logs:view', 'View audit logs', 'audit_logs', NOW(), NOW()),
  -- Settings
  ('perm_settings_view', 'settings:view', 'View system settings', 'settings', NOW(), NOW()),
  ('perm_settings_edit', 'settings:edit', 'Edit system settings', 'settings', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ROLE PERMISSIONS (ADMIN gets all)
-- ============================================================
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'rp_admin_' || p.id,
  'role_admin',
  p.id,
  NOW()
FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- MANAGER permissions
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'rp_manager_' || p.id,
  'role_manager',
  p.id,
  NOW()
FROM permissions p
WHERE p.name IN (
  'submissions:view', 'submissions:approve', 'submissions:reject',
  'evidence:view', 'reports:view', 'reports:export',
  'modules:view', 'checkpoints:view', 'assignments:view',
  'submissions:own', 'evidence:upload'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SUPERVISOR permissions
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'rp_supervisor_' || p.id,
  'role_supervisor',
  p.id,
  NOW()
FROM permissions p
WHERE p.name IN (
  'submissions:view', 'submissions:approve', 'submissions:reject',
  'evidence:view', 'reports:view',
  'modules:view', 'checkpoints:view', 'assignments:view',
  'submissions:own', 'evidence:upload'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- AUDITOR permissions
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'rp_auditor_' || p.id,
  'role_auditor',
  p.id,
  NOW()
FROM permissions p
WHERE p.name IN (
  'submissions:view', 'evidence:view', 'reports:view', 'reports:export',
  'audit_logs:view', 'modules:view', 'checkpoints:view',
  'submissions:own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- USER permissions
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'rp_user_' || p.id,
  'role_user',
  p.id,
  NOW()
FROM permissions p
WHERE p.name IN (
  'submissions:own', 'evidence:upload', 'modules:view', 'checkpoints:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- VIEWER permissions
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'rp_viewer_' || p.id,
  'role_viewer',
  p.id,
  NOW()
FROM permissions p
WHERE p.name IN (
  'submissions:own', 'modules:view', 'checkpoints:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- DEPARTMENTS
-- ============================================================
INSERT INTO departments (id, name, code, description, status, created_at, updated_at) VALUES
  ('dept_ops', 'Operations', 'OPS', 'Daily operational processes and compliance', 'ACTIVE', NOW(), NOW()),
  ('dept_sales', 'Sales', 'SALES', 'Sales operations and client management', 'ACTIVE', NOW(), NOW()),
  ('dept_hr', 'Human Resources', 'HR', 'Employee management and compliance', 'ACTIVE', NOW(), NOW()),
  ('dept_accounts', 'Accounts', 'ACCT', 'Financial operations and reconciliation', 'ACTIVE', NOW(), NOW()),
  ('dept_it', 'IT', 'IT', 'Infrastructure and database management', 'ACTIVE', NOW(), NOW()),
  ('dept_warehouse', 'Warehouse & Purchase', 'WH', 'Inventory and procurement operations', 'ACTIVE', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- MODULES
-- ============================================================
INSERT INTO modules (id, department_id, name, slug, description, display_order, status, created_at, updated_at) VALUES
  ('mod_crm', 'dept_ops', 'CRM Module', 'crm', 'Lead tracking, client communications, pipeline hygiene', 1, 'ACTIVE', NOW(), NOW()),
  ('mod_wh', 'dept_warehouse', 'Warehouse & Purchase', 'warehouse-purchase', 'Inbound manifests, inventory counts, dispatch proof', 2, 'ACTIVE', NOW(), NOW()),
  ('mod_sales', 'dept_sales', 'Sales Operations', 'sales', 'Order bookings, invoicing verification, collections', 3, 'ACTIVE', NOW(), NOW()),
  ('mod_hr', 'dept_hr', 'Human Resources', 'hr', 'Attendance audits, compliance filings, shift logs', 4, 'ACTIVE', NOW(), NOW()),
  ('mod_accounts', 'dept_accounts', 'Accounts & Finance', 'accounts', 'Daily cash reconciliation, GST tracking, ledger audits', 5, 'ACTIVE', NOW(), NOW()),
  ('mod_db', 'dept_it', 'Database & Infrastructure', 'database', 'Backup validation, replication health, security logs', 6, 'ACTIVE', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- CHECKPOINTS (at least one per module)
-- ============================================================
INSERT INTO checkpoints (id, module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, status, created_at, updated_at) VALUES
  -- CRM
  ('cp_crm_1', 'mod_crm', 'Daily Lead Entry Verification', 'Verify all new leads are entered in CRM with correct contact details', 5, true, false, true, 1, 'ACTIVE', NOW(), NOW()),
  ('cp_crm_2', 'mod_crm', 'Client Communication Log', 'Check that all client calls and emails are logged in the system', 5, false, false, false, 2, 'ACTIVE', NOW(), NOW()),
  ('cp_crm_3', 'mod_crm', 'Pipeline Status Update', 'Ensure pipeline stages are updated for all active deals', 5, true, false, false, 3, 'ACTIVE', NOW(), NOW()),
  -- Warehouse
  ('cp_wh_1', 'mod_wh', 'Morning Inventory Count', 'Physical count of main warehouse stock and comparison with system records', 5, true, true, true, 1, 'ACTIVE', NOW(), NOW()),
  ('cp_wh_2', 'mod_wh', 'Inbound Manifest Check', 'Verify all inbound shipments are received and logged', 5, false, false, true, 2, 'ACTIVE', NOW(), NOW()),
  ('cp_wh_3', 'mod_wh', 'Dispatch Proof Verification', 'Confirm dispatch documents are complete and accurate', 5, true, false, true, 3, 'ACTIVE', NOW(), NOW()),
  -- Sales
  ('cp_sales_1', 'mod_sales', 'Daily Order Bookings', 'Verify all order bookings for the day are recorded correctly', 5, true, false, false, 1, 'ACTIVE', NOW(), NOW()),
  ('cp_sales_2', 'mod_sales', 'Invoice Verification', 'Cross-check invoices raised against approved orders', 5, true, true, false, 2, 'ACTIVE', NOW(), NOW()),
  ('cp_sales_3', 'mod_sales', 'Collections Update', 'Update collection status for pending invoices', 5, false, false, false, 3, 'ACTIVE', NOW(), NOW()),
  -- HR
  ('cp_hr_1', 'mod_hr', 'Attendance Audit', 'Verify employee attendance records match biometric data', 5, true, false, true, 1, 'ACTIVE', NOW(), NOW()),
  ('cp_hr_2', 'mod_hr', 'Leave Compliance Check', 'Ensure all leave applications are approved and recorded', 5, false, false, false, 2, 'ACTIVE', NOW(), NOW()),
  -- Accounts
  ('cp_acct_1', 'mod_accounts', 'Cash Reconciliation', 'Daily cash balance reconciliation between POS and system', 5, true, true, true, 1, 'ACTIVE', NOW(), NOW()),
  ('cp_acct_2', 'mod_accounts', 'GST Filing Tracker', 'Verify GST return filing status and deadlines', 5, true, false, false, 2, 'ACTIVE', NOW(), NOW()),
  -- Database
  ('cp_db_1', 'mod_db', 'Backup Validation', 'Verify all database backups completed successfully', 5, true, true, false, 1, 'ACTIVE', NOW(), NOW()),
  ('cp_db_2', 'mod_db', 'Replication Health Check', 'Check replication lag and sync status across nodes', 5, true, false, false, 2, 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADMIN USER (password: Admin@123456 - bcrypt hash)
-- ============================================================
INSERT INTO users (id, employee_code, full_name, email, phone, username, password_hash, role_id, department_id, status, must_change_password, created_at, updated_at) VALUES
  ('user_admin', 'EMP001', 'System Administrator', 'admin@bscexclusive.com', '+91 98765 43210', 'admin', '$2b$12$s646E1RCaU02g7BBx8jKt.8KcehP2mCmCQUmZxlQcL0hdWl.RMXGq', 'role_admin', 'dept_ops', 'ACTIVE', false, NOW(), NOW())
ON CONFLICT (username) DO NOTHING;

-- Demo user (password: Admin@123456)
INSERT INTO users (id, employee_code, full_name, email, phone, username, password_hash, role_id, department_id, status, must_change_password, created_at, updated_at) VALUES
  ('user_demo', 'EMP002', 'John Doe', 'john.doe@bscexclusive.com', '+91 98765 43211', 'john.doe', '$2b$12$s646E1RCaU02g7BBx8jKt.8KcehP2mCmCQUmZxlQcL0hdWl.RMXGq', 'role_user', 'dept_ops', 'ACTIVE', false, NOW(), NOW())
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- LOCATIONS
-- ============================================================
INSERT INTO locations (id, name, code, address, status, created_at, updated_at) VALUES
  ('loc_hq', 'Head Office', 'HQ', '123 Business Park, Mumbai, India', 'ACTIVE', NOW(), NOW()),
  ('loc_branch', 'Branch Office', 'BR', '456 Commerce Center, Delhi, India', 'ACTIVE', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- USER LOCATIONS
-- ============================================================
INSERT INTO user_locations (user_id, location_id, created_at) VALUES
  ('user_admin', 'loc_hq', NOW()),
  ('user_demo', 'loc_hq', NOW())
ON CONFLICT (user_id, location_id) DO NOTHING;

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
INSERT INTO system_settings (id, key, value, type, category, created_at, updated_at) VALUES
  ('ss_1', 'app_name', 'BSC Exclusive', 'string', 'general', NOW(), NOW()),
  ('ss_2', 'timezone', 'Asia/Kolkata', 'string', 'general', NOW(), NOW()),
  ('ss_3', 'max_file_size', '10', 'number', 'general', NOW(), NOW()),
  ('ss_4', 'allowed_file_types', 'image/jpeg,image/png,image/webp', 'string', 'general', NOW(), NOW()),
  ('ss_5', 'autosave_interval', '800', 'number', 'general', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
