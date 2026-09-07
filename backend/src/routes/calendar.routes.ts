import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, istToday, ok } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

// GET /api/calendar?year=2026&month=9 — month view buckets for the current user
router.get(
  '/',
  ah(async (req, res) => {
    const user = req.user!
    const now = new Date(Date.now() + 5.5 * 3600 * 1000)
    const year = parseInt((req.query.year as string) || String(now.getUTCFullYear()), 10)
    const month = parseInt((req.query.month as string) || String(now.getUTCMonth() + 1), 10)
    const first = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { rows: days } = await query<{
      date: string
      total: number
      completed: number
      approved: number
      submitted: number
      rejected: number
      draft: number
      pending: number
    }>(
      `SELECT s.submission_date::text AS date,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE s.status IN ('APPROVED','SUBMITTED','REJECTED'))::int AS completed,
              COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved,
              COUNT(*) FILTER (WHERE s.status = 'SUBMITTED')::int AS submitted,
              COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected,
              COUNT(*) FILTER (WHERE s.status = 'DRAFT')::int AS draft,
              COUNT(*) FILTER (WHERE s.status = 'PENDING')::int AS pending
       FROM checkpoint_submissions s
       WHERE s.user_id = $1 AND s.submission_date BETWEEN $2 AND $3
       GROUP BY s.submission_date
       ORDER BY s.submission_date`,
      [user.id, first, last]
    )

    const { rows: items } = await query<{
      id: string
      date: string
      checkpoint_title: string
      module_name: string
      module_slug: string
      status: string
      submitted_at: string | null
      approved_at: string | null
      rejected_at: string | null
      review_comment: string | null
      compliance_status: string | null
      accuracy_status: string | null
      comments: string | null
      corrective_action: string | null
      evidence_count: number
    }>(
      `SELECT s.id, s.submission_date::text AS date, c.title AS checkpoint_title,
              m.name AS module_name, m.slug AS module_slug, s.status, s.submitted_at,
              s.approved_at, s.rejected_at, s.review_comment,
              a.compliance_status, a.accuracy_status, a.comments, a.corrective_action,
              (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id) AS evidence_count
       FROM checkpoint_submissions s
       JOIN checkpoints c ON c.id = s.checkpoint_id
       JOIN modules m ON m.id = c.module_id
       LEFT JOIN submission_answers a ON a.submission_id = s.id
       WHERE s.user_id = $1 AND s.submission_date BETWEEN $2 AND $3
       ORDER BY s.submission_date, c.display_order`,
      [user.id, first, last]
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
      today: istToday(),
    })
  })
)

export default router
