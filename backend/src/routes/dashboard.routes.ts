import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, istToday, ok } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

// GET /api/dashboard — current user's dashboard
router.get(
  '/',
  ah(async (req, res) => {
    const user = req.user!
    const today = istToday()

    const [assigned, submitted, approvedToday, rejected, pendingReview, approvedTotal, weekly, recent, todayTasks] =
      await Promise.all([
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM checkpoint_assignments
           WHERE user_id = $1 AND assigned_date = $2 AND status = 'ACTIVE'`,
          [user.id, today]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE user_id = $1 AND submission_date = $2 AND status = 'SUBMITTED'`,
          [user.id, today]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE user_id = $1 AND submission_date = $2 AND status = 'APPROVED'`,
          [user.id, today]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE user_id = $1 AND status = 'REJECTED'`,
          [user.id]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE user_id = $1 AND status = 'SUBMITTED'`,
          [user.id]
        ),
        query<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE user_id = $1 AND status = 'APPROVED'`,
          [user.id]
        ),
        query<{ day: string; submissions: number; approved: number }>(
          `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                  COUNT(s.id)::int AS submissions,
                  COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved
           FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
           LEFT JOIN checkpoint_submissions s
             ON s.submission_date = d::date AND s.user_id = $1
           GROUP BY d ORDER BY d`,
          [user.id]
        ),
        query<{
          id: string
          checkpoint_title: string
          module_name: string
          status: string
          updated_at: string
        }>(
          `SELECT s.id, c.title AS checkpoint_title, m.name AS module_name, s.status, s.updated_at
           FROM checkpoint_submissions s
           JOIN checkpoints c ON c.id = s.checkpoint_id
           JOIN modules m ON m.id = c.module_id
           WHERE s.user_id = $1
           ORDER BY s.updated_at DESC LIMIT 6`,
          [user.id]
        ),
        query<{
          assignment_id: string
          checkpoint_id: string
          checkpoint_title: string
          module_name: string
          module_slug: string
          due_date: string | null
          status: string | null
          submission_id: string | null
          evidence_count: number
        }>(
          `SELECT a.id AS assignment_id, c.id AS checkpoint_id, c.title AS checkpoint_title,
                  m.name AS module_name, m.slug AS module_slug, a.due_date::text,
                  s.status, s.id AS submission_id,
                  (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id) AS evidence_count
           FROM checkpoint_assignments a
           JOIN checkpoints c ON c.id = a.checkpoint_id
           JOIN modules m ON m.id = c.module_id
           LEFT JOIN checkpoint_submissions s
             ON s.assignment_id = a.id AND s.user_id = a.user_id
           WHERE a.user_id = $1 AND a.assigned_date = $2 AND a.status = 'ACTIVE'
           ORDER BY m.display_order, c.display_order`,
          [user.id, today]
        ),
      ])

    ok(res, {
      kpis: {
        assignedToday: assigned.rows[0].c,
        submittedToday: submitted.rows[0].c,
        approvedToday: approvedToday.rows[0].c,
        approvedTotal: approvedTotal.rows[0].c,
        rejectedTotal: rejected.rows[0].c,
        pendingReview: pendingReview.rows[0].c,
        completionRate:
          assigned.rows[0].c > 0
            ? Math.round(((approvedToday.rows[0].c + submitted.rows[0].c) / assigned.rows[0].c) * 100)
            : 0,
      },
      weekly: weekly.rows,
      recentActivity: recent.rows.map((r) => ({
        id: r.id,
        checkpointTitle: r.checkpoint_title,
        moduleName: r.module_name,
        status: r.status,
        updatedAt: r.updated_at,
      })),
      todayTasks: todayTasks.rows.map((t) => ({
        assignmentId: t.assignment_id,
        checkpointId: t.checkpoint_id,
        checkpointTitle: t.checkpoint_title,
        moduleName: t.module_name,
        moduleSlug: t.module_slug,
        dueDate: t.due_date,
        status: t.status || 'PENDING',
        submissionId: t.submission_id,
        evidenceCount: t.evidence_count,
      })),
    })
  })
)

export default router
