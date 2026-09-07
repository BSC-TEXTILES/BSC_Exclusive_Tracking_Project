import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { config } from '../config.js'
import { query } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { ah, fail, isValidDate, istToday, ok } from '../utils/http.js'
import { logAudit } from '../utils/audit.js'
import { notifyUser } from '../utils/notify.js'
import { reviewSubmission } from '../utils/review.js'
import { unlockUser } from '../middleware/rateLimit.js'

const router = Router()
router.use(requireAuth)
router.use(requirePermission('admin:access'))

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'module'

// ============================================================
// ADMIN DASHBOARD — everything at a glance
// ============================================================
router.get(
  '/dashboard',
  ah(async (_req, res) => {
    const [users, departments, modules, checkpoints, submissions, pendingReview, approvedToday,
      evidence, trackers, rolesCount, trend, statusDist, deptPerf, recent, latestTracks, audit, activeDevices] = await Promise.all([
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM users WHERE status = 'ACTIVE'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM departments WHERE status = 'ACTIVE'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM modules WHERE status = 'ACTIVE'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM checkpoints WHERE status = 'ACTIVE'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM checkpoint_submissions`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE status = 'SUBMITTED'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE status = 'APPROVED' AND approved_at >= CURRENT_DATE`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM evidence_files`),
      query<{ c: number }>(
        `SELECT COUNT(DISTINCT user_id)::int AS c FROM location_tracks
         WHERE tracked_at >= NOW() - ($1 * INTERVAL '1 minute')`,
        [config.onlineWindowMinutes]
      ),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM roles`),
      query<{ day: string; total: number; approved: number }>(
        `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                COUNT(s.id)::int AS total,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved
         FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') d
         LEFT JOIN checkpoint_submissions s ON s.submission_date = d::date
         GROUP BY d ORDER BY d`
      ),
      query<{ status: string; c: number }>(
        `SELECT status, COUNT(*)::int AS c FROM checkpoint_submissions GROUP BY status`
      ),
      query<{ name: string; total: number; approved: number; pending: number; rejected: number }>(
        `SELECT d.name, COUNT(s.id)::int AS total,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved,
                COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED','PENDING','DRAFT'))::int AS pending,
                COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected
         FROM departments d
         LEFT JOIN users u ON u.department_id = d.id
         LEFT JOIN checkpoint_submissions s ON s.user_id = u.id
         GROUP BY d.name ORDER BY total DESC`
      ),
      query<{
        id: string; user_name: string; checkpoint_title: string; module_name: string;
        status: string; submission_date: string; updated_at: string
      }>(
        `SELECT s.id, u.full_name AS user_name, c.title AS checkpoint_title, m.name AS module_name,
                s.status, s.submission_date::text, s.updated_at
         FROM checkpoint_submissions s
         JOIN users u ON u.id = s.user_id
         JOIN checkpoints c ON c.id = s.checkpoint_id
         JOIN modules m ON m.id = c.module_id
         ORDER BY s.updated_at DESC LIMIT 10`
      ),
      query<{
        full_name: string; role_name: string; department_name: string | null;
        latitude: number; longitude: number; address: string | null; battery_level: number | null;
        tracked_at: string; online: boolean
      }>(
        `SELECT DISTINCT ON (u.id) u.full_name, r.name AS role_name, d.name AS department_name,
                lt.latitude, lt.longitude, lt.address, lt.battery_level, lt.tracked_at,
                (lt.tracked_at >= NOW() - ($1 * INTERVAL '1 minute')) AS online
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN location_tracks lt ON lt.user_id = u.id
         WHERE u.status = 'ACTIVE' AND r.name <> 'ADMIN'
         ORDER BY u.id, lt.tracked_at DESC NULLS LAST`,
        [config.onlineWindowMinutes]
      ),
      query<{ id: string; user_name: string | null; action: string; entity_type: string; created_at: string }>(
        `SELECT al.id, u.full_name AS user_name, al.action, al.entity_type, al.created_at
         FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC LIMIT 8`
      ),
      query<{
        user_id: string
        full_name: string
        employee_code: string
        role_name: string
        ip_address: string
        device_info: string
        device_type: string
        last_login_at: string
      }>(
        `SELECT DISTINCT ON (u.id)
                u.id AS user_id, u.full_name, u.employee_code, r.name AS role_name,
                COALESCE(u.last_login_ip, s.ip_address, '127.0.0.1') AS ip_address,
                COALESCE(u.last_login_device, s.device_info, 'System / PC (Web Browser)') AS device_info,
                COALESCE(u.last_login_device_type, s.device_type, 'Desktop') AS device_type,
                COALESCE(u.last_login_at, s.created_at) AS last_login_at
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN sessions s ON s.user_id = u.id
         WHERE u.last_login_at IS NOT NULL OR s.id IS NOT NULL
         ORDER BY u.id, COALESCE(u.last_login_at, s.created_at) DESC NULLS LAST
         LIMIT 12`
      ),
    ])

    ok(res, {
      counts: {
        users: users.rows[0].c,
        departments: departments.rows[0].c,
        modules: modules.rows[0].c,
        checkpoints: checkpoints.rows[0].c,
        submissions: submissions.rows[0].c,
        pendingReview: pendingReview.rows[0].c,
        approvedToday: approvedToday.rows[0].c,
        evidence: evidence.rows[0].c,
        onlineTrackers: trackers.rows[0].c,
        roles: rolesCount.rows[0].c,
      },
      trend: trend.rows,
      statusDistribution: statusDist.rows,
      departmentPerformance: deptPerf.rows,
      recentSubmissions: recent.rows,
      latestTracks: latestTracks.rows,
      recentAudit: audit.rows,
      recentActiveDevices: activeDevices.rows,
    })
  })
)

// ============================================================
// USERS
// ============================================================
router.get(
  '/users',
  ah(async (req, res) => {
    const { search, role, status } = req.query as Record<string, string>
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let i = 1
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(u.full_name ILIKE $${i} OR u.email ILIKE $${i} OR u.username ILIKE $${i} OR u.employee_code ILIKE $${i})`)
      i++
    }
    if (role) {
      params.push(role)
      conditions.push(`r.name = $${i++}`)
    }
    if (status) {
      params.push(status)
      conditions.push(`u.status = $${i++}`)
    }
    const { rows } = await query(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.username, u.status,
              u.account_type, u.customer_code, u.banned_until, u.restriction_reason, u.restricted_at,
              u.profile_image, u.last_login_at, u.last_login_ip, u.last_login_device, u.last_login_device_type,
              u.created_at, u.department_id,
              r.name AS role_name, d.name AS department_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.created_at DESC`,
      params
    )
    ok(res, { users: rows })
  })
)

const createUserSchema = z.object({
  employeeCode: z.string().min(2).max(50),
  fullName: z.string().min(2).max(150),
  email: z.string().email().max(150),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits').nullable().optional(),
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100).regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain both letters and numbers'),
  roleId: z.string().uuid(),
  departmentId: z.string().uuid().nullable().optional(),
  reportingManagerId: z.string().uuid().nullable().optional(),
  accountType: z.enum(['BSC_USER', 'CUSTOMER']).optional(),
  customerCode: z.string().max(50).nullable().optional(),
})

router.post(
  '/users',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid user data')
    const d = parsed.data
    const acctType = d.accountType || 'BSC_USER'
    const custCode = d.customerCode || (acctType === 'CUSTOMER' ? d.employeeCode : null)
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO users (employee_code, full_name, email, phone, username, password_hash, role_id, department_id, reporting_manager_id, created_by, account_type, customer_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [d.employeeCode, d.fullName, d.email, d.phone || null, d.username, await bcrypt.hash(d.password, 10),
          d.roleId, d.departmentId || null, d.reportingManagerId || null, admin.id, acctType, custCode]
      )
      const newUserId = rows[0].id

      // If creating a customer account, ensure customer table profile exists
      if (acctType === 'CUSTOMER') {
        await query(
          `INSERT INTO customers (customer_code, name, email, phone, whatsapp_number, user_id, created_by)
           VALUES ($1, $2, $3, $4, $4, $5, $6)
           ON CONFLICT (customer_code) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()`,
          [custCode || d.employeeCode, d.fullName, d.email, d.phone || null, newUserId, admin.id]
        )
      }

      await logAudit({ userId: admin.id, action: 'USER_CREATED', entityType: 'user', entityId: newUserId, newValues: { username: d.username, fullName: d.fullName, accountType: acctType }, req })
      ok(res, { id: newUserId })
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('duplicate key')) {
        return fail(res, 409, 'A user with this email, username or employee code already exists')
      }
      throw err
    }
  })
)

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  email: z.string().email().max(150).optional(),
  phone: z.string().max(30).nullable().optional(),
  roleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  reportingManagerId: z.string().uuid().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
})

router.get(
  '/users/:id',
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.username, u.status,
              u.profile_image, u.role_id, u.department_id, u.reporting_manager_id,
              u.last_login_at, u.last_login_ip, u.last_login_device, u.last_login_device_type,
              r.name AS role_name, d.name AS department_name, rm.full_name AS manager_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users rm ON rm.id = u.reporting_manager_id
       WHERE u.id = $1`,
      [req.params.id]
    )
    if (rows.length === 0) return fail(res, 404, 'User not found')
    ok(res, { user: rows[0] })
  })
)

router.put(
  '/users/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid user data')
    const d = parsed.data
    const { rows } = await query<{ id: string }>('SELECT id FROM users WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'User not found')

    await query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         phone = $3,
         role_id = COALESCE($4, role_id),
         department_id = $5,
         reporting_manager_id = $6,
         status = COALESCE($7, status),
         updated_by = $8,
         updated_at = NOW()
       WHERE id = $9`,
      [d.fullName || null, d.email || null,
        d.phone === undefined ? null : d.phone,
        d.roleId || null, d.departmentId === undefined ? null : d.departmentId,
        d.reportingManagerId === undefined ? null : d.reportingManagerId,
        d.status || null, admin.id, req.params.id]
    )
    await logAudit({ userId: admin.id, action: 'USER_UPDATED', entityType: 'user', entityId: req.params.id, newValues: d, req })
    ok(res, { updated: true })
  })
)

router.delete(
  '/users/:id',
  ah(async (req, res) => {
    const admin = req.user!
    if (req.params.id === admin.id) return fail(res, 400, 'You cannot delete your own account')
    const { rows } = await query('SELECT id FROM users WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'User not found')
    await query('DELETE FROM users WHERE id = $1', [req.params.id])
    await logAudit({ userId: admin.id, action: 'USER_DELETED', entityType: 'user', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

router.post(
  '/users/:id/reset-password',
  ah(async (req, res) => {
    const admin = req.user!
    const schema = z.object({
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100)
        .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain both letters and numbers'),
      mustChangePassword: z.boolean().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid password')
    }
    const { rows } = await query<{ id: string; full_name: string }>('SELECT id, full_name FROM users WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'User not found')

    const mustChange = parsed.data.mustChangePassword ?? true
    const hash = await bcrypt.hash(parsed.data.newPassword, 10)

    await query(
      `UPDATE users SET password_hash = $1, must_change_password = $2, updated_at = NOW() WHERE id = $3`,
      [hash, mustChange, req.params.id]
    )
    await query('DELETE FROM sessions WHERE user_id = $1', [req.params.id])
    await notifyUser(req.params.id, {
      title: 'Password reset by administrator',
      message: 'Your password was reset by an administrator. Please log in with your new credentials.',
      type: 'warning',
      linkUrl: '/profile',
    })
    await logAudit({
      userId: admin.id,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: req.params.id,
      newValues: { targetUser: rows[0].full_name, mustChangePassword: mustChange },
      req,
    })
    ok(res, { updated: true, message: `Password for ${rows[0].full_name} updated successfully` })
  })
)

router.post(
  '/users/:id/restrict',
  ah(async (req, res) => {
    const admin = req.user!
    if (req.params.id === admin.id) return fail(res, 400, 'You cannot restrict your own account')

    const schema = z.object({
      timeframe: z.enum(['24_HOURS', '48_HOURS', '7_DAYS', '30_DAYS', 'PERMANENT']),
      reason: z.string().max(500).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid restriction data')

    const { timeframe, reason } = parsed.data
    const { rows } = await query<{ id: string; full_name: string; username: string }>('SELECT id, full_name, username FROM users WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'User not found')

    let intervalSql = "INTERVAL '24 hours'"
    if (timeframe === '48_HOURS') intervalSql = "INTERVAL '48 hours'"
    else if (timeframe === '7_DAYS') intervalSql = "INTERVAL '7 days'"
    else if (timeframe === '30_DAYS') intervalSql = "INTERVAL '30 days'"
    else if (timeframe === 'PERMANENT') intervalSql = "INTERVAL '100 years'"

    const updateRes = await query<{ banned_until: string }>(
      `UPDATE users SET
         status = 'SUSPENDED',
         banned_until = NOW() + ${intervalSql},
         restriction_reason = $1,
         restricted_at = NOW(),
         updated_at = NOW()
       WHERE id = $2 RETURNING banned_until`,
      [reason || 'Administrative account restriction', req.params.id]
    )

    // Clear active sessions
    await query('DELETE FROM sessions WHERE user_id = $1', [req.params.id])

    await notifyUser(req.params.id, {
      title: 'Account Restricted',
      message: `Your account has been restricted until ${new Date(updateRes.rows[0].banned_until).toLocaleString()}. Reason: ${reason || 'Administrative policy'}`,
      type: 'danger',
    })

    await logAudit({
      userId: admin.id,
      action: 'USER_RESTRICTED',
      entityType: 'user',
      entityId: req.params.id,
      newValues: { timeframe, reason, bannedUntil: updateRes.rows[0].banned_until },
      req,
    })

    ok(res, {
      success: true,
      bannedUntil: updateRes.rows[0].banned_until,
      message: `Account for ${rows[0].full_name} restricted successfully`,
    })
  })
)

router.post(
  '/users/:id/unlock',
  ah(async (req, res) => {
    const admin = req.user!
    const { rows } = await query<{ id: string; full_name: string; username: string }>('SELECT id, full_name, username FROM users WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'User not found')

    await query(
      `UPDATE users SET
         status = 'ACTIVE',
         banned_until = NULL,
         restriction_reason = NULL,
         restricted_at = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    )

    // Clear any rate-limit lockout
    unlockUser(rows[0].username)

    await notifyUser(req.params.id, {
      title: 'Account Restored',
      message: 'Your account access has been restored to active status.',
      type: 'info',
    })

    await logAudit({
      userId: admin.id,
      action: 'USER_UNLOCKED',
      entityType: 'user',
      entityId: req.params.id,
      req,
    })

    ok(res, {
      success: true,
      message: `User ${rows[0].full_name} unlocked and restored to Active status`,
    })
  })
)

// User Analytics for Dashboards
router.get(
  '/user-analytics',
  ah(async (_req, res) => {
    const [totals, rolesBreakdown, deptBreakdown, trendRows, recentRegistrations] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE COALESCE(account_type, 'BSC_USER') = 'BSC_USER')::int AS bsc_users,
          COUNT(*) FILTER (WHERE account_type = 'CUSTOMER')::int AS customer_accounts,
          (SELECT COUNT(*)::int FROM customers) AS total_customers_directory,
          COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_count,
          COUNT(*) FILTER (WHERE status = 'INACTIVE')::int AS inactive_count,
          COUNT(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_this_month
        FROM users
      `),
      query(`
        SELECT r.name AS role_name, COUNT(u.id)::int AS count
        FROM roles r
        LEFT JOIN users u ON u.role_id = r.id
        GROUP BY r.name ORDER BY count DESC
      `),
      query(`
        SELECT COALESCE(d.name, 'Unassigned') AS department_name, COUNT(u.id)::int AS count
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        GROUP BY d.name ORDER BY count DESC
      `),
      query(`
        SELECT
          TO_CHAR(d, 'Mon DD') AS label,
          COALESCE(COUNT(u.id), 0)::int AS users_count,
          COALESCE(COUNT(u.id) FILTER (WHERE u.account_type = 'CUSTOMER'), 0)::int AS customers_count
        FROM generate_series(NOW() - INTERVAL '14 days', NOW(), INTERVAL '1 day') d
        LEFT JOIN users u ON DATE(u.created_at) = DATE(d)
        GROUP BY d
        ORDER BY d ASC
      `),
      query(`
        SELECT u.id, u.employee_code, u.full_name, u.email, u.status, u.account_type,
               r.name AS role_name, d.name AS department_name, u.created_at
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN departments d ON d.id = u.department_id
        ORDER BY u.created_at DESC LIMIT 10
      `),
    ])

    ok(res, {
      totals: totals.rows[0],
      rolesBreakdown: rolesBreakdown.rows,
      departmentBreakdown: deptBreakdown.rows,
      trend: trendRows.rows,
      recent: recentRegistrations.rows,
    })
  })
)

// ============================================================
// ROLES & PERMISSIONS
// ============================================================
router.get(
  '/roles',
  ah(async (_req, res) => {
    const { rows } = await query(
      `SELECT r.id, r.name, r.description, r.created_at,
              (SELECT COUNT(*)::int FROM users u WHERE u.role_id = r.id) AS user_count,
              (SELECT COUNT(*)::int FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
              COALESCE((SELECT json_agg(rp.permission_id) FROM role_permissions rp WHERE rp.role_id = r.id), '[]'::json) AS permission_ids,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', u.id,
                  'full_name', u.full_name,
                  'username', u.username,
                  'employee_code', u.employee_code,
                  'email', u.email,
                  'phone', u.phone,
                  'status', u.status,
                  'department_name', d.name,
                  'last_login_at', u.last_login_at,
                  'created_at', u.created_at
                ) ORDER BY u.full_name)
                FROM users u
                LEFT JOIN departments d ON d.id = u.department_id
                WHERE u.role_id = r.id
              ), '[]'::json) AS users
       FROM roles r ORDER BY r.name`
    )
    ok(res, { roles: rows })
  })
)

router.get(
  '/roles/permissions',
  ah(async (_req, res) => {
    const { rows } = await query(
      `SELECT p.id, p.name, p.description, p.category FROM permissions p ORDER BY p.category, p.name`
    )
    const grouped: Record<string, typeof rows> = {}
    for (const p of rows) {
      const cat = p.category || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(p)
    }
    ok(res, { grouped })
  })
)

const roleCreateSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(255).nullable().optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
})

router.post(
  '/roles',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = roleCreateSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid role data')
    const roleName = parsed.data.name.trim().toUpperCase().replace(/\s+/g, '_')
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id`,
        [roleName, parsed.data.description || null]
      )
      const roleId = rows[0].id
      if (parsed.data.permissionIds?.length) {
        for (const pid of parsed.data.permissionIds) {
          await query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [roleId, pid]
          )
        }
      }
      await logAudit({ userId: admin.id, action: 'ROLE_CREATED', entityType: 'role', entityId: roleId, newValues: parsed.data, req })
      ok(res, { id: roleId })
    } catch (err) {
      if ((err as Error).message.includes('duplicate key') || (err as Error).message.includes('unique')) {
        return fail(res, 409, 'A role with this name already exists')
      }
      throw err
    }
  })
)

router.put(
  '/roles/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = z.object({ permissionIds: z.array(z.string().uuid()), description: z.string().max(255).optional() }).safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'permissionIds must be an array of permission IDs')
    const { rows } = await query<{ id: string; name: string }>('SELECT id, name FROM roles WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'Role not found')
    if (rows[0].name === 'ADMIN') return fail(res, 400, 'The ADMIN role always has all permissions')

    if (parsed.data.description !== undefined) {
      await query('UPDATE roles SET description = $1, updated_at = NOW() WHERE id = $2', [parsed.data.description, req.params.id])
    }

    await query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id])
    for (const pid of parsed.data.permissionIds) {
      await query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [req.params.id, pid]
      )
    }
    await logAudit({ userId: admin.id, action: 'ROLE_UPDATED', entityType: 'role', entityId: req.params.id, newValues: { permissions: parsed.data.permissionIds.length }, req })
    ok(res, { updated: true })
  })
)

router.delete(
  '/roles/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const { rows } = await query<{ name: string; user_count: number }>(
      `SELECT r.name, (SELECT COUNT(*)::int FROM users WHERE role_id = r.id) AS user_count
       FROM roles r WHERE r.id = $1`,
      [req.params.id]
    )
    if (rows.length === 0) return fail(res, 404, 'Role not found')
    if (['ADMIN', 'FIELD_EXECUTIVE', 'SUPERVISOR', 'MANAGER', 'CLIENT'].includes(rows[0].name)) {
      return fail(res, 400, 'System default roles cannot be deleted')
    }
    if (rows[0].user_count > 0) {
      return fail(res, 409, `Cannot delete role assigned to ${rows[0].user_count} user(s). Reassign them first.`)
    }
    await query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id])
    await query('DELETE FROM roles WHERE id = $1', [req.params.id])
    await logAudit({ userId: admin.id, action: 'ROLE_DELETED', entityType: 'role', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

// ============================================================
// DEPARTMENTS
// ============================================================
router.get(
  '/departments',
  ah(async (req, res) => {
    const search = (req.query.search as string) || ''
    const params: unknown[] = []
    let where = ''
    if (search) {
      params.push(`%${search}%`)
      where = `WHERE d.name ILIKE $1 OR d.code ILIKE $1`
    }
    const { rows } = await query(
      `SELECT d.id, d.name, d.code, d.description, d.status, d.created_at,
              (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id) AS user_count,
              (SELECT COUNT(*)::int FROM modules m WHERE m.department_id = d.id) AS module_count
       FROM departments d ${where} ORDER BY d.name`,
      params
    )
    ok(res, { departments: rows })
  })
)

const deptSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

router.post(
  '/departments',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = deptSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid department data')
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO departments (name, code, description) VALUES ($1,$2,$3) RETURNING id`,
        [parsed.data.name, parsed.data.code.toUpperCase(), parsed.data.description || null]
      )
      await logAudit({ userId: admin.id, action: 'DEPARTMENT_CREATED', entityType: 'department', entityId: rows[0].id, newValues: parsed.data, req })
      ok(res, { id: rows[0].id })
    } catch (err) {
      if ((err as Error).message.includes('duplicate key')) return fail(res, 409, 'Department name or code already exists')
      throw err
    }
  })
)

router.put(
  '/departments/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = deptSchema.partial().safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid department data')
    const { rows } = await query('SELECT id FROM departments WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'Department not found')
    const d = parsed.data
    await query(
      `UPDATE departments SET name = COALESCE($1, name), code = COALESCE($2, code),
       description = $3, status = COALESCE($4, status), updated_at = NOW() WHERE id = $5`,
      [d.name || null, d.code ? d.code.toUpperCase() : null, d.description === undefined ? null : d.description, d.status || null, req.params.id]
    )
    await logAudit({ userId: admin.id, action: 'DEPARTMENT_UPDATED', entityType: 'department', entityId: req.params.id, newValues: d, req })
    ok(res, { updated: true })
  })
)

router.delete(
  '/departments/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const { rows } = await query<{ user_count: number; module_count: number }>(
      `SELECT (SELECT COUNT(*)::int FROM users WHERE department_id = $1) AS user_count,
              (SELECT COUNT(*)::int FROM modules WHERE department_id = $1) AS module_count`,
      [req.params.id]
    )
    if (rows.length === 0) return fail(res, 404, 'Department not found')
    if (rows[0].user_count > 0 || rows[0].module_count > 0) {
      return fail(res, 409, 'Cannot delete a department that has users or modules')
    }
    await query('DELETE FROM departments WHERE id = $1', [req.params.id])
    await logAudit({ userId: admin.id, action: 'DEPARTMENT_DELETED', entityType: 'department', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

// ============================================================
// MODULES
// ============================================================
router.get(
  '/modules',
  ah(async (req, res) => {
    const search = (req.query.search as string) || ''
    const params: unknown[] = []
    let where = ''
    if (search) {
      params.push(`%${search}%`)
      where = `WHERE m.name ILIKE $1 OR m.slug ILIKE $1`
    }
    const { rows } = await query(
      `SELECT m.id, m.name, m.slug, m.description, m.display_order, m.status, m.created_at,
              d.name AS department_name, m.department_id,
              (SELECT COUNT(*)::int FROM checkpoints c WHERE c.module_id = m.id) AS checkpoint_count,
              (SELECT COUNT(*)::int FROM checkpoint_submissions s JOIN checkpoints c ON c.id = s.checkpoint_id WHERE c.module_id = m.id) AS submission_count
       FROM modules m JOIN departments d ON d.id = m.department_id ${where}
       ORDER BY m.display_order, m.name`,
      params
    )
    ok(res, { modules: rows })
  })
)

const moduleSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().min(2).max(150),
  slug: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

router.post(
  '/modules',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = moduleSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid module data')
    const d = parsed.data
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO modules (department_id, name, slug, description, display_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [d.departmentId, d.name, d.slug || slugify(d.name), d.description || null, d.displayOrder || 0]
      )
      await logAudit({ userId: admin.id, action: 'MODULE_CREATED', entityType: 'module', entityId: rows[0].id, newValues: { name: d.name }, req })
      ok(res, { id: rows[0].id })
    } catch (err) {
      if ((err as Error).message.includes('duplicate key')) return fail(res, 409, 'A module with this slug already exists')
      throw err
    }
  })
)

router.put(
  '/modules/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = moduleSchema.partial().safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid module data')
    const { rows } = await query('SELECT id FROM modules WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'Module not found')
    const d = parsed.data
    await query(
      `UPDATE modules SET department_id = COALESCE($1, department_id), name = COALESCE($2, name),
       slug = COALESCE($3, slug), description = $4, display_order = COALESCE($5, display_order),
       status = COALESCE($6, status), updated_at = NOW() WHERE id = $7`,
      [d.departmentId || null, d.name || null, d.slug || null,
        d.description === undefined ? null : d.description,
        d.displayOrder ?? null, d.status || null, req.params.id]
    )
    await logAudit({ userId: admin.id, action: 'MODULE_UPDATED', entityType: 'module', entityId: req.params.id, newValues: d, req })
    ok(res, { updated: true })
  })
)

router.delete(
  '/modules/:id',
  ah(async (req, res) => {
    const admin = req.user!
    await query('DELETE FROM modules WHERE id = $1', [req.params.id])
    await logAudit({ userId: admin.id, action: 'MODULE_DELETED', entityType: 'module', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

// POST /api/admin/modules/:id/clone — clone a module with all its checkpoints
router.post(
  '/modules/:id/clone',
  ah(async (req, res) => {
    const admin = req.user!
    const { rows: modRows } = await query<{ id: string; name: string; slug: string; description: string | null; department_id: string; display_order: number }>(
      'SELECT id, name, slug, description, department_id, display_order FROM modules WHERE id = $1',
      [req.params.id]
    )
    if (modRows.length === 0) return fail(res, 404, 'Module not found')
    const orig = modRows[0]

    // Create new module with cloned name
    const newSlug = `${orig.slug}-copy-${Date.now()}`
    const { rows: newMod } = await query<{ id: string }>(
      `INSERT INTO modules (name, slug, description, department_id, display_order, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6) RETURNING id`,
      [`${orig.name} (Copy)`, newSlug, orig.description, orig.department_id, orig.display_order + 1, admin.id]
    )
    const newModuleId = newMod[0].id

    // Clone all checkpoints
    const { rows: checkpoints } = await query<{ id: string; title: string; description: string | null; score: number; is_accuracy_required: boolean; is_corrective_action_required: boolean; is_photo_required: boolean; display_order: number }>(
      `SELECT title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order
       FROM checkpoints WHERE module_id = $1`,
      [req.params.id]
    )
    for (const cp of checkpoints) {
      await query(
        `INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required, is_corrective_action_required, is_photo_required, display_order, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9)`,
        [newModuleId, cp.title, cp.description, cp.score, cp.is_accuracy_required, cp.is_corrective_action_required, cp.is_photo_required, cp.display_order, admin.id]
      )
    }

    await logAudit({ userId: admin.id, action: 'MODULE_CLONED', entityType: 'module', entityId: newModuleId, newValues: { clonedFrom: req.params.id, checkpointCount: checkpoints.length }, req })
    ok(res, { id: newModuleId, name: `${orig.name} (Copy)`, checkpointCount: checkpoints.length })
  })
)

// ============================================================
// CHECKPOINTS
// ============================================================
router.get(
  '/checkpoints',
  ah(async (req, res) => {
    const { module, search } = req.query as Record<string, string>
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let i = 1
    if (module) {
      params.push(module)
      conditions.push(`c.module_id = $${i++}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(c.title ILIKE $${i} OR m.name ILIKE $${i})`)
      i++
    }
    const { rows } = await query(
      `SELECT c.id, c.title, c.description, c.score, c.is_accuracy_required,
              c.is_corrective_action_required, c.is_photo_required, c.display_order, c.status, c.created_at,
              m.name AS module_name, m.slug AS module_slug, d.name AS department_name,
              (SELECT COUNT(*)::int FROM checkpoint_submissions s WHERE s.checkpoint_id = c.id) AS submission_count
       FROM checkpoints c
       JOIN modules m ON m.id = c.module_id
       JOIN departments d ON d.id = m.department_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.display_order, c.display_order`,
      params
    )
    ok(res, { checkpoints: rows })
  })
)

const checkpointSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).nullable().optional(),
  score: z.number().int().min(1).max(100).optional(),
  isAccuracyRequired: z.boolean().optional(),
  isCorrectiveActionRequired: z.boolean().optional(),
  isPhotoRequired: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

router.post(
  '/checkpoints',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = checkpointSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid checkpoint data')
    const d = parsed.data
    const { rows } = await query<{ id: string }>(
      `INSERT INTO checkpoints (module_id, title, description, score, is_accuracy_required,
        is_corrective_action_required, is_photo_required, display_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [d.moduleId, d.title, d.description || null, d.score || 5,
        d.isAccuracyRequired ?? false, d.isCorrectiveActionRequired ?? false, d.isPhotoRequired ?? false,
        d.displayOrder || 0, admin.id]
    )
    await logAudit({ userId: admin.id, action: 'CHECKPOINT_CREATED', entityType: 'checkpoint', entityId: rows[0].id, newValues: { title: d.title }, req })
    ok(res, { id: rows[0].id })
  })
)

router.put(
  '/checkpoints/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = checkpointSchema.partial().safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid checkpoint data')
    const { rows } = await query('SELECT id FROM checkpoints WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'Checkpoint not found')
    const d = parsed.data
    await query(
      `UPDATE checkpoints SET module_id = COALESCE($1, module_id), title = COALESCE($2, title),
       description = $3, score = COALESCE($4, score), is_accuracy_required = COALESCE($5, is_accuracy_required),
       is_corrective_action_required = COALESCE($6, is_corrective_action_required),
       is_photo_required = COALESCE($7, is_photo_required), display_order = COALESCE($8, display_order),
       status = COALESCE($9, status), updated_by = $10, updated_at = NOW() WHERE id = $11`,
      [d.moduleId || null, d.title || null, d.description === undefined ? null : d.description,
        d.score ?? null, d.isAccuracyRequired ?? null, d.isCorrectiveActionRequired ?? null,
        d.isPhotoRequired ?? null, d.displayOrder ?? null, d.status || null, admin.id, req.params.id]
    )
    await logAudit({ userId: admin.id, action: 'CHECKPOINT_UPDATED', entityType: 'checkpoint', entityId: req.params.id, newValues: d, req })
    ok(res, { updated: true })
  })
)

router.delete(
  '/checkpoints/:id',
  ah(async (req, res) => {
    const admin = req.user!
    await query('DELETE FROM checkpoints WHERE id = $1', [req.params.id])
    await logAudit({ userId: admin.id, action: 'CHECKPOINT_DELETED', entityType: 'checkpoint', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

// ============================================================
// ASSIGNMENTS
// ============================================================
router.get(
  '/assignments',
  ah(async (req, res) => {
    const { user, checkpoint, date } = req.query as Record<string, string>
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let i = 1
    if (user) {
      params.push(user)
      conditions.push(`a.user_id = $${i++}`)
    }
    if (checkpoint) {
      params.push(checkpoint)
      conditions.push(`a.checkpoint_id = $${i++}`)
    }
    if (isValidDate(date)) {
      params.push(date)
      conditions.push(`a.assigned_date = $${i++}`)
    }
    const { rows } = await query(
      `SELECT a.id, a.assigned_date::text, a.due_date::text, a.frequency, a.status, a.created_at,
              u.full_name AS user_name, u.employee_code, c.title AS checkpoint_title,
              m.name AS module_name, s.status AS submission_status
       FROM checkpoint_assignments a
       JOIN users u ON u.id = a.user_id
       JOIN checkpoints c ON c.id = a.checkpoint_id
       JOIN modules m ON m.id = c.module_id
       LEFT JOIN checkpoint_submissions s ON s.assignment_id = a.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.assigned_date DESC LIMIT 300`,
      params
    )
    ok(res, { assignments: rows })
  })
)

const assignmentSchema = z.object({
  checkpointId: z.string().uuid(),
  userId: z.string().uuid(),
  assignedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME']).optional(),
})

router.post(
  '/assignments',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = assignmentSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid assignment data')
    const d = parsed.data
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO checkpoint_assignments (checkpoint_id, user_id, assigned_date, due_date, frequency)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [d.checkpointId, d.userId, d.assignedDate, d.dueDate || null, d.frequency || 'DAILY']
      )
      const { rows: info } = await query<{ title: string }>(
        `SELECT c.title FROM checkpoints c WHERE c.id = $1`, [d.checkpointId]
      )
      await notifyUser(d.userId, {
        title: 'New checkpoint assigned',
        message: `You have been assigned "${info[0]?.title || 'a new checkpoint'}" for ${d.assignedDate}.`,
        type: 'info',
        linkUrl: '/dashboard',
      })
      await logAudit({ userId: admin.id, action: 'ASSIGNMENT_CREATED', entityType: 'assignment', entityId: rows[0].id, newValues: d, req })
      ok(res, { id: rows[0].id })
    } catch (err) {
      if ((err as Error).message.includes('duplicate key')) {
        return fail(res, 409, 'This checkpoint is already assigned to the user on that date')
      }
      throw err
    }
  })
)

router.delete(
  '/assignments/:id',
  ah(async (req, res) => {
    const admin = req.user!
    await query('DELETE FROM checkpoint_assignments WHERE id = $1', [req.params.id])
    await logAudit({ userId: admin.id, action: 'ASSIGNMENT_DELETED', entityType: 'assignment', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

// ============================================================
// SUBMISSIONS (view all + review)
// ============================================================
router.get(
  '/submissions',
  ah(async (req, res) => {
    const { status, module, user, from, to, search, page, pageSize } = req.query as Record<string, string>
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let i = 1
    if (status) {
      params.push(status)
      conditions.push(`s.status = $${i++}`)
    }
    if (module) {
      params.push(module)
      conditions.push(`m.slug = $${i++}`)
    }
    if (user) {
      params.push(user)
      conditions.push(`s.user_id = $${i++}`)
    }
    if (isValidDate(from)) {
      params.push(from)
      conditions.push(`s.submission_date >= $${i++}`)
    }
    if (isValidDate(to)) {
      params.push(to)
      conditions.push(`s.submission_date <= $${i++}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(u.full_name ILIKE $${i} OR c.title ILIKE $${i} OR m.name ILIKE $${i})`)
      i++
    }
    const where = conditions.join(' AND ')
    const limit = Math.min(Math.max(parseInt(pageSize || '20', 10) || 20, 1), 100)
    const offset = (Math.max(parseInt(page || '1', 10) || 1, 1) - 1) * limit

    const [list, total] = await Promise.all([
      query(
        `SELECT s.id, s.status, s.submission_date::text, s.submitted_at, s.approved_at, s.rejected_at,
                s.review_comment, s.auto_approved, s.updated_at,
                u.id AS user_id, u.full_name AS user_name, u.employee_code,
                c.title AS checkpoint_title, m.name AS module_name, m.slug AS module_slug,
                d.name AS department_name,
                a.compliance_status, a.accuracy_status, a.comments, a.corrective_action,
                rb.full_name AS reviewed_by_name,
                (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id) AS evidence_count
         FROM checkpoint_submissions s
         JOIN users u ON u.id = s.user_id
         JOIN checkpoints c ON c.id = s.checkpoint_id
         JOIN modules m ON m.id = c.module_id
         JOIN departments d ON d.id = m.department_id
         LEFT JOIN submission_answers a ON a.submission_id = s.id
         LEFT JOIN users rb ON rb.id = s.reviewed_by
         WHERE ${where}
         ORDER BY
           CASE WHEN s.status = 'SUBMITTED' THEN 0 ELSE 1 END,
           s.updated_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM checkpoint_submissions s
         JOIN users u ON u.id = s.user_id
         JOIN checkpoints c ON c.id = s.checkpoint_id
         JOIN modules m ON m.id = c.module_id
         WHERE ${where}`,
        params
      ),
    ])
    ok(res, {
      items: list.rows,
      total: total.rows[0].c,
      page: Math.max(parseInt(page || '1', 10) || 1, 1),
      pageSize: limit,
    })
  })
)

router.post(
  '/submissions/:id/review',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = z
      .object({ action: z.enum(['APPROVE', 'REJECT']), comment: z.string().max(1000).nullable().optional() })
      .safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'action must be APPROVE or REJECT')
    const result = await reviewSubmission({
      submissionId: req.params.id,
      reviewerId: admin.id,
      reviewerName: admin.fullName,
      action: parsed.data.action,
      comment: parsed.data.comment || null,
      via: 'admin',
      req,
    })
    if (!result.found) return fail(res, 404, 'Submission not found')
    if (result.alreadyReviewed) return fail(res, 409, 'This submission has already been reviewed')
    ok(res, { reviewed: true, action: parsed.data.action })
  })
)

// ============================================================
// EVIDENCE (view all + delete)
// ============================================================
router.get(
  '/evidence',
  ah(async (req, res) => {
    const search = (req.query.search as string) || ''
    const submissionId = (req.query.submissionId as string) || ''
    const conditions: string[] = []
    const params: unknown[] = []
    let i = 1
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(e.original_name ILIKE $${i} OR u.full_name ILIKE $${i})`)
      i++
    }
    if (submissionId) {
      params.push(submissionId)
      conditions.push(`e.submission_id = $${i}`)
      i++
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await query(
      `SELECT e.id, e.original_name, e.stored_name, e.mime_type, e.file_size, e.created_at, e.storage_path,
              u.full_name AS user_name, c.title AS checkpoint_title, m.name AS module_name, s.status AS submission_status,
              e.submission_id
       FROM evidence_files e
       JOIN users u ON u.id = e.uploaded_by
       JOIN checkpoint_submissions s ON s.id = e.submission_id
       JOIN checkpoints c ON c.id = s.checkpoint_id
       JOIN modules m ON m.id = c.module_id
       ${where}
       ORDER BY e.created_at DESC LIMIT 300`,
      params
    )
    ok(res, { evidence: rows })
  })
)

router.delete(
  '/evidence/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const { rows } = await query<{ storage_path: string }>(
      'SELECT storage_path FROM evidence_files WHERE id = $1',
      [req.params.id]
    )
    if (rows.length === 0) return fail(res, 404, 'Evidence not found')
    await query('DELETE FROM evidence_files WHERE id = $1', [req.params.id])
    const fs = await import('node:fs')
    const path = await import('node:path')
    const filePath = path.resolve(rows[0].storage_path)
    if (filePath.startsWith(path.resolve(config.uploadDir))) {
      fs.unlink(filePath, () => undefined)
    }
    await logAudit({ userId: admin.id, action: 'EVIDENCE_DELETED', entityType: 'evidence', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

// ============================================================
// REPORTS
// ============================================================
router.get(
  '/reports',
  ah(async (_req, res) => {
    const [byUser, compliance, accuracy, monthly] = await Promise.all([
      query<{ full_name: string; department_name: string | null; total: number; approved: number; rejected: number; pending: number; rate: number }>(
        `SELECT u.full_name, d.name AS department_name, COUNT(s.id)::int AS total,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved,
                COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected,
                COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED','DRAFT','PENDING'))::int AS pending,
                ROUND(100.0 * COUNT(*) FILTER (WHERE s.status = 'APPROVED') / NULLIF(COUNT(s.id), 0)) AS rate
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN checkpoint_submissions s ON s.user_id = u.id
         WHERE u.status = 'ACTIVE'
         GROUP BY u.id, u.full_name, d.name
         ORDER BY total DESC`
      ),
      query<{ compliance_status: string; c: number }>(
        `SELECT a.compliance_status, COUNT(*)::int AS c
         FROM submission_answers a WHERE a.compliance_status IS NOT NULL GROUP BY a.compliance_status`
      ),
      query<{ accuracy_status: string; c: number }>(
        `SELECT a.accuracy_status, COUNT(*)::int AS c
         FROM submission_answers a WHERE a.accuracy_status IS NOT NULL GROUP BY a.accuracy_status`
      ),
      query<{ month: string; total: number; approved: number; rejected: number }>(
        `SELECT to_char(date_trunc('month', submission_date), 'YYYY-MM') AS month,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
                COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected
         FROM checkpoint_submissions GROUP BY 1 ORDER BY 1 DESC LIMIT 6`
      ),
    ])
    ok(res, { byUser: byUser.rows, compliance: compliance.rows, accuracy: accuracy.rows, monthly: monthly.rows })
  })
)

router.get(
  '/reports/export',
  ah(async (_req, res) => {
    const { rows } = await query(
      `SELECT s.submission_date::text AS date, u.full_name AS employee, u.employee_code,
              d.name AS department, m.name AS module, c.title AS checkpoint,
              a.compliance_status AS compliance, a.accuracy_status AS accuracy, s.status,
              to_char(s.submitted_at, 'YYYY-MM-DD HH24:MI') AS submitted_at,
              to_char(COALESCE(s.approved_at, s.rejected_at), 'YYYY-MM-DD HH24:MI') AS reviewed_at,
              s.review_comment, s.auto_approved, c.score,
              (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id) AS evidence
       FROM checkpoint_submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN departments d ON d.id = u.department_id
       JOIN checkpoints c ON c.id = s.checkpoint_id
       JOIN modules m ON m.id = c.module_id
       LEFT JOIN submission_answers a ON a.submission_id = s.id
       ORDER BY s.submission_date DESC`
    )
    const header = ['Date', 'Employee', 'Employee Code', 'Department', 'Module', 'Checkpoint', 'Compliance', 'Accuracy', 'Status', 'Submitted At', 'Reviewed At', 'Review Comment', 'Auto Approved', 'Score', 'Evidence Files']
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.date, r.employee, r.employee_code, r.department, r.module, r.checkpoint,
          r.compliance, r.accuracy, r.status, r.submitted_at, r.reviewed_at,
          r.review_comment, r.auto_approved, r.score, r.evidence,
        ].map(esc).join(',')
      ),
    ]
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="bsc-exclusive-all-submissions.csv"')
    res.send('\uFEFF' + lines.join('\n'))
  })
)

// ============================================================
// AUDIT LOGS
// ============================================================
router.get(
  '/audit-logs',
  ah(async (req, res) => {
    const { action, user, entityType, from, to, page, pageSize } = req.query as Record<string, string>
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let i = 1
    if (action) {
      params.push(`%${action}%`)
      conditions.push(`al.action ILIKE $${i++}`)
    }
    if (user) {
      params.push(`%${user}%`)
      conditions.push(`(u.full_name ILIKE $${i} OR u.username ILIKE $${i})`)
      i++
    }
    if (entityType) {
      params.push(entityType)
      conditions.push(`al.entity_type = $${i++}`)
    }
    if (isValidDate(from)) {
      params.push(from)
      conditions.push(`al.created_at >= $${i++}::date`)
    }
    if (isValidDate(to)) {
      params.push(to)
      conditions.push(`al.created_at < ($${i++}::date + INTERVAL '1 day')`)
    }
    const where = conditions.join(' AND ')
    const limit = Math.min(Math.max(parseInt(pageSize || '25', 10) || 25, 1), 100)
    const offset = (Math.max(parseInt(page || '1', 10) || 1, 1) - 1) * limit
    const [list, total] = await Promise.all([
      query(
        `SELECT al.id, al.action, al.entity_type, al.entity_id, al.old_values, al.new_values,
                al.ip_address, al.device_info, al.device_type, al.user_agent, al.created_at, u.full_name AS user_name
         FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
         WHERE ${where} ORDER BY al.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id WHERE ${where}`, params),
    ])
    ok(res, { items: list.rows, total: total.rows[0].c, page: Math.max(parseInt(page || '1', 10) || 1, 1), pageSize: limit })
  })
)

// ============================================================
// SETTINGS
// ============================================================
router.get(
  '/settings',
  ah(async (_req, res) => {
    const { rows } = await query('SELECT id, key, value, type, category, updated_at FROM system_settings ORDER BY category, key')
    ok(res, { settings: rows })
  })
)

router.put(
  '/settings',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = z.object({ settings: z.array(z.object({ key: z.string().min(1).max(100), value: z.string().max(500) })) }).safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'settings must be an array of {key, value}')
    for (const s of parsed.data.settings) {
      await query(
        `INSERT INTO system_settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [s.key, s.value]
      )
    }
    await logAudit({ userId: admin.id, action: 'SETTINGS_UPDATED', entityType: 'settings', newValues: parsed.data.settings, req })
    ok(res, { updated: true })
  })
)

// ============================================================
// LOCATIONS (registered offices)
// ============================================================
router.get(
  '/locations',
  ah(async (_req, res) => {
    const { rows } = await query('SELECT id, name, code, address, latitude, longitude, status, created_at FROM locations ORDER BY name')
    ok(res, { locations: rows })
  })
)

const locationSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  address: z.string().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

router.post(
  '/locations',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = locationSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid location data')
    const d = parsed.data
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO locations (name, code, address, latitude, longitude) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [d.name, d.code.toUpperCase(), d.address || null, d.latitude ?? null, d.longitude ?? null]
      )
      await logAudit({ userId: admin.id, action: 'LOCATION_CREATED', entityType: 'location', entityId: rows[0].id, newValues: { name: d.name }, req })
      ok(res, { id: rows[0].id })
    } catch (err) {
      if ((err as Error).message.includes('duplicate key')) return fail(res, 409, 'Location name or code already exists')
      throw err
    }
  })
)

router.put(
  '/locations/:id',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = locationSchema.partial().safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid location data')
    const d = parsed.data
    await query(
      `UPDATE locations SET name = COALESCE($1, name), code = COALESCE($2, code), address = $3,
       latitude = $4, longitude = $5, status = COALESCE($6, status), updated_at = NOW() WHERE id = $7`,
      [d.name || null, d.code ? d.code.toUpperCase() : null, d.address === undefined ? null : d.address,
        d.latitude === undefined ? null : d.latitude, d.longitude === undefined ? null : d.longitude,
        d.status || null, req.params.id]
    )
    await logAudit({ userId: admin.id, action: 'LOCATION_UPDATED', entityType: 'location', entityId: req.params.id, req })
    ok(res, { updated: true })
  })
)

router.delete(
  '/locations/:id',
  ah(async (req, res) => {
    const admin = req.user!
    await query('DELETE FROM locations WHERE id = $1', [req.params.id])
    await logAudit({ userId: admin.id, action: 'LOCATION_DELETED', entityType: 'location', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

// ============================================================
// ADMITTANCE CODES — assign location + code to each user
// ============================================================
router.get(
  '/admittance-codes',
  ah(async (_req, res) => {
    const { rows } = await query(
      `SELECT ac.id, ac.user_id, ac.location_id, ac.admittance_code, ac.is_active, ac.created_at,
              u.full_name AS user_name, u.employee_code,
              l.name AS location_name, l.code AS location_code, l.address AS location_address
       FROM admittance_codes ac
       JOIN users u ON u.id = ac.user_id
       LEFT JOIN locations l ON l.id = ac.location_id
       ORDER BY u.full_name`
    )
    ok(res, { codes: rows })
  })
)

router.post(
  '/admittance-codes',
  ah(async (req, res) => {
    const admin = req.user!
    const parsed = z.object({
      userId: z.string().uuid(),
      locationId: z.string().uuid(),
    }).safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'userId and locationId are required')

    // Generate a 6-character alphanumeric admittance code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO admittance_codes (user_id, location_id, admittance_code, created_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [parsed.data.userId, parsed.data.locationId, code, admin.id]
      )
      await logAudit({ userId: admin.id, action: 'ADMITTANCE_CODE_CREATED', entityType: 'admittance_code', entityId: rows[0].id, newValues: { userId: parsed.data.userId, locationId: parsed.data.locationId }, req })
      ok(res, { id: rows[0].id, admittanceCode: code })
    } catch (err) {
      if ((err as Error).message.includes('duplicate key')) return fail(res, 409, 'User already has an admittance code for this location')
      throw err
    }
  })
)

router.delete(
  '/admittance-codes/:id',
  ah(async (req, res) => {
    const admin = req.user!
    await query('DELETE FROM admittance_codes WHERE id = $1', [req.params.id])
    await logAudit({ userId: admin.id, action: 'ADMITTANCE_CODE_DELETED', entityType: 'admittance_code', entityId: req.params.id, req })
    ok(res, { deleted: true })
  })
)

router.patch(
  '/admittance-codes/:id/toggle',
  ah(async (req, res) => {
    const admin = req.user!
    const { rows } = await query<{ is_active: boolean }>('SELECT is_active FROM admittance_codes WHERE id = $1', [req.params.id])
    if (rows.length === 0) return fail(res, 404, 'Code not found')
    await query('UPDATE admittance_codes SET is_active = $1, updated_at = NOW() WHERE id = $2', [!rows[0].is_active, req.params.id])
    ok(res, { isActive: !rows[0].is_active })
  })
)

// ============================================================
// GET my admittance code (for any user)
// ============================================================
router.get(
  '/my-admittance-code',
  requirePermission('tracking:update'),
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT ac.admittance_code, ac.is_active, l.name AS location_name, l.code AS location_code, l.address AS location_address
       FROM admittance_codes ac
       LEFT JOIN locations l ON l.id = ac.location_id
       WHERE ac.user_id = $1 AND ac.is_active = TRUE
       ORDER BY ac.created_at DESC LIMIT 1`,
      [req.user!.id]
    )
    ok(res, { code: rows[0] || null })
  })
)

// ============================================================
// ADMIN CALENDAR — Complete company-wide tracking across all candidates
// ============================================================
router.get(
  '/calendar',
  ah(async (req, res) => {
    const now = new Date(Date.now() + 5.5 * 3600 * 1000)
    const year = parseInt((req.query.year as string) || String(now.getUTCFullYear()), 10)
    const month = parseInt((req.query.month as string) || String(now.getUTCMonth() + 1), 10)
    const departmentId = (req.query.department_id as string) || ''
    const statusFilter = (req.query.status as string) || ''
    const userIdFilter = (req.query.user_id as string) || ''

    const first = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const conditions: string[] = ['s.submission_date BETWEEN $1 AND $2']
    const params: unknown[] = [first, last]

    if (departmentId) {
      params.push(departmentId)
      conditions.push(`u.department_id = $${params.length}`)
    }
    if (statusFilter) {
      params.push(statusFilter)
      conditions.push(`s.status = $${params.length}`)
    }
    if (userIdFilter) {
      params.push(userIdFilter)
      conditions.push(`s.user_id = $${params.length}`)
    }

    const where = conditions.join(' AND ')

    const { rows: days } = await query<{
      date: string
      total: number
      completed: number
      approved: number
      submitted: number
      rejected: number
      draft: number
      pending: number
      unique_candidates: number
    }>(
      `SELECT s.submission_date::text AS date,
              COUNT(s.id)::int AS total,
              COUNT(*) FILTER (WHERE s.status IN ('APPROVED','SUBMITTED','REJECTED'))::int AS completed,
              COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved,
              COUNT(*) FILTER (WHERE s.status = 'SUBMITTED')::int AS submitted,
              COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected,
              COUNT(*) FILTER (WHERE s.status = 'DRAFT')::int AS draft,
              COUNT(*) FILTER (WHERE s.status = 'PENDING')::int AS pending,
              COUNT(DISTINCT s.user_id)::int AS unique_candidates
       FROM checkpoint_submissions s
       JOIN users u ON u.id = s.user_id
       WHERE ${where}
       GROUP BY s.submission_date
       ORDER BY s.submission_date`,
      params
    )

    const { rows: items } = await query<{
      id: string
      date: string
      checkpoint_id: string
      checkpoint_title: string
      checkpoint_code: string | null
      module_name: string
      module_slug: string
      status: string
      submitted_at: string | null
      approved_at: string | null
      rejected_at: string | null
      auto_approved: boolean | null
      review_comment: string | null
      reviewer_name: string | null
      compliance_status: string | null
      accuracy_status: string | null
      comments: string | null
      corrective_action: string | null
      candidate_id: string
      candidate_name: string
      candidate_email: string
      candidate_employee_code: string | null
      candidate_role: string | null
      department_name: string | null
      evidence_count: number
      evidence_files: Array<{
        id: string
        original_name: string
        mime_type: string
        file_size: number
        storage_path: string
      }>
    }>(
      `SELECT s.id,
              s.submission_date::text AS date,
              s.checkpoint_id,
              c.title AS checkpoint_title,
              c.code AS checkpoint_code,
              m.name AS module_name,
              m.slug AS module_slug,
              s.status,
              s.submitted_at,
              s.approved_at,
              s.rejected_at,
              s.auto_approved,
              s.review_comment,
              rev.full_name AS reviewer_name,
              a.compliance_status,
              a.accuracy_status,
              a.comments,
              a.corrective_action,
              u.id AS candidate_id,
              u.full_name AS candidate_name,
              u.email AS candidate_email,
              u.employee_code AS candidate_employee_code,
              r.name AS candidate_role,
              d.name AS department_name,
              COALESCE(
                (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id),
                0
              ) AS evidence_count,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'id', ef.id,
                      'original_name', ef.original_name,
                      'mime_type', ef.mime_type,
                      'file_size', ef.file_size,
                      'storage_path', ef.storage_path
                    )
                  )
                  FROM evidence_files ef
                  WHERE ef.submission_id = s.id
                ),
                '[]'::json
              ) AS evidence_files
       FROM checkpoint_submissions s
       JOIN users u ON u.id = s.user_id
       JOIN checkpoints c ON c.id = s.checkpoint_id
       JOIN modules m ON m.id = c.module_id
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users rev ON rev.id = s.reviewed_by
       LEFT JOIN submission_answers a ON a.submission_id = s.id
       WHERE ${where}
       ORDER BY s.submission_date DESC, s.submitted_at DESC NULLS LAST, c.display_order`,
      params
    )

    const byDate = new Map<string, typeof items>()
    for (const item of items) {
      if (!byDate.has(item.date)) byDate.set(item.date, [])
      byDate.get(item.date)!.push(item)
    }

    ok(res, {
      year,
      month,
      days,
      itemsByDate: Object.fromEntries(byDate),
      totalSubmissions: items.length,
      today: istToday(),
    })
  })
)

export default router
