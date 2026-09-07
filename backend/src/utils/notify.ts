import { query } from '../db.js'

export async function notifyUser(
  userId: string,
  n: { title: string; message: string; type?: string; linkUrl?: string }
) {
  try {
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link_url) VALUES ($1,$2,$3,$4,$5)`,
      [userId, n.title, n.message, n.type || 'info', n.linkUrl || null]
    )
  } catch (err) {
    console.error('[notify] write failed:', (err as Error).message)
  }
}

export async function notifyAdmins(n: { title: string; message: string; type?: string; linkUrl?: string }) {
  try {
    const { rows } = await query<{ id: string }>(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'`
    )
    for (const row of rows) await notifyUser(row.id, n)
  } catch (err) {
    console.error('[notify] admin broadcast failed:', (err as Error).message)
  }
}
