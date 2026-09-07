import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, istToday, ok } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

// GET /api/modules — modules with the user's progress per module
router.get(
  '/',
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query<{
      id: string
      name: string
      slug: string
      description: string | null
      display_order: number
      department_name: string
      checkpoint_count: number
      today_total: number
      today_done: number
    }>(
      `SELECT m.id, m.name, m.slug, m.description, m.display_order, d.name AS department_name,
              (SELECT COUNT(*)::int FROM checkpoints c WHERE c.module_id = m.id AND c.status = 'ACTIVE') AS checkpoint_count,
              COUNT(DISTINCT a2.id)::int AS today_total,
              COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('APPROVED','SUBMITTED','REJECTED'))::int AS today_done
       FROM modules m
       JOIN departments d ON d.id = m.department_id
       LEFT JOIN checkpoints c2 ON c2.module_id = m.id
       LEFT JOIN checkpoint_assignments a2 ON a2.checkpoint_id = c2.id AND a2.user_id = $1 AND a2.assigned_date = $2 AND a2.status = 'ACTIVE'
       LEFT JOIN checkpoint_submissions s ON s.assignment_id = a2.id
       WHERE m.status = 'ACTIVE'
       GROUP BY m.id, d.name
       ORDER BY m.display_order`,
      [user.id, istToday()]
    )
    ok(
      res,
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        displayOrder: r.display_order,
        departmentName: r.department_name,
        checkpointCount: r.checkpoint_count,
        todayTotal: r.today_total,
        todayDone: r.today_done,
      }))
    )
  })
)

// GET /api/modules/:slug — module detail with checkpoints and today's status
router.get(
  '/:slug',
  ah(async (req, res) => {
    const user = req.user!
    const today = istToday()
    const { rows: mod } = await query<{ id: string; name: string; slug: string; description: string | null; department_name: string }>(
      `SELECT m.id, m.name, m.slug, m.description, d.name AS department_name
       FROM modules m JOIN departments d ON d.id = m.department_id
       WHERE m.slug = $1 AND m.status = 'ACTIVE'`,
      [req.params.slug]
    )
    if (mod.length === 0) {
      return res.status(404).json({ success: false, message: 'Module not found' })
    }
    const { rows: checkpoints } = await query<{
      id: string
      title: string
      description: string | null
      score: number
      is_accuracy_required: boolean
      is_corrective_action_required: boolean
      is_photo_required: boolean
      display_order: number
      status: string | null
      submission_id: string | null
      evidence_count: number
      due_date: string | null
    }>(
      `SELECT c.id, c.title, c.description, c.score, c.is_accuracy_required,
              c.is_corrective_action_required, c.is_photo_required, c.display_order,
              s.status, s.id AS submission_id, a.due_date::text,
              (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id) AS evidence_count
       FROM checkpoints c
       LEFT JOIN checkpoint_assignments a
         ON a.checkpoint_id = c.id AND a.user_id = $1 AND a.assigned_date = $2 AND a.status = 'ACTIVE'
       LEFT JOIN checkpoint_submissions s ON s.assignment_id = a.id
       WHERE c.module_id = $3 AND c.status = 'ACTIVE'
       ORDER BY c.display_order`,
      [user.id, today, mod[0].id]
    )
    ok(res, {
      module: {
        id: mod[0].id,
        name: mod[0].name,
        slug: mod[0].slug,
        description: mod[0].description,
        departmentName: mod[0].department_name,
      },
      checkpoints: checkpoints.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        score: c.score,
        isAccuracyRequired: c.is_accuracy_required,
        isCorrectiveActionRequired: c.is_corrective_action_required,
        isPhotoRequired: c.is_photo_required,
        displayOrder: c.display_order,
        status: c.status || 'PENDING',
        submissionId: c.submission_id,
        evidenceCount: c.evidence_count,
        dueDate: c.due_date,
      })),
    })
  })
)

export default router
