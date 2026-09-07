import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ah, fail, istToday, ok } from '../utils/http.js'
import { logAudit } from '../utils/audit.js'
import { notifyUser } from '../utils/notify.js'
import { reviewSubmission } from '../utils/review.js'

const router = Router()
router.use(requireAuth)
router.use(requireRole('SUPERVISOR', 'ADMIN', 'MANAGER'))

async function logSupervisorActivity(supervisorId: string, action: string, entityType: string, entityId?: string | null, details?: unknown) {
  try {
    await query(
      'INSERT INTO supervisor_activities (supervisor_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)',
      [supervisorId, action, entityType, entityId || null, details ? JSON.stringify(details) : null]
    )
  } catch (err) {
    console.error('[supervisor] activity write failed:', (err as Error).message)
  }
}

// ============================================================
// DASHBOARD
// ============================================================
router.get(
  '/dashboard',
  ah(async (req, res) => {
    const user = req.user!
    const [employees, activeEmployees, pendingApprovals, projects, departments, todayActivity, recentApprovals, teamPerformance] =
      await Promise.all([
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM supervisor_employees WHERE supervisor_id = $1 AND status = 'ACTIVE'`,
          [user.id]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM supervisor_employees se
           JOIN users u ON u.id = se.employee_id
           WHERE se.supervisor_id = $1 AND se.status = 'ACTIVE' AND u.status = 'ACTIVE'`,
          [user.id]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM supervisor_approvals WHERE supervisor_id = $1 AND status = 'PENDING'`,
          [user.id]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM supervisor_projects WHERE supervisor_id = $1 AND status = 'ACTIVE'`,
          [user.id]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM supervisor_departments WHERE supervisor_id = $1 AND status = 'ACTIVE'`,
          [user.id]
        ),
        query<{
          id: string; user_name: string; checkpoint_title: string; module_name: string; status: string; updated_at: string
        }>(
          `SELECT s.id, u.full_name AS user_name, c.title AS checkpoint_title, m.name AS module_name, s.status, s.updated_at
           FROM checkpoint_submissions s
           JOIN users u ON u.id = s.user_id
           JOIN checkpoints c ON c.id = s.checkpoint_id
           JOIN modules m ON m.id = c.module_id
           JOIN supervisor_employees se ON se.employee_id = s.user_id
           WHERE se.supervisor_id = $1 AND s.submission_date = $2
           ORDER BY s.updated_at DESC LIMIT 12`,
          [user.id, istToday()]
        ),
        query<{
          id: string; user_name: string; checkpoint_title: string; module_name: string; status: string; submitted_at: string
        }>(
          `SELECT s.id, u.full_name AS user_name, c.title AS checkpoint_title, m.name AS module_name, s.status, s.submitted_at
           FROM checkpoint_submissions s
           JOIN users u ON u.id = s.user_id
           JOIN checkpoints c ON c.id = s.checkpoint_id
           JOIN modules m ON m.id = c.module_id
           JOIN supervisor_employees se ON se.employee_id = s.user_id
           WHERE se.supervisor_id = $1
           ORDER BY s.updated_at DESC LIMIT 12`,
          [user.id]
        ),
        query<{ total: number; approved: number; rejected: number; pending: number }>(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved,
                  COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected,
                  COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED','DRAFT','PENDING'))::int AS pending
           FROM checkpoint_submissions s
           JOIN supervisor_employees se ON se.employee_id = s.user_id
           WHERE se.supervisor_id = $1`,
          [user.id]
        ),
      ])

    ok(res, {
      totalEmployees: employees.rows[0].c,
      activeEmployees: activeEmployees.rows[0].c,
      pendingApprovals: pendingApprovals.rows[0].c,
      assignedProjects: projects.rows[0].c,
      departments: departments.rows[0].c,
      todayActivity: todayActivity.rows.map((r) => ({
        id: r.id,
        userName: r.user_name,
        checkpointTitle: r.checkpoint_title,
        moduleName: r.module_name,
        status: r.status,
        time: r.updated_at,
      })),
      recentApprovals: recentApprovals.rows.map((r) => ({
        id: r.id,
        userName: r.user_name,
        checkpointTitle: r.checkpoint_title,
        moduleName: r.module_name,
        status: r.status,
        submittedAt: r.submitted_at,
      })),
      teamPerformance: teamPerformance.rows[0],
    })
  })
)

// ============================================================
// APPROVALS
// ============================================================
router.get(
  '/approvals',
  ah(async (req, res) => {
    const user = req.user!
    const status = (req.query.status as string) || ''
    const params: unknown[] = [user.id]
    let statusCond = ''
    if (['PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'].includes(status)) {
      params.push(status)
      statusCond = `AND sa.status = $2`
    }
    const { rows } = await query<{
      id: string
      user_id: string
      user_name: string
      employee_code: string
      checkpoint_title: string
      module_name: string
      submission_date: string
      status: string
      submitted_at: string | null
      compliance_status: string | null
      accuracy_status: string | null
      comments: string | null
      corrective_action: string | null
      evidence_count: number
      approval_status: string | null
      supervisor_comments: string | null
    }>(
      `SELECT s.id, s.user_id, u.full_name AS user_name, u.employee_code,
              c.title AS checkpoint_title, m.name AS module_name, s.submission_date::text,
              s.status, s.submitted_at, a.compliance_status, a.accuracy_status, a.comments, a.corrective_action,
              (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id) AS evidence_count,
              sa.status AS approval_status, sa.supervisor_comments
       FROM checkpoint_submissions s
       JOIN users u ON u.id = s.user_id
       JOIN checkpoints c ON c.id = s.checkpoint_id
       JOIN modules m ON m.id = c.module_id
       LEFT JOIN submission_answers a ON a.submission_id = s.id
       LEFT JOIN supervisor_approvals sa ON sa.submission_id = s.id
       JOIN supervisor_employees se ON se.employee_id = s.user_id
       WHERE se.supervisor_id = $1 ${statusCond}
       ORDER BY CASE WHEN s.status = 'SUBMITTED' THEN 0 ELSE 1 END, s.updated_at DESC
       LIMIT 200`,
      params
    )
    ok(res, { approvals: rows })
  })
)

router.post(
  '/approvals/:id',
  ah(async (req, res) => {
    const user = req.user!
    const parsed = z
      .object({ action: z.enum(['APPROVE', 'REJECT', 'ESCALATE']), comments: z.string().max(1000).nullable().optional() })
      .safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'action must be APPROVE, REJECT or ESCALATE')
    const { action, comments } = parsed.data

    if (action === 'ESCALATE') {
      const { rows } = await query<{ id: string; user_id: string; checkpoint_title: string }>(
        `SELECT s.id, s.user_id, c.title AS checkpoint_title
         FROM checkpoint_submissions s JOIN checkpoints c ON c.id = s.checkpoint_id
         WHERE s.id = $1`,
        [req.params.id]
      )
      if (rows.length === 0) return fail(res, 404, 'Submission not found')
      const sub = rows[0]
      await query(
        `UPDATE supervisor_approvals SET status = 'ESCALATED', escalation_level = escalation_level + 1,
         supervisor_comments = COALESCE($2, supervisor_comments), updated_at = NOW()
         WHERE submission_id = $1`,
        [sub.id, comments || null]
      )
      const { rows: mgr } = await query<{ reporting_manager_id: string | null }>(
        'SELECT reporting_manager_id FROM users WHERE id = $1', [user.id]
      )
      if (mgr[0]?.reporting_manager_id) {
        await notifyUser(mgr[0].reporting_manager_id, {
          title: 'Approval escalated',
          message: `"${sub.checkpoint_title}" was escalated by ${user.fullName}.`,
          type: 'warning',
          linkUrl: '/admin/submissions',
        })
      }
      await logSupervisorActivity(user.id, 'APPROVAL_ESCALATED', 'submission', sub.id, { comments })
      return ok(res, { escalated: true })
    }

    const result = await reviewSubmission({
      submissionId: req.params.id,
      reviewerId: user.id,
      reviewerName: user.fullName,
      action,
      comment: comments || null,
      via: 'supervisor',
      req,
    })
    if (!result.found) return fail(res, 404, 'Submission not found')
    if (result.alreadyReviewed) return fail(res, 409, 'This submission has already been reviewed')
    await logSupervisorActivity(user.id, action === 'APPROVE' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED', 'submission', req.params.id, { comments })
    ok(res, { reviewed: true, action })
  })
)

// ============================================================
// DEPARTMENTS
// ============================================================
router.get(
  '/departments',
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query<{
      id: string
      name: string
      code: string
      description: string | null
      is_primary: boolean
      assigned: boolean
      employee_count: number
    }>(
      `SELECT d.id, d.name, d.code, d.description, sd.is_primary,
              (sd.id IS NOT NULL) AS assigned,
              (SELECT COUNT(*)::int FROM supervisor_employees se WHERE se.department_id = d.id AND se.supervisor_id = $1 AND se.status = 'ACTIVE') AS employee_count
       FROM departments d
       LEFT JOIN supervisor_departments sd ON sd.department_id = d.id AND sd.supervisor_id = $1 AND sd.status = 'ACTIVE'
       WHERE d.status = 'ACTIVE'
       ORDER BY sd.is_primary DESC, d.name`,
      [user.id]
    )
    ok(res, { departments: rows })
  })
)

// ============================================================
// EMPLOYEES (team)
// ============================================================
router.get(
  '/employees',
  ah(async (req, res) => {
    const user = req.user!
    const search = (req.query.search as string) || ''
    const params: unknown[] = [user.id]
    let searchCond = ''
    if (search) {
      params.push(`%${search}%`)
      searchCond = `AND (u.full_name ILIKE $2 OR u.employee_code ILIKE $2 OR u.email ILIKE $2)`
    }
    const { rows } = await query<{
      id: string
      employee_id: string
      full_name: string
      employee_code: string
      email: string
      phone: string | null
      status: string
      department_name: string
      assigned_date: string
      total: number
      approved: number
      rejected: number
      pending: number
      last_tracked_at: string | null
    }>(
      `SELECT se.id, se.employee_id, u.full_name, u.employee_code, u.email, u.phone, u.status,
              d.name AS department_name, se.assigned_date::text,
              (SELECT COUNT(*)::int FROM checkpoint_submissions s WHERE s.user_id = u.id) AS total,
              (SELECT COUNT(*)::int FROM checkpoint_submissions s WHERE s.user_id = u.id AND s.status = 'APPROVED') AS approved,
              (SELECT COUNT(*)::int FROM checkpoint_submissions s WHERE s.user_id = u.id AND s.status = 'REJECTED') AS rejected,
              (SELECT COUNT(*)::int FROM checkpoint_submissions s WHERE s.user_id = u.id AND s.status IN ('SUBMITTED','DRAFT','PENDING')) AS pending,
              (SELECT lt.tracked_at FROM location_tracks lt WHERE lt.user_id = u.id ORDER BY lt.tracked_at DESC LIMIT 1) AS last_tracked_at
       FROM supervisor_employees se
       JOIN users u ON u.id = se.employee_id
       JOIN departments d ON d.id = se.department_id
       WHERE se.supervisor_id = $1 AND se.status = 'ACTIVE' ${searchCond}
       ORDER BY u.full_name`,
      params
    )
    const { rows: available } = await query<{ id: string; full_name: string; employee_code: string; department_name: string; role_name: string }>(
      `SELECT u.id, u.full_name, u.employee_code, d.name AS department_name, r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.status = 'ACTIVE' AND r.name = 'USER'
         AND NOT EXISTS (SELECT 1 FROM supervisor_employees se WHERE se.employee_id = u.id AND se.status = 'ACTIVE')
       ORDER BY u.full_name LIMIT 100`
    )
    ok(res, { employees: rows, available })
  })
)

router.post(
  '/employees',
  ah(async (req, res) => {
    const user = req.user!
    const parsed = z.object({
      employeeId: z.string().uuid(),
      departmentId: z.string().uuid(),
      reason: z.string().max(500).nullable().optional(),
    }).safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'employeeId and departmentId are required')
    const d = parsed.data
    await query(
      `INSERT INTO supervisor_employees (supervisor_id, employee_id, department_id, assignment_reason)
       VALUES ($1,$2,$3,$4) ON CONFLICT (supervisor_id, employee_id)
       DO UPDATE SET status = 'ACTIVE', unassigned_date = NULL, department_id = EXCLUDED.department_id, updated_at = NOW()`,
      [user.id, d.employeeId, d.departmentId, d.reason || null]
    )
    await logSupervisorActivity(user.id, 'EMPLOYEE_ASSIGNED', 'employee', d.employeeId, { reason: d.reason })
    ok(res, { assigned: true })
  })
)

router.delete(
  '/employees/:employeeId',
  ah(async (req, res) => {
    const user = req.user!
    await query(
      `UPDATE supervisor_employees SET status = 'INACTIVE', unassigned_date = CURRENT_DATE, updated_at = NOW()
       WHERE supervisor_id = $1 AND employee_id = $2`,
      [user.id, req.params.employeeId]
    )
    await logSupervisorActivity(user.id, 'EMPLOYEE_UNASSIGNED', 'employee', req.params.employeeId)
    ok(res, { unassigned: true })
  })
)

// ============================================================
// PROJECTS
// ============================================================
router.get(
  '/projects',
  ah(async (req, res) => {
    const user = req.user!
    const search = (req.query.search as string) || ''
    const params: unknown[] = [user.id]
    let searchCond = ''
    if (search) {
      params.push(`%${search}%`)
      searchCond = `AND (m.name ILIKE $2 OR m.slug ILIKE $2)`
    }
    const { rows } = await query<{
      project_id: string | null
      module_id: string
      name: string
      slug: string
      description: string | null
      department_name: string
      responsibility: string | null
      assigned_date: string | null
      checkpoint_count: number
      submission_count: number
    }>(
      `SELECT sp.id AS project_id, m.id AS module_id, m.name, m.slug, m.description,
              d.name AS department_name, sp.responsibility, sp.assigned_date::text,
              (SELECT COUNT(*)::int FROM checkpoints c WHERE c.module_id = m.id) AS checkpoint_count,
              (SELECT COUNT(*)::int FROM checkpoint_submissions s JOIN checkpoints c ON c.id = s.checkpoint_id WHERE c.module_id = m.id) AS submission_count
       FROM supervisor_projects sp
       JOIN modules m ON m.id = sp.module_id
       JOIN departments d ON d.id = m.department_id
       WHERE sp.supervisor_id = $1 AND sp.status = 'ACTIVE' ${searchCond}
       ORDER BY sp.assigned_date DESC`,
      params
    )
    ok(res, { projects: rows })
  })
)

router.post(
  '/projects',
  ah(async (req, res) => {
    const user = req.user!
    const parsed = z.object({ moduleId: z.string().uuid(), responsibility: z.string().max(1000).nullable().optional() }).safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'moduleId is required')
    await query(
      `INSERT INTO supervisor_projects (supervisor_id, module_id, responsibility) VALUES ($1,$2,$3)
       ON CONFLICT (supervisor_id, module_id) DO UPDATE SET status = 'ACTIVE', unassigned_date = NULL, responsibility = EXCLUDED.responsibility, updated_at = NOW()`,
      [user.id, parsed.data.moduleId, parsed.data.responsibility || null]
    )
    await logSupervisorActivity(user.id, 'PROJECT_ADDED', 'module', parsed.data.moduleId)
    ok(res, { added: true })
  })
)

router.delete(
  '/projects/:projectId',
  ah(async (req, res) => {
    const user = req.user!
    await query(
      `UPDATE supervisor_projects SET status = 'INACTIVE', unassigned_date = CURRENT_DATE, updated_at = NOW()
       WHERE supervisor_id = $1 AND id = $2`,
      [user.id, req.params.projectId]
    )
    await logSupervisorActivity(user.id, 'PROJECT_REMOVED', 'module', req.params.projectId)
    ok(res, { removed: true })
  })
)

// ============================================================
// ACTIVITY
// ============================================================
router.get(
  '/activity',
  ah(async (req, res) => {
    const user = req.user!
    const page = Math.max(parseInt((req.query.page as string) || '1', 10) || 1, 1)
    const limit = 25
    const { rows } = await query(
      `SELECT id, action, entity_type, entity_id, details, ip_address, created_at
       FROM supervisor_activities
       WHERE supervisor_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [user.id, limit, (page - 1) * limit]
    )
    const { rows: total } = await query<{ c: number }>(
      'SELECT COUNT(*)::int AS c FROM supervisor_activities WHERE supervisor_id = $1',
      [user.id]
    )
    ok(res, { items: rows, total: total[0].c, page, pageSize: limit })
  })
)

// ============================================================
// PROFILE
// ============================================================
router.get(
  '/profile',
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query(
      `SELECT sp.id, sp.designation, sp.joining_date::text, sp.bio, sp.specialization, sp.reporting_manager_id,
              u.full_name, u.email, u.phone, u.employee_code, d.name AS department_name,
              rm.full_name AS manager_name
       FROM supervisor_profiles sp
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users rm ON rm.id = sp.reporting_manager_id
       WHERE sp.user_id = $1`,
      [user.id]
    )
    ok(res, { profile: rows[0] || null })
  })
)

router.put(
  '/profile',
  ah(async (req, res) => {
    const user = req.user!
    const parsed = z.object({
      designation: z.string().max(150).nullable().optional(),
      joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      bio: z.string().max(2000).nullable().optional(),
      specialization: z.string().max(200).nullable().optional(),
    }).safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid profile data')
    const d = parsed.data
    await query(
      `INSERT INTO supervisor_profiles (user_id, designation, joining_date, bio, specialization)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET
         designation = EXCLUDED.designation,
         joining_date = EXCLUDED.joining_date,
         bio = EXCLUDED.bio,
         specialization = EXCLUDED.specialization,
         updated_at = NOW()`,
      [user.id, d.designation ?? null, d.joiningDate ?? null, d.bio ?? null, d.specialization ?? null]
    )
    await logSupervisorActivity(user.id, 'PROFILE_UPDATED', 'profile', user.id)
    ok(res, { updated: true })
  })
)

// ============================================================
// REPORTS
// ============================================================
router.get(
  '/reports',
  ah(async (req, res) => {
    const user = req.user!
    const [byEmployee, compliance, trend] = await Promise.all([
      query<{ full_name: string; total: number; approved: number; rejected: number; pending: number; rate: number }>(
        `SELECT u.full_name, COUNT(s.id)::int AS total,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved,
                COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected,
                COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED','DRAFT','PENDING'))::int AS pending,
                ROUND(100.0 * COUNT(*) FILTER (WHERE s.status = 'APPROVED') / NULLIF(COUNT(s.id), 0)) AS rate
         FROM supervisor_employees se
         JOIN users u ON u.id = se.employee_id
         LEFT JOIN checkpoint_submissions s ON s.user_id = u.id
         WHERE se.supervisor_id = $1 AND se.status = 'ACTIVE'
         GROUP BY u.id, u.full_name ORDER BY total DESC`,
        [user.id]
      ),
      query<{ compliance_status: string; c: number }>(
        `SELECT a.compliance_status, COUNT(*)::int AS c
         FROM submission_answers a
         JOIN checkpoint_submissions s ON s.id = a.submission_id
         JOIN supervisor_employees se ON se.employee_id = s.user_id
         WHERE se.supervisor_id = $1 AND a.compliance_status IS NOT NULL
         GROUP BY a.compliance_status`,
        [user.id]
      ),
      query<{ day: string; total: number; approved: number }>(
        `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                COUNT(s.id)::int AS total,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved
         FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') d
         LEFT JOIN checkpoint_submissions s ON s.submission_date = d::date
           AND EXISTS (SELECT 1 FROM supervisor_employees se WHERE se.employee_id = s.user_id AND se.supervisor_id = $1)
         GROUP BY d ORDER BY d`,
        [user.id]
      ),
    ])
    ok(res, { byEmployee: byEmployee.rows, compliance: compliance.rows, trend: trend.rows })
  })
)

export default router
