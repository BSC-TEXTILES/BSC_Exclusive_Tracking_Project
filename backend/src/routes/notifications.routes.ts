import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, fail, ok } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

// GET /api/notifications
router.get(
  '/',
  ah(async (req, res) => {
    const user = req.user!
    const unreadOnly = req.query.unread === '1'
    const [list, count] = await Promise.all([
      query<{ id: string; title: string; message: string; type: string; is_read: boolean; link_url: string | null; created_at: string }>(
        `SELECT id, title, message, type, is_read, link_url, created_at
         FROM notifications
         WHERE user_id = $1 ${unreadOnly ? 'AND is_read = FALSE' : ''}
         ORDER BY created_at DESC LIMIT 30`,
        [user.id]
      ),
      query<{ c: number }>(
        'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [user.id]
      ),
    ])
    ok(res, {
      items: list.rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.is_read,
        linkUrl: n.link_url,
        createdAt: n.created_at,
      })),
      unreadCount: count.rows[0].c,
    })
  })
)

// PATCH /api/notifications/:id/read
router.patch(
  '/:id/read',
  ah(async (req, res) => {
    const { rowCount } = await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user!.id,
    ])
    if (rowCount === 0) return fail(res, 404, 'Notification not found')
    ok(res, { updated: true })
  })
)

// POST /api/notifications/read-all
router.post(
  '/read-all',
  ah(async (req, res) => {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user!.id])
    ok(res, { updated: true })
  })
)

export default router
