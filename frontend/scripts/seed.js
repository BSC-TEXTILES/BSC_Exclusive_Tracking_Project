const https = require('https');

const URL_BASE = 'https://azloovmhjhqidllrxdds.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6bG9vdm1oamhxaWRsbHJ4ZGRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODYxMjk1NCwiZXhwIjoyMTA0MTg4OTU0fQ.H8Cc8YqLdANBjgysMz057ERivdCURnfhouy4vF7ThaA';

function upsert(table, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL('/rest/v1/' + table, URL_BASE);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          console.error('  ERROR ' + table + ':', res.statusCode, d.substring(0, 200));
          resolve(false);
        } else {
          console.log('  OK ' + table + ': inserted');
          resolve(true);
        }
      });
    });
    req.on('error', e => { console.error('  ERR ' + table + ':', e.message); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Seeding database...\n');

  // 1. Roles
  console.log('1. Roles');
  await upsert('roles', [
    { id: 'role_admin', name: 'ADMIN', description: 'Full system access with all permissions' },
    { id: 'role_manager', name: 'MANAGER', description: 'Review and approve submissions, manage team' },
    { id: 'role_supervisor', name: 'SUPERVISOR', description: 'Review submissions and view reports' },
    { id: 'role_auditor', name: 'AUDITOR', description: 'View all data and export reports' },
    { id: 'role_user', name: 'USER', description: 'Submit checkpoints and view own data' },
    { id: 'role_viewer', name: 'VIEWER', description: 'Read-only access to own submissions' },
  ]);

  // 2. Departments
  console.log('2. Departments');
  await upsert('departments', [
    { id: 'dept_ops', name: 'Operations', code: 'OPS', description: 'Daily operational processes and compliance', status: 'ACTIVE' },
    { id: 'dept_sales', name: 'Sales', code: 'SALES', description: 'Sales operations and client management', status: 'ACTIVE' },
    { id: 'dept_hr', name: 'Human Resources', code: 'HR', description: 'Employee management and compliance', status: 'ACTIVE' },
    { id: 'dept_accounts', name: 'Accounts', code: 'ACCT', description: 'Financial operations and reconciliation', status: 'ACTIVE' },
    { id: 'dept_it', name: 'IT', code: 'IT', description: 'Infrastructure and database management', status: 'ACTIVE' },
    { id: 'dept_warehouse', name: 'Warehouse & Purchase', code: 'WH', description: 'Inventory and procurement operations', status: 'ACTIVE' },
  ]);

  // 3. Users (admin password: Admin@123456)
  console.log('3. Users');
  await upsert('users', [
    {
      id: 'user_admin', employee_code: 'EMP001', full_name: 'System Administrator',
      email: 'admin@bscexclusive.com', phone: '+91 98765 43210', username: 'admin',
      password_hash: '$2b$12$s646E1RCaU02g7BBx8jKt.8KcehP2mCmCQUmZxlQcL0hdWl.RMXGq',
      role_id: 'role_admin', department_id: 'dept_ops', status: 'ACTIVE', must_change_password: false,
    },
    {
      id: 'user_demo', employee_code: 'EMP002', full_name: 'John Doe',
      email: 'john.doe@bscexclusive.com', phone: '+91 98765 43211', username: 'john.doe',
      password_hash: '$2b$12$s646E1RCaU02g7BBx8jKt.8KcehP2mCmCQUmZxlQcL0hdWl.RMXGq',
      role_id: 'role_user', department_id: 'dept_ops', status: 'ACTIVE', must_change_password: false,
    },
  ]);

  // 4. Modules
  console.log('4. Modules');
  await upsert('modules', [
    { id: 'mod_crm', department_id: 'dept_ops', name: 'CRM Module', slug: 'crm', description: 'Lead tracking, client communications, pipeline hygiene', display_order: 1, status: 'ACTIVE' },
    { id: 'mod_wh', department_id: 'dept_warehouse', name: 'Warehouse & Purchase', slug: 'warehouse-purchase', description: 'Inbound manifests, inventory counts, dispatch proof', display_order: 2, status: 'ACTIVE' },
    { id: 'mod_sales', department_id: 'dept_sales', name: 'Sales Operations', slug: 'sales', description: 'Order bookings, invoicing verification, collections', display_order: 3, status: 'ACTIVE' },
    { id: 'mod_hr', department_id: 'dept_hr', name: 'Human Resources', slug: 'hr', description: 'Attendance audits, compliance filings, shift logs', display_order: 4, status: 'ACTIVE' },
    { id: 'mod_accounts', department_id: 'dept_accounts', name: 'Accounts & Finance', slug: 'accounts', description: 'Daily cash reconciliation, GST tracking, ledger audits', display_order: 5, status: 'ACTIVE' },
    { id: 'mod_db', department_id: 'dept_it', name: 'Database & Infrastructure', slug: 'database', description: 'Backup validation, replication health, security logs', display_order: 6, status: 'ACTIVE' },
  ]);

  // 5. Checkpoints
  console.log('5. Checkpoints');
  await upsert('checkpoints', [
    { id: 'cp_crm_1', module_id: 'mod_crm', title: 'Daily Lead Entry Verification', description: 'Verify all new leads are entered in CRM with correct contact details', score: 5, is_accuracy_required: true, is_corrective_action_required: false, is_photo_required: true, display_order: 1, status: 'ACTIVE' },
    { id: 'cp_crm_2', module_id: 'mod_crm', title: 'Client Communication Log', description: 'Check that all client calls and emails are logged in the system', score: 5, is_accuracy_required: false, is_corrective_action_required: false, is_photo_required: false, display_order: 2, status: 'ACTIVE' },
    { id: 'cp_crm_3', module_id: 'mod_crm', title: 'Pipeline Status Update', description: 'Ensure pipeline stages are updated for all active deals', score: 5, is_accuracy_required: true, is_corrective_action_required: false, is_photo_required: false, display_order: 3, status: 'ACTIVE' },
    { id: 'cp_wh_1', module_id: 'mod_wh', title: 'Morning Inventory Count', description: 'Physical count of main warehouse stock and comparison with system records', score: 5, is_accuracy_required: true, is_corrective_action_required: true, is_photo_required: true, display_order: 1, status: 'ACTIVE' },
    { id: 'cp_wh_2', module_id: 'mod_wh', title: 'Inbound Manifest Check', description: 'Verify all inbound shipments are received and logged', score: 5, is_accuracy_required: false, is_corrective_action_required: false, is_photo_required: true, display_order: 2, status: 'ACTIVE' },
    { id: 'cp_wh_3', module_id: 'mod_wh', title: 'Dispatch Proof Verification', description: 'Confirm dispatch documents are complete and accurate', score: 5, is_accuracy_required: true, is_corrective_action_required: false, is_photo_required: true, display_order: 3, status: 'ACTIVE' },
    { id: 'cp_sales_1', module_id: 'mod_sales', title: 'Daily Order Bookings', description: 'Verify all order bookings for the day are recorded correctly', score: 5, is_accuracy_required: true, is_corrective_action_required: false, is_photo_required: false, display_order: 1, status: 'ACTIVE' },
    { id: 'cp_sales_2', module_id: 'mod_sales', title: 'Invoice Verification', description: 'Cross-check invoices raised against approved orders', score: 5, is_accuracy_required: true, is_corrective_action_required: true, is_photo_required: false, display_order: 2, status: 'ACTIVE' },
    { id: 'cp_sales_3', module_id: 'mod_sales', title: 'Collections Update', description: 'Update collection status for pending invoices', score: 5, is_accuracy_required: false, is_corrective_action_required: false, is_photo_required: false, display_order: 3, status: 'ACTIVE' },
    { id: 'cp_hr_1', module_id: 'mod_hr', title: 'Attendance Audit', description: 'Verify employee attendance records match biometric data', score: 5, is_accuracy_required: true, is_corrective_action_required: false, is_photo_required: true, display_order: 1, status: 'ACTIVE' },
    { id: 'cp_hr_2', module_id: 'mod_hr', title: 'Leave Compliance Check', description: 'Ensure all leave applications are approved and recorded', score: 5, is_accuracy_required: false, is_corrective_action_required: false, is_photo_required: false, display_order: 2, status: 'ACTIVE' },
    { id: 'cp_acct_1', module_id: 'mod_accounts', title: 'Cash Reconciliation', description: 'Daily cash balance reconciliation between POS and system', score: 5, is_accuracy_required: true, is_corrective_action_required: true, is_photo_required: true, display_order: 1, status: 'ACTIVE' },
    { id: 'cp_acct_2', module_id: 'mod_accounts', title: 'GST Filing Tracker', description: 'Verify GST return filing status and deadlines', score: 5, is_accuracy_required: true, is_corrective_action_required: false, is_photo_required: false, display_order: 2, status: 'ACTIVE' },
    { id: 'cp_db_1', module_id: 'mod_db', title: 'Backup Validation', description: 'Verify all database backups completed successfully', score: 5, is_accuracy_required: true, is_corrective_action_required: true, is_photo_required: false, display_order: 1, status: 'ACTIVE' },
    { id: 'cp_db_2', module_id: 'mod_db', title: 'Replication Health Check', description: 'Check replication lag and sync status across nodes', score: 5, is_accuracy_required: true, is_corrective_action_required: false, is_photo_required: false, display_order: 2, status: 'ACTIVE' },
  ]);

  // 6. Locations
  console.log('6. Locations');
  await upsert('locations', [
    { id: 'loc_hq', name: 'Head Office', code: 'HQ', address: '123 Business Park, Mumbai, India', status: 'ACTIVE' },
    { id: 'loc_branch', name: 'Branch Office', code: 'BR', address: '456 Commerce Center, Delhi, India', status: 'ACTIVE' },
  ]);

  // 7. System Settings
  console.log('7. System Settings');
  await upsert('system_settings', [
    { id: 'ss_1', key: 'app_name', value: 'BSC Exclusive', type: 'string', category: 'general' },
    { id: 'ss_2', key: 'timezone', value: 'Asia/Kolkata', type: 'string', category: 'general' },
    { id: 'ss_3', key: 'max_file_size', value: '10', type: 'number', category: 'general' },
    { id: 'ss_4', key: 'allowed_file_types', value: 'image/jpeg,image/png,image/webp', type: 'string', category: 'general' },
    { id: 'ss_5', key: 'autosave_interval', value: '800', type: 'number', category: 'general' },
  ]);

  // 8. Permissions
  console.log('8. Permissions');
  const perms = [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:reset_password',
    'roles:view', 'roles:manage',
    'departments:view', 'departments:create', 'departments:edit', 'departments:delete',
    'modules:view', 'modules:create', 'modules:edit', 'modules:delete',
    'checkpoints:view', 'checkpoints:create', 'checkpoints:edit', 'checkpoints:delete',
    'assignments:view', 'assignments:create', 'assignments:delete',
    'submissions:view', 'submissions:approve', 'submissions:reject', 'submissions:own',
    'evidence:view', 'evidence:upload', 'evidence:delete',
    'reports:view', 'reports:export',
    'audit_logs:view',
    'settings:view', 'settings:edit',
  ];
  await upsert('permissions', perms.map((p, i) => ({
    id: 'perm_' + (i + 1),
    name: p,
    description: p.replace(':', ' '),
    category: p.split(':')[0],
  })));

  // 9. Role Permissions (ADMIN gets all)
  console.log('9. Role Permissions');
  const allPerms = perms.map((p, i) => ({ id: 'perm_' + (i + 1), name: p }));
  await upsert('role_permissions', allPerms.map(p => ({
    id: 'rp_admin_' + p.id,
    role_id: 'role_admin',
    permission_id: p.id,
  })));

  // USER permissions
  const userPerms = allPerms.filter(p => ['submissions:own', 'evidence:upload', 'modules:view', 'checkpoints:view'].includes(p.name));
  await upsert('role_permissions', userPerms.map(p => ({
    id: 'rp_user_' + p.id,
    role_id: 'role_user',
    permission_id: p.id,
  })));

  // SUPERVISOR permissions
  const supPerms = allPerms.filter(p => ['submissions:view', 'submissions:approve', 'submissions:reject', 'evidence:view', 'reports:view', 'modules:view', 'checkpoints:view', 'assignments:view', 'submissions:own', 'evidence:upload'].includes(p.name));
  await upsert('role_permissions', supPerms.map(p => ({
    id: 'rp_supervisor_' + p.id,
    role_id: 'role_supervisor',
    permission_id: p.id,
  })));

  // 10. User Locations
  console.log('10. User Locations');
  await upsert('user_locations', [
    { user_id: 'user_admin', location_id: 'loc_hq' },
    { user_id: 'user_demo', location_id: 'loc_hq' },
  ]);

  // 11. Checkpoint Assignments for admin user
  console.log('11. Checkpoint Assignments');
  const today = new Date().toISOString().split('T')[0];
  const cpIds = ['cp_crm_1', 'cp_crm_2', 'cp_crm_3', 'cp_wh_1', 'cp_sales_1'];
  await upsert('checkpoint_assignments', cpIds.map((cpId, i) => ({
    id: 'assign_admin_' + (i + 1),
    checkpoint_id: cpId,
    user_id: 'user_admin',
    assigned_date: today,
    frequency: 'DAILY',
    status: 'ACTIVE',
  })));

  console.log('\nSeed complete!');
}

main().catch(console.error);
