import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { ah, fail, istToday, isValidDate, ok } from '../utils/http.js'
import { logAudit } from '../utils/audit.js'
import { notifyAdmins, notifyUser } from '../utils/notify.js'

const router = Router()
router.use(requireAuth)

const draftSchema = z.object({
  checkpointId: z.string().uuid(),
  complianceStatus: z.string().nullable().optional(),
  accuracyStatus: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  correctiveAction: z.string().nullable().optional(),
})

async function findTodayAssignment(checkpointId: string, userId: string) {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM checkpoint_assignments
     WHERE checkpoint_id = $1 AND user_id = $2 AND assigned_date = $3 AND status = 'ACTIVE'
     LIMIT 1`,
    [checkpointId, userId, istToday()]
  )
  return rows[0] || null
}

// POST /api/submissions/draft — create/update a draft (client autosave)
router.post(
  '/draft',
  requirePermission('submissions:create'),
  ah(async (req, res) => {
    const user = req.user!
    const parsed = draftSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid submission data')

    const d = parsed.data
    const assignment = await findTodayAssignment(d.checkpointId, user.id)

    // A draft needs a submission row (today)
    const { rows: existing } = await query<{ id: string; status: string }>(
      `SELECT id, status FROM checkpoint_submissions
       WHERE checkpoint_id = $1 AND user_id = $2 AND submission_date = $3
       LIMIT 1`,
      [d.checkpointId, user.id, istToday()]
    )
    let submissionId = existing[0]?.id
    if (!submissionId) {
      const created = await query<{ id: string }>(
        `INSERT INTO checkpoint_submissions (checkpoint_id, user_id, assignment_id, submission_date, status)
         VALUES ($1,$2,$3,$4,'DRAFT') RETURNING id`,
        [d.checkpointId, user.id, assignment?.id || null, istToday()]
      )
      submissionId = created.rows[0].id
    } else if (existing[0].status === 'SUBMITTED') {
      return fail(res, 409, 'This checkpoint has already been submitted for review', 'ALREADY_SUBMITTED')
    }

    await query(
      `INSERT INTO submission_answers (submission_id, compliance_status, accuracy_status, comments, corrective_action)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (submission_id) DO UPDATE SET
         compliance_status = EXCLUDED.compliance_status,
         accuracy_status = EXCLUDED.accuracy_status,
         comments = EXCLUDED.comments,
         corrective_action = EXCLUDED.corrective_action,
         updated_at = NOW()`,
      [submissionId, d.complianceStatus || null, d.accuracyStatus || null, d.comments || null, d.correctiveAction || null]
    )
    await query(`UPDATE checkpoint_submissions SET updated_at = NOW() WHERE id = $1`, [submissionId])
    await logAudit({
      userId: user.id,
      action: 'CHECKPOINT_DRAFT_SAVED',
      entityType: 'submission',
      entityId: submissionId,
      req,
    })

    ok(res, { submissionId, status: 'DRAFT' })
  })
)

// POST /api/submissions/:id/submit — finalize and send for review
router.post(
  '/:id/submit',
  requirePermission('submissions:create'),
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query<{
      id: string
      checkpoint_id: string
      status: string
      is_accuracy_required: boolean
      is_corrective_action_required: boolean
      is_photo_required: boolean
      compliance_status: string | null
      accuracy_status: string | null
      corrective_action: string | null
    }>(
      `SELECT s.id, s.checkpoint_id, s.status,
              c.is_accuracy_required, c.is_corrective_action_required, c.is_photo_required,
              a.compliance_status, a.accuracy_status, a.corrective_action
       FROM checkpoint_submissions s
       JOIN checkpoints c ON c.id = s.checkpoint_id
       LEFT JOIN submission_answers a ON a.submission_id = s.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [req.params.id, user.id]
    )
    const sub = rows[0]
    if (!sub) return fail(res, 404, 'Submission not found')
    if (sub.status === 'SUBMITTED') return fail(res, 409, 'Already submitted for review', 'ALREADY_SUBMITTED')
    if (sub.status === 'APPROVED') return fail(res, 409, 'Already approved', 'ALREADY_APPROVED')
    
    // Validate required fields based on checkpoint configuration
    if (!sub.compliance_status) {
      return fail(res, 400, 'Compliance status is required before submitting')
    }
    if (sub.is_accuracy_required && !sub.accuracy_status) {
      return fail(res, 400, 'Accuracy status is required for this checkpoint')
    }
    if (sub.is_corrective_action_required && !sub.corrective_action) {
      return fail(res, 400, 'Corrective action is required for this checkpoint')
    }
    if (sub.is_photo_required) {
      const { rows: ev } = await query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM evidence_files WHERE submission_id = $1`,
        [sub.id]
      )
      if (!ev[0] || ev[0].count === 0) {
        return fail(res, 400, 'Evidence file is required for this checkpoint', 'EVIDENCE_REQUIRED')
      }
    }

    await query(
      `UPDATE checkpoint_submissions SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [sub.id]
    )

    // Link a supervisor for the approval queue: assigned supervisor > reporting manager > null
    const { rows: sup } = await query<{ supervisor_id: string }>(
      `SELECT supervisor_id FROM supervisor_employees
       WHERE employee_id = $1 AND status = 'ACTIVE'
       ORDER BY assigned_date LIMIT 1`,
      [user.id]
    )
    const { rows: mgr } = await query<{ reporting_manager_id: string | null }>(
      `SELECT reporting_manager_id FROM users WHERE id = $1`,
      [user.id]
    )
    const supervisorId = sup[0]?.supervisor_id || mgr[0]?.reporting_manager_id || null
    if (supervisorId) {
      await query(
        `INSERT INTO supervisor_approvals (submission_id, supervisor_id, status, requested_by_id)
         VALUES ($1,$2,'PENDING',$3)
         ON CONFLICT (submission_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()`,
        [sub.id, supervisorId, user.id]
      )
      await notifyUser(supervisorId, {
        title: 'New submission awaiting approval',
        message: `${user.fullName} submitted a checkpoint for your review.`,
        type: 'warning',
        linkUrl: '/supervisor/approvals',
      })
    }
    await notifyAdmins({
      title: 'New submission awaiting review',
      message: `${user.fullName} submitted a checkpoint.`,
      type: 'info',
      linkUrl: '/admin/submissions',
    })
    await logAudit({
      userId: user.id,
      action: 'CHECKPOINT_SUBMITTED',
      entityType: 'submission',
      entityId: sub.id,
      req,
    })

    ok(res, { status: 'SUBMITTED', submittedAt: new Date().toISOString() })
  })
)

// GET /api/submissions/history — own submission history with filters
router.get(
  '/history',
  ah(async (req, res) => {
    const user = req.user!
    const { status, module, from, to, search, page, pageSize } = req.query as Record<string, string>
    const conditions: string[] = ['s.user_id = $1']
    const params: unknown[] = [user.id]
    let i = 2

    if (status) {
      params.push(status)
      conditions.push(`s.status = $${i++}`)
    }
    if (module) {
      params.push(module)
      conditions.push(`m.slug = $${i++}`)
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
      conditions.push(`(c.title ILIKE $${i} OR m.name ILIKE $${i})`)
      i++
    }
    const where = conditions.join(' AND ')
    const limit = Math.min(Math.max(parseInt(pageSize || '20', 10) || 20, 1), 100)
    const offset = (Math.max(parseInt(page || '1', 10) || 1, 1) - 1) * limit

    const [list, total, modules] = await Promise.all([
      query<{
        id: string
        checkpoint_title: string
        module_name: string
        module_slug: string
        department_name: string
        submission_date: string
        status: string
        submitted_at: string | null
        approved_at: string | null
        rejected_at: string | null
        review_comment: string | null
        auto_approved: boolean
        compliance_status: string | null
        accuracy_status: string | null
        evidence_count: number
        score: number
      }>(
        `SELECT s.id, c.title AS checkpoint_title, m.name AS module_name, m.slug AS module_slug,
                d.name AS department_name, s.submission_date::text, s.status, s.submitted_at,
                s.approved_at, s.rejected_at, s.review_comment, s.auto_approved,
                a.compliance_status, a.accuracy_status, c.score,
                (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id) AS evidence_count
         FROM checkpoint_submissions s
         JOIN checkpoints c ON c.id = s.checkpoint_id
         JOIN modules m ON m.id = c.module_id
         JOIN departments d ON d.id = m.department_id
         LEFT JOIN submission_answers a ON a.submission_id = s.id
         WHERE ${where}
         ORDER BY s.submission_date DESC, s.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM checkpoint_submissions s
         JOIN checkpoints c ON c.id = s.checkpoint_id
         JOIN modules m ON m.id = c.module_id
         WHERE ${where}`,
        params
      ),
      query<{ slug: string; name: string }>(
        `SELECT DISTINCT m.slug, m.name FROM modules m
         JOIN checkpoints c ON c.module_id = m.id
         JOIN checkpoint_submissions s ON s.checkpoint_id = c.id
         WHERE s.user_id = $1 ORDER BY m.name`,
        [user.id]
      ),
    ])

    ok(res, {
      items: list.rows.map((r) => ({
        id: r.id,
        checkpointTitle: r.checkpoint_title,
        moduleName: r.module_name,
        moduleSlug: r.module_slug,
        departmentName: r.department_name,
        submissionDate: r.submission_date,
        status: r.status,
        submittedAt: r.submitted_at,
        approvedAt: r.approved_at,
        rejectedAt: r.rejected_at,
        reviewComment: r.review_comment,
        autoApproved: r.auto_approved,
        complianceStatus: r.compliance_status,
        accuracyStatus: r.accuracy_status,
        evidenceCount: r.evidence_count,
        score: r.score,
      })),
      total: total.rows[0].c,
      page: Math.max(parseInt(page || '1', 10) || 1, 1),
      pageSize: limit,
      modules: modules.rows,
    })
  })
)

export default router
