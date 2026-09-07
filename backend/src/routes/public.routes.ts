import { Router } from 'express'
import { query } from '../db.js'
import { ah, ok } from '../utils/http.js'

const router = Router()

// GET /api/public/stats — landing page live statistics
router.get(
  '/stats',
  ah(async (_req, res) => {
    const [modules, checkpoints, users, submissions, departments, approved] = await Promise.all([
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM modules WHERE status = 'ACTIVE'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM checkpoints WHERE status = 'ACTIVE'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM users WHERE status = 'ACTIVE'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM checkpoint_submissions`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM departments WHERE status = 'ACTIVE'`),
      query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM checkpoint_submissions WHERE status = 'APPROVED'`),
    ])
    const totalSubs = submissions.rows[0].c
    ok(res, {
      modules: modules.rows[0].c,
      checkpoints: checkpoints.rows[0].c,
      users: users.rows[0].c,
      submissions: totalSubs,
      departments: departments.rows[0].c,
      approvalRate: totalSubs > 0 ? Math.round((approved.rows[0].c / totalSubs) * 100) : 0,
    })
  })
)

export default router
