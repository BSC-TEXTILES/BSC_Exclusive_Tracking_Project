// BSC Exclusive Tracking — Database initializer (schema + seed)
// Usage: node init.mjs   (config via DATABASE_URL in .env)
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const { Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TARGET_DB = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://')).pathname.replace('/', '')
  : 'bsc_exclusive_tracking'

const MAINT_URL = (process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bsc_exclusive_tracking')
  .replace(new RegExp(`/${TARGET_DB}(\\?.*)?$`), '/postgres$1')

// ------------------------------------------------------------
// Date helpers (Asia/Kolkata)
// ------------------------------------------------------------
function istNow() {
  return new Date(Date.now() + (5.5 * 60 + 30) * 60000)
}
function istDateStr(d) {
  return d.toISOString().slice(0, 10)
}
function daysAgoDate(n) {
  const d = istNow()
  d.setDate(d.getDate() - n)
  return d
}
function atTime(date, hh, mm = 0) {
  const t = new Date(date)
  t.setUTCHours(hh - 5, mm - 30, 0, 0) // IST -> UTC
  return t
}

async function main() {
  const isCloud = /(supabase|pooler|rds\.amazonaws|render\.com)/i.test(process.env.DATABASE_URL || '')
  const sslOption = isCloud ? { rejectUnauthorized: false } : undefined

  // 1. Ensure database exists (skip for Supabase / hosted postgres)
  if (!isCloud && TARGET_DB !== 'postgres') {
    const maint = new Client({ connectionString: MAINT_URL, ssl: sslOption })
    await maint.connect()
    const { rows } = await maint.query('SELECT 1 FROM pg_database WHERE datname = $1', [TARGET_DB])
    if (rows.length === 0) {
      await maint.query(`CREATE DATABASE "${TARGET_DB}"`)
      console.log(`[database] Created database "${TARGET_DB}"`)
    } else {
      console.log(`[database] Database "${TARGET_DB}" already exists`)
    }
    await maint.end()
  }

  // 2. Apply schema
  const db = new Client({
    connectionString: process.env.DATABASE_URL || `postgresql://postgres:postgres@localhost:5432/${TARGET_DB}`,
    ssl: sslOption,
  })
  await db.connect()
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await db.query(schema)
  console.log('[database] Schema applied')

  // 3. Seed
  const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123456'
  const ADMIN_USERNAME = process.env.INITIAL_ADMIN_USERNAME || 'admin'
  const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || 'admin@bscexclusive.com'
  const hash = (p) => bcrypt.hashSync(p, 10)

  // ---- Roles & permissions
  const ROLES = [
    ['ADMIN', 'Full access to every part of the system'],
    ['MANAGER', 'Reviews submissions, approves/rejects, views all reports'],
    ['SUPERVISOR', 'Manages team, reviews submissions, views reports'],
    ['AUDITOR', 'Read-only access to submissions, evidence, reports and audit logs'],
    ['USER', 'Submits own compliance reports with evidence'],
    ['VIEWER', 'Read-only on own submissions, evidence and reports'],
  ]
  const PERMISSIONS = [
    ['users:view', 'User Management', 'View users'],
    ['users:create', 'User Management', 'Create users'],
    ['users:edit', 'User Management', 'Edit users'],
    ['users:delete', 'User Management', 'Delete users'],
    ['users:activate', 'User Management', 'Activate users'],
    ['users:deactivate', 'User Management', 'Deactivate users'],
    ['users:reset_password', 'User Management', 'Reset user passwords'],
    ['departments:view', 'Department Management', 'View departments'],
    ['departments:create', 'Department Management', 'Create departments'],
    ['departments:edit', 'Department Management', 'Edit departments'],
    ['departments:delete', 'Department Management', 'Delete departments'],
    ['modules:view', 'Module Management', 'View modules'],
    ['modules:create', 'Module Management', 'Create modules'],
    ['modules:edit', 'Module Management', 'Edit modules'],
    ['modules:delete', 'Module Management', 'Delete modules'],
    ['checkpoints:view', 'Checkpoint Management', 'View checkpoints'],
    ['checkpoints:create', 'Checkpoint Management', 'Create checkpoints'],
    ['checkpoints:edit', 'Checkpoint Management', 'Edit checkpoints'],
    ['checkpoints:delete', 'Checkpoint Management', 'Delete checkpoints'],
    ['assignments:view', 'Assignment Management', 'View assignments'],
    ['assignments:create', 'Assignment Management', 'Create assignments'],
    ['assignments:edit', 'Assignment Management', 'Edit assignments'],
    ['assignments:delete', 'Assignment Management', 'Delete assignments'],
    ['submissions:view_own', 'Submissions', 'View own submissions'],
    ['submissions:view_all', 'Submissions', 'View all submissions'],
    ['submissions:create', 'Submissions', 'Create submissions'],
    ['submissions:edit_own', 'Submissions', 'Edit own submissions'],
    ['submissions:review', 'Submissions', 'Review submissions'],
    ['submissions:approve', 'Submissions', 'Approve submissions'],
    ['submissions:reject', 'Submissions', 'Reject submissions'],
    ['evidence:upload', 'Evidence', 'Upload evidence files'],
    ['evidence:view_own', 'Evidence', 'View own evidence'],
    ['evidence:view_all', 'Evidence', 'View all evidence'],
    ['evidence:delete', 'Evidence', 'Delete evidence'],
    ['reports:view_own', 'Reports', 'View own reports'],
    ['reports:view_all', 'Reports', 'View all reports'],
    ['reports:export', 'Reports', 'Export reports'],
    ['audit_logs:view', 'Audit Logs', 'View audit logs'],
    ['settings:view', 'Settings', 'View settings'],
    ['settings:edit', 'Settings', 'Edit settings'],
    ['admin:access', 'Admin Panel', 'Access the admin panel'],
    ['tracking:view_all', 'Live Tracking', 'View all live locations'],
    ['tracking:update', 'Live Tracking', 'Update own location'],
  ]
  const ROLE_PERMS = {
    ADMIN: PERMISSIONS.map((p) => p[0]),
    MANAGER: ['submissions:view_all', 'submissions:review', 'submissions:approve', 'submissions:reject',
      'evidence:view_all', 'reports:view_all', 'reports:export', 'submissions:view_own', 'submissions:create',
      'submissions:edit_own', 'evidence:upload', 'evidence:view_own', 'reports:view_own', 'tracking:view_all', 'tracking:update'],
    SUPERVISOR: ['submissions:view_all', 'submissions:review', 'evidence:view_all', 'reports:view_all',
      'submissions:view_own', 'submissions:create', 'submissions:edit_own', 'evidence:upload', 'evidence:view_own',
      'reports:view_own', 'tracking:view_all', 'tracking:update'],
    AUDITOR: ['submissions:view_all', 'evidence:view_all', 'reports:view_all', 'reports:export', 'audit_logs:view', 'tracking:view_all'],
    USER: ['submissions:view_own', 'submissions:create', 'submissions:edit_own', 'evidence:upload',
      'evidence:view_own', 'reports:view_own', 'tracking:update'],
    VIEWER: ['submissions:view_own', 'evidence:view_own', 'reports:view_own'],
  }

  const roleIds = {}
  for (const [name, desc] of ROLES) {
    const r = await db.query(
      'INSERT INTO roles (name, description) VALUES ($1,$2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description RETURNING id',
      [name, desc]
    )
    roleIds[name] = r.rows[0].id
  }
  const permIds = {}
  for (const [name, category, desc] of PERMISSIONS) {
    const p = await db.query(
      'INSERT INTO permissions (name, category, description) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING RETURNING id',
      [name, category, desc]
    )
    if (p.rows[0]) permIds[name] = p.rows[0].id
    else {
      const ex = await db.query('SELECT id FROM permissions WHERE name = $1', [name])
      permIds[name] = ex.rows[0].id
    }
  }
  for (const [roleName, perms] of Object.entries(ROLE_PERMS)) {
    for (const pname of perms) {
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [roleIds[roleName], permIds[pname]]
      )
    }
  }
  console.log('[database] Seeded roles & permissions')

  // ---- Departments & locations
  const deptIds = {}
  for (const [name, code, desc] of [
    ['Operations', 'OPS', 'Warehouse, purchase and field operations'],
    ['Sales', 'SAL', 'Sales and client relationship'],
    ['HR', 'HR', 'Human resources and administration'],
    ['Accounts', 'ACC', 'Accounts, finance and audit'],
    ['IT', 'IT', 'Information technology and databases'],
  ]) {
    const d = await db.query(
      'INSERT INTO departments (name, code, description) VALUES ($1,$2,$3) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description RETURNING id',
      [name, code, desc]
    )
    deptIds[name] = d.rows[0].id
  }
  for (const [name, code, address, lat, lng] of [
    ['Head Office - Mumbai', 'HO-MUM', 'BSC House, Andheri East, Mumbai 400069', 19.1136, 72.8697],
    ['Branch Office - Thane', 'BR-THN', 'BSC Towers, Ghodbunder Road, Thane 400607', 19.2183, 72.9781],
  ]) {
    await db.query(
      'INSERT INTO locations (name, code, address, latitude, longitude) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (name) DO NOTHING',
      [name, code, address, lat, lng]
    )
  }
  console.log('[database] Seeded departments & locations')

  // ---- Users
  const admin = await db.query(
    `INSERT INTO users (employee_code, full_name, email, username, password_hash, role_id, department_id)
     VALUES ('EMP0001', $1, $2, $3, $4, $5, $6)
     ON CONFLICT (username) DO NOTHING RETURNING id`,
    ['System Administrator', ADMIN_EMAIL, ADMIN_USERNAME, hash(ADMIN_PASSWORD), roleIds.ADMIN, deptIds.IT]
  )
  let adminId = admin.rows[0]?.id
  if (!adminId) {
    adminId = (await db.query('SELECT id FROM users WHERE username = $1', [ADMIN_USERNAME])).rows[0].id
  }
  const users = [
    ['EMP0002', 'Mike Ross', 'mike.ross@bscexclusive.com', 'mike.ross', 'Manager@123', 'MANAGER', 'Accounts'],
    ['EMP0003', 'Jane Smith', 'jane.smith@bscexclusive.com', 'jane.smith', 'Supervisor@123', 'SUPERVISOR', 'Operations'],
    ['EMP0004', 'John Doe', 'john.doe@bscexclusive.com', 'john.doe', 'User@123456', 'USER', 'Sales'],
    ['EMP0005', 'Sarah Lee', 'sarah.lee@bscexclusive.com', 'sarah.lee', 'User@123456', 'USER', 'Sales'],
  ]
  const userIds = {}
  for (const [code, fullName, email, username, password, role, dept] of users) {
    const u = await db.query(
      `INSERT INTO users (employee_code, full_name, email, username, password_hash, role_id, department_id, reporting_manager_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (username) DO NOTHING RETURNING id`,
      [code, fullName, email, username, hash(password), roleIds[role], deptIds[dept],
        role === 'USER' ? (await db.query('SELECT id FROM users WHERE username = $1', ['jane.smith'])).rows[0]?.id : null]
    )
    userIds[username] = u.rows[0]?.id
    if (!userIds[username]) {
      userIds[username] = (await db.query('SELECT id FROM users WHERE username = $1', [username])).rows[0].id
    }
  }
  console.log('[database] Seeded users (admin / ' + Object.keys(userIds).join(' / ') + ')')

  // ---- Modules & checkpoints
  const MODULES = [
    ['CRM', deptIds.Sales, 'crm', 'Customer relationship management process', 1],
    ['Sales', deptIds.Sales, 'sales', 'Daily sales process and order management', 2],
    ['HR', deptIds.HR, 'hr', 'Human resources compliance process', 3],
    ['Accounts', deptIds.Accounts, 'accounts', 'Accounts and finance compliance process', 4],
    ['Warehouse & Purchase', deptIds.Operations, 'warehouse-purchase', 'Warehouse stock and purchase process', 5],
    ['Database', deptIds.IT, 'database', 'Database administration and data integrity process', 6],
  ]
  const CHECKPOINTS = {
    crm: [
      ['Daily lead follow-up', 'Follow up with all leads assigned today and log the outcome.', true, false, false],
      ['Update customer pipeline', 'Update stage, value and next action for every open opportunity.', true, false, false],
      ['CRM data hygiene check', 'Verify contact details and remove duplicate records.', false, false, true],
    ],
    sales: [
      ['Daily sales report entry', 'Enter today\'s sales figures into the reporting system.', true, false, true],
      ['Quotation follow-up', 'Follow up on all quotations sent in the last 3 days.', false, true, false],
      ['Order confirmation check', 'Confirm dispatch dates for all open orders.', true, false, false],
    ],
    hr: [
      ['Attendance reconciliation', 'Reconcile attendance records with biometric data.', true, true, false],
      ['Leave request processing', 'Process all pending leave requests for the day.', false, false, false],
      ['New hire documentation', 'Complete document collection for new joiners.', false, false, true],
    ],
    accounts: [
      ['Daily cash reconciliation', 'Reconcile cash book with bank statements.', true, true, true],
      ['Invoice verification', 'Verify invoices received against purchase orders.', true, false, false],
      ['Vendor payment schedule', 'Update vendor payment schedule and clear dues.', false, true, false],
    ],
    'warehouse-purchase': [
      ['Stock audit - daily', 'Audit stock levels for all high-value items.', true, true, true],
      ['Purchase order review', 'Review open purchase orders and follow up with vendors.', false, true, false],
      ['GRN verification', 'Verify goods receipt notes against deliveries.', true, false, false],
    ],
    database: [
      ['Daily backup verification', 'Verify last night\'s backups completed successfully.', true, false, false],
      ['Access control review', 'Review database user access and revoke stale accounts.', false, true, false],
      ['Data integrity check', 'Run integrity checks on critical tables.', true, false, true],
    ],
  }
  const moduleIds = {}
  for (const [name, deptId, slug, desc, order] of MODULES) {
    const m = await db.query(
      'INSERT INTO modules (department_id, name, slug, description, display_order) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (slug) DO NOTHING RETURNING id',
      [deptId, name, slug, desc, order]
    )
    moduleIds[slug] = m.rows[0]?.id
    if (!moduleIds[slug]) moduleIds[slug] = (await db.query('SELECT id FROM modules WHERE slug = $1', [slug])).rows[0].id
  }
  const existingCheckpoints = (await db.query('SELECT COUNT(*)::int AS c FROM checkpoints')).rows[0].c
  if (existingCheckpoints === 0) {
    for (const [slug, cps] of Object.entries(CHECKPOINTS)) {
      for (let i = 0; i < cps.length; i++) {
        const [title, desc, acc, corr, photo] = cps[i]
        await db.query(
          `INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, created_by)
           VALUES ($1,$2,$3,5,$4,$5,$6,$7,$8)`,
          [moduleIds[slug], title, desc, acc, corr, photo, i + 1, adminId]
        )
      }
    }
    console.log('[database] Seeded modules & checkpoints')
  } else {
    console.log('[database] Checkpoints already present, skipping checkpoint seed')
  }

  // ---- Supervisor setup (Jane Smith)
  await db.query(
    `INSERT INTO supervisor_profiles (user_id, designation, joining_date, bio, specialization)
     VALUES ($1, 'Senior Operations Supervisor', '2023-01-16', 'Experienced field operations supervisor with 8+ years of compliance management.', 'Field Operations & Process Compliance')
     ON CONFLICT (user_id) DO NOTHING`,
    [userIds['jane.smith']]
  )
  for (const [dept, primary] of [['Sales', true], ['Operations', false]]) {
    await db.query(
      'INSERT INTO supervisor_departments (supervisor_id, department_id, is_primary) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [userIds['jane.smith'], deptIds[dept], primary]
    )
  }
  for (const emp of ['john.doe', 'sarah.lee']) {
    await db.query(
      'INSERT INTO supervisor_employees (supervisor_id, employee_id, department_id, assignment_reason) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [userIds['jane.smith'], userIds[emp], deptIds.Sales, 'Team assignment']
    )
  }
  for (const slug of ['crm', 'sales']) {
    await db.query(
      'INSERT INTO supervisor_projects (supervisor_id, module_id, responsibility) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [userIds['jane.smith'], moduleIds[slug], 'End-to-end process ownership']
    )
  }
  console.log('[database] Seeded supervisor setup')

  // ---- Assignments & submissions (last 14 days) for demo users
  const existingAssignments = (await db.query('SELECT COUNT(*)::int AS c FROM checkpoint_assignments')).rows[0].c
  if (existingAssignments === 0) {
    const COMPLIANCE = ['FULLY_FOLLOWED', 'PARTIALLY_FOLLOWED', 'NOT_FOLLOWED', 'NO_TRANSACTION', 'YET_TO_IMPLEMENT']
    const ACCURACY = ['FULLY_ACCURATE', 'PARTLY_ACCURATE', 'INACCURATE', 'NA']
    const checkpointRows = (await db.query(
      `SELECT c.id, m.slug FROM checkpoints c JOIN modules m ON m.id = c.module_id ORDER BY m.display_order, c.display_order`
    )).rows
    const userChecks = {
      'john.doe': checkpointRows.filter((r) => ['crm', 'sales'].includes(r.slug)),
      'sarah.lee': checkpointRows.filter((r) => ['crm', 'sales'].includes(r.slug)),
    }

    for (const username of ['john.doe', 'sarah.lee']) {
      const cps = userChecks[username]
      for (let dayOffset = 14; dayOffset >= 0; dayOffset--) {
        const day = daysAgoDate(dayOffset)
        const dateStr = istDateStr(day)
        const today = dayOffset === 0
        const picks = today ? cps.slice(0, 2) : cps.slice(0, 2)
        for (const cp of picks) {
          const dueDate = istDateStr(daysAgoDate(dayOffset - 1))
          const a = await db.query(
            `INSERT INTO checkpoint_assignments (checkpoint_id, user_id, assigned_date, due_date, frequency)
             VALUES ($1,$2,$3,$4,'DAILY') ON CONFLICT DO NOTHING RETURNING id`,
            [cp.id, userIds[username], dateStr, dueDate]
          )
          if (!a.rows[0]) continue
          const assignmentId = a.rows[0].id

          let status = 'APPROVED'
          if (dayOffset === 0) status = username === 'john.doe' ? 'SUBMITTED' : 'DRAFT'
          else if (dayOffset === 1) status = 'SUBMITTED'
          else if (dayOffset === 4) status = 'REJECTED'
          else if (dayOffset === 7) status = 'DRAFT'

          const submittedAt = status === 'DRAFT' ? null : atTime(day, 10, 30)
          if (status === 'SUBMITTED' && dayOffset === 1 && username === 'john.doe') {
            // older than the auto-approval window -> cron will auto-approve this one (live demo)
            submittedAt.setHours(submittedAt.getHours() - 20)
          }
          const approvedAt = status === 'APPROVED' ? atTime(day, 16, 45) : null
          const rejectedAt = status === 'REJECTED' ? atTime(day, 12, 10) : null
          const s = await db.query(
            `INSERT INTO checkpoint_submissions (checkpoint_id, user_id, assignment_id, submission_date, status, submitted_at, approved_at, rejected_at, reviewed_by, review_comment)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [cp.id, userIds[username], assignmentId, dateStr, status, submittedAt, approvedAt, rejectedAt,
              status === 'APPROVED' || status === 'REJECTED' ? userIds['jane.smith'] : null,
              status === 'REJECTED' ? 'Missing supporting evidence. Please re-submit with the required documents.' :
              status === 'APPROVED' ? 'Verified. Good work.' : null]
          )
          const submissionId = s.rows[0].id
          const ci = dayOffset % COMPLIANCE.length
          await db.query(
            `INSERT INTO submission_answers (submission_id, compliance_status, accuracy_status, comments, corrective_action)
             VALUES ($1,$2,$3,$4,$5)`,
            [submissionId,
              status === 'DRAFT' ? null : COMPLIANCE[ci],
              status === 'DRAFT' ? null : ACCURACY[dayOffset % ACCURACY.length],
              status === 'DRAFT' ? null : 'Daily process executed as per checklist.',
              status === 'REJECTED' ? 'Resubmitted with updated documents.' : null]
          )
          if (status === 'SUBMITTED' || status === 'APPROVED' || status === 'REJECTED') {
            await db.query(
              `INSERT INTO supervisor_approvals (submission_id, supervisor_id, status, approval_date, rejection_reason, supervisor_comments)
               VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (submission_id) DO NOTHING`,
              [submissionId, userIds['jane.smith'],
                status === 'SUBMITTED' ? 'PENDING' : status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
                approvedAt || rejectedAt, status === 'REJECTED' ? 'Evidence incomplete' : null,
                status === 'REJECTED' ? 'Please attach purchase documents.' : 'Reviewed by supervisor.']
            )
          }
        }
      }
    }
    console.log('[database] Seeded 14 days of assignments & submissions')
  } else {
    console.log('[database] Assignments already present, skipping history seed')
  }

  // ---- Location tracks (live tracking demo)
  const trackCount = (await db.query('SELECT COUNT(*)::int AS c FROM location_tracks')).rows[0].c
  if (trackCount === 0) {
    const tracks = [
      [userIds['john.doe'], 19.1136, 72.8697, 12.5, 'Andheri East, Mumbai', 82, 4],   // live (4 min ago)
      [userIds['sarah.lee'], 19.2183, 72.9781, 18.2, 'Ghodbunder Road, Thane', 91, 42], // offline (42 min ago)
      [userIds['jane.smith'], 19.0330, 73.0297, 9.8, 'Dombivli East, Thane', 76, 2],   // live (2 min ago)
    ]
    for (const [uid, lat, lng, acc, addr, battery, minsAgo] of tracks) {
      const t = new Date(Date.now() - minsAgo * 60000)
      await db.query(
        'INSERT INTO location_tracks (user_id, latitude, longitude, accuracy, address, battery_level, tracked_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [uid, lat, lng, acc, addr, battery, t]
      )
    }
    await db.query('INSERT INTO user_locations (user_id, location_id) SELECT $1, id FROM locations WHERE code = $2 ON CONFLICT DO NOTHING', [userIds['john.doe'], 'HO-MUM'])
    console.log('[database] Seeded live location tracks')
  }

  // ---- System settings
  const SETTINGS = [
    ['app_name', 'BSC Exclusive Tracking', 'string', 'general'],
    ['company_name', 'BSC Exclusive', 'string', 'general'],
    ['support_email', 'support@bscexclusive.com', 'string', 'general'],
    ['auto_approve_hours', '1', 'number', 'approval'],
    ['tracking_interval_minutes', '30', 'number', 'tracking'],
    ['max_file_size_mb', '25', 'number', 'storage'],
  ]
  for (const [k, v, type, cat] of SETTINGS) {
    await db.query(
      'INSERT INTO system_settings (key, value, type, category) VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type, category = EXCLUDED.category',
      [k, v, type, cat]
    )
  }

  // ---- Notifications
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, link_url)
     VALUES ($1, 'Welcome to BSC Exclusive Tracking', 'Your account is ready. Complete today''s assigned checkpoints before the due date.', 'info', '/dashboard')
     ON CONFLICT DO NOTHING`,
    [userIds['john.doe']]
  )
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, link_url)
     SELECT $1, 'Submissions awaiting review', 'You have submissions waiting for your approval.', 'warning', '/admin/submissions'
     WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = $1 AND title = 'Submissions awaiting review')`,
    [adminId]
  )

  // ---- Audit logs (seed)
  const logCount = (await db.query('SELECT COUNT(*)::int AS c FROM audit_logs')).rows[0].c
  if (logCount === 0) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
       VALUES ($1, 'SYSTEM_INITIALIZED', 'system', NULL, '127.0.0.1', 'seed-script')`,
      [adminId]
    )
  }

  // ---- Assign John Doe to his registered office location (done above)
  console.log('[database] Seeded settings, notifications & audit seed')
  console.log('\n========================================')
  console.log(' BSC Exclusive Tracking database is ready')
  console.log('  Admin login    : ' + ADMIN_USERNAME + ' / ' + ADMIN_PASSWORD)
  console.log('  Demo user      : john.doe / User@123456')
  console.log('  Supervisor     : jane.smith / Supervisor@123')
  console.log('  Manager        : mike.ross / Manager@123')
  console.log('========================================')
  await db.end()
}

main().catch((err) => {
  console.error('[database] Initialization failed:', err.message)
  process.exit(1)
})
