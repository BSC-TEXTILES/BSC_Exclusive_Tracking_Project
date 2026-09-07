import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, ok } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

// GET /api/reports — compliance & accuracy analytics for the current user
router.get(
  '/',
  ah(async (req, res) => {
    const user = req.user!
    const [totals, byStatus, compliance, accuracy, byModule, trend, monthly] = await Promise.all([
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE user_id = $1`, [user.id]),
      query<{ status: string; c: number }>(
        `SELECT status, COUNT(*)::int AS c FROM checkpoint_submissions WHERE user_id = $1 GROUP BY status`,
        [user.id]
      ),
      query<{ compliance_status: string; c: number }>(
        `SELECT a.compliance_status, COUNT(*)::int AS c
         FROM submission_answers a
         JOIN checkpoint_submissions s ON s.id = a.submission_id
         WHERE s.user_id = $1 AND a.compliance_status IS NOT NULL
         GROUP BY a.compliance_status`,
        [user.id]
      ),
      query<{ accuracy_status: string; c: number }>(
        `SELECT a.accuracy_status, COUNT(*)::int AS c
         FROM submission_answers a
         JOIN checkpoint_submissions s ON s.id = a.submission_id
         WHERE s.user_id = $1 AND a.accuracy_status IS NOT NULL
         GROUP BY a.accuracy_status`,
        [user.id]
      ),
      query<{ module_name: string; total: number; approved: number; rejected: number; pending: number }>(
        `SELECT m.name AS module_name, COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved,
                COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected,
                COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED','DRAFT','PENDING'))::int AS pending
         FROM checkpoint_submissions s
         JOIN checkpoints c ON c.id = s.checkpoint_id
         JOIN modules m ON m.id = c.module_id
         WHERE s.user_id = $1
         GROUP BY m.name ORDER BY total DESC`,
        [user.id]
      ),
      query<{ day: string; total: number; approved: number }>(
        `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                COUNT(s.id)::int AS total,
                COUNT(*) FILTER (WHERE s.status = 'APPROVED')::int AS approved
         FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day') d
         LEFT JOIN checkpoint_submissions s ON s.submission_date = d::date AND s.user_id = $1
         GROUP BY d ORDER BY d`,
        [user.id]
      ),
      query<{ month: string; total: number; approved: number; rejected: number }>(
        `SELECT to_char(date_trunc('month', submission_date), 'YYYY-MM') AS month,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
                COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected
         FROM checkpoint_submissions WHERE user_id = $1
         GROUP BY 1 ORDER BY 1 DESC LIMIT 6`,
        [user.id]
      ),
    ])

    const statusMap = Object.fromEntries(byStatus.rows.map((r) => [r.status, r.c]))
    ok(res, {
      totals: {
        total: totals.rows[0].c,
        approved: statusMap.APPROVED || 0,
        rejected: statusMap.REJECTED || 0,
        submitted: statusMap.SUBMITTED || 0,
        draft: statusMap.DRAFT || 0,
        pending: statusMap.PENDING || 0,
        approvalRate:
          totals.rows[0].c > 0
            ? Math.round(((statusMap.APPROVED || 0) / totals.rows[0].c) * 100)
            : 0,
      },
      byStatus: byStatus.rows,
      compliance: compliance.rows,
      accuracy: accuracy.rows,
      byModule: byModule.rows,
      trend: trend.rows,
      monthly: monthly.rows.map((r) => ({ ...r, month: r.month })),
    })
  })
)

// GET /api/reports/export — CSV export of own submissions
router.get(
  '/export',
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query<{
      date: string
      module: string
      checkpoint: string
      compliance: string | null
      accuracy: string | null
      status: string
      submitted_at: string | null
      reviewed_at: string | null
      comment: string | null
      evidence: number
      score: number
    }>(
      `SELECT s.submission_date::text AS date, m.name AS module, c.title AS checkpoint,
              a.compliance_status AS compliance, a.accuracy_status AS accuracy, s.status,
              to_char(s.submitted_at, 'YYYY-MM-DD HH24:MI') AS submitted_at,
              to_char(COALESCE(s.approved_at, s.rejected_at), 'YYYY-MM-DD HH24:MI') AS reviewed_at,
              s.review_comment AS comment, c.score,
              (SELECT COUNT(*)::int FROM evidence_files e WHERE e.submission_id = s.id) AS evidence
       FROM checkpoint_submissions s
       JOIN checkpoints c ON c.id = s.checkpoint_id
       JOIN modules m ON m.id = c.module_id
       LEFT JOIN submission_answers a ON a.submission_id = s.id
       WHERE s.user_id = $1
       ORDER BY s.submission_date DESC, s.created_at DESC`,
      [user.id]
    )
    const header = ['Date', 'Module', 'Checkpoint', 'Compliance', 'Accuracy', 'Status', 'Submitted At', 'Reviewed At', 'Review Comment', 'Evidence Files', 'Score']
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [r.date, r.module, r.checkpoint, r.compliance, r.accuracy, r.status, r.submitted_at, r.reviewed_at, r.comment, r.evidence, r.score]
          .map(esc)
          .join(',')
      ),
    ]
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="bsc-tracking-report.csv"')
    res.send('\uFEFF' + lines.join('\n'))
  })
)

export default router
