import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ── Get all roles with member counts ───────────────────────
router.get('/roles', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.name, r.description, COUNT(u.id)::int AS user_count
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id AND u.status = 'ACTIVE'
       GROUP BY r.id, r.name, r.description
       ORDER BY 
         CASE 
           WHEN r.name = 'ADMIN' THEN 1
           WHEN r.name = 'MANAGER' THEN 2
           WHEN r.name = 'SUPERVISOR' THEN 3
           WHEN r.name = 'AUDITOR' THEN 4
           WHEN r.name = 'USER' THEN 5
           ELSE 6
         END, r.name`
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('[chat] roles error:', err)
    res.status(500).json({ success: false, message: 'Failed to load roles' })
  }
})

// ── Get all users with full profile details & roles ─────────
router.get('/users', async (req, res) => {
  try {
    const role = req.query.role as string | undefined
    let sql = `
      SELECT u.id, u.full_name, u.username, u.email, u.phone, u.employee_code,
             u.profile_image, u.status, u.last_login_at,
             r.name AS role_name, r.description AS role_description,
             d.name AS department_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.status = 'ACTIVE'
    `
    const params: any[] = []
    if (role && role !== 'ALL') {
      params.push(role)
      sql += ` AND r.name = $${params.length}`
    }
    sql += ` ORDER BY r.name, u.full_name`

    const { rows } = await query(sql, params)
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('[chat] users error:', err)
    res.status(500).json({ success: false, message: 'Failed to load users' })
  }
})

// ── Analytics & Charts for Chat Section ───────────────────────
router.get('/analytics', async (_req, res) => {
  try {
    const [
      totals,
      volumeTrend,
      typeDist,
      roleDist,
      callStats,
      storageStats
    ] = await Promise.all([
      query<{ total_messages: number; total_conversations: number; total_members: number }>(
        `SELECT 
           (SELECT COUNT(*)::int FROM messages WHERE is_deleted = FALSE) AS total_messages,
           (SELECT COUNT(*)::int FROM conversations) AS total_conversations,
           (SELECT COUNT(*)::int FROM conversation_members) AS total_members`
      ),
      query<{ date: string; label: string; count: number }>(
        `SELECT to_char(d::date, 'YYYY-MM-DD') AS date,
                to_char(d::date, 'Mon DD') AS label,
                COUNT(m.id)::int AS count
         FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval) d
         LEFT JOIN messages m ON m.created_at::date = d::date AND m.is_deleted = FALSE
         GROUP BY d ORDER BY d`
      ),
      query<{ type: string; count: number }>(
        `SELECT COALESCE(message_type, 'TEXT') AS type, COUNT(*)::int AS count
         FROM messages WHERE is_deleted = FALSE
         GROUP BY message_type ORDER BY count DESC`
      ),
      query<{ role_name: string; count: number }>(
        `SELECT COALESCE(r.name, 'UNKNOWN') AS role_name, COUNT(m.id)::int AS count
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         JOIN roles r ON r.id = u.role_id
         WHERE m.is_deleted = FALSE
         GROUP BY r.name ORDER BY count DESC`
      ),
      query<{ call_type: string; status: string; count: number; total_duration: number }>(
        `SELECT call_type, status, COUNT(*)::int AS count, COALESCE(SUM(duration), 0)::int AS total_duration
         FROM call_logs
         GROUP BY call_type, status`
      ),
      query<{ oldest_at: string | null; newest_at: string | null; total_characters: number }>(
        `SELECT MIN(created_at)::text AS oldest_at,
                MAX(created_at)::text AS newest_at,
                COALESCE(SUM(LENGTH(content)), 0)::int AS total_characters
         FROM messages WHERE is_deleted = FALSE`
      )
    ])

    res.json({
      success: true,
      data: {
        totals: totals.rows[0],
        volumeTrend: volumeTrend.rows,
        typeDistribution: typeDist.rows,
        roleDistribution: roleDist.rows,
        callStats: callStats.rows,
        storageStats: storageStats.rows[0]
      }
    })
  } catch (err) {
    console.error('[chat] analytics error:', err)
    res.status(500).json({ success: false, message: 'Failed to load chat analytics' })
  }
})

// ── Complete Chat Export ──────────────────────────────────────
router.get('/export', async (req, res) => {
  const userId = req.user!.id
  try {
    const { rows } = await query(
      `SELECT c.id AS conversation_id, c.title, c.is_group,
              m.id AS message_id, m.content, m.message_type, m.created_at,
              u.full_name AS sender_name, u.username AS sender_username, r.name AS sender_role
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
       JOIN messages m ON m.conversation_id = c.id AND m.is_deleted = FALSE
       JOIN users u ON u.id = m.sender_id
       JOIN roles r ON r.id = u.role_id
       ORDER BY c.id, m.created_at ASC`,
      [userId]
    )
    res.json({ success: true, count: rows.length, data: rows })
  } catch (err) {
    console.error('[chat] export error:', err)
    res.status(500).json({ success: false, message: 'Failed to export chats' })
  }
})

// ── Get all conversations for current user ─────────────────
router.get('/', async (req, res) => {
  const userId = req.user!.id
  try {
    const { rows } = await query(
      `SELECT c.id, c.title, c.is_group, c.created_at, c.updated_at,
              cm.role AS my_role,
              (SELECT content FROM messages m WHERE m.conversation_id = c.id AND m.is_deleted = FALSE ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT message_type FROM messages m WHERE m.conversation_id = c.id AND m.is_deleted = FALSE ORDER BY m.created_at DESC LIMIT 1) AS last_message_type,
              (SELECT sender_id FROM messages m WHERE m.conversation_id = c.id AND m.is_deleted = FALSE ORDER BY m.created_at DESC LIMIT 1) AS last_sender_id,
              (SELECT created_at FROM messages m WHERE m.conversation_id = c.id AND m.is_deleted = FALSE ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*) FROM messages m
               WHERE m.conversation_id = c.id AND m.is_deleted = FALSE
                 AND m.created_at > COALESCE((SELECT read_at FROM message_reads mr WHERE mr.message_id IN (SELECT id FROM messages WHERE conversation_id = c.id) AND mr.user_id = $1 ORDER BY mr.read_at DESC LIMIT 1), '1970-01-01')
              )::int AS unread_count
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
       ORDER BY COALESCE(
         (SELECT created_at FROM messages m WHERE m.conversation_id = c.id AND m.is_deleted = FALSE ORDER BY m.created_at DESC LIMIT 1),
         c.created_at
       ) DESC`,
      [userId]
    )

    // Get members for each conversation
    const convIds = rows.map(r => r.id)
    let memberMap: Record<string, any[]> = {}

    if (convIds.length > 0) {
      const { rows: members } = await query(
        `SELECT cm.conversation_id, cm.user_id, u.full_name, u.username, u.phone, u.email,
                u.employee_code, u.profile_image, r.name AS role_name, d.name AS department_name
         FROM conversation_members cm
         JOIN users u ON u.id = cm.user_id
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE cm.conversation_id = ANY($1)`,
        [convIds]
      )
      for (const m of members) {
        if (!memberMap[m.conversation_id]) memberMap[m.conversation_id] = []
        memberMap[m.conversation_id].push({
          userId: m.user_id,
          fullName: m.full_name,
          username: m.username,
          phone: m.phone,
          email: m.email,
          employeeCode: m.employee_code,
          profileImage: m.profile_image,
          roleName: m.role_name,
          departmentName: m.department_name,
        })
      }
    }

    const conversations = rows.map(r => {
      const members = memberMap[r.id] || []
      const otherMember = members.find(m => m.userId !== userId) || members[0]
      return {
        id: r.id,
        title: r.title || (r.is_group ? 'Group Chat' : otherMember?.fullName || 'Chat'),
        isGroup: r.is_group,
        lastMessage: r.last_message,
        lastMessageType: r.last_message_type || 'TEXT',
        lastMessageAt: r.last_message_at,
        unreadCount: r.unread_count,
        members,
        otherUser: !r.is_group ? otherMember : null,
        createdAt: r.created_at,
      }
    })

    res.json({ success: true, data: conversations })
  } catch (err) {
    console.error('[chat] list error:', err)
    res.status(500).json({ success: false, message: 'Failed to load conversations' })
  }
})

// ── Create a conversation (one-to-one or group) ────────────
router.post('/', async (req, res) => {
  const userId = req.user!.id
  const schema = z.object({
    title: z.string().max(150).optional(),
    isGroup: z.boolean().optional(),
    memberIds: z.array(z.string().uuid()).min(1).max(50),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message })

  const { title, isGroup = false, memberIds } = parsed.data

  try {
    // For one-to-one, check if conversation already exists
    if (!isGroup && memberIds.length === 1) {
      const otherId = memberIds[0]
      const { rows: existing } = await query(
        `SELECT c.id FROM conversations c
         WHERE c.is_group = FALSE
           AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $1)
           AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $2)
         LIMIT 1`,
        [userId, otherId]
      )
      if (existing.length > 0) {
        return res.json({ success: true, data: { id: existing[0].id }, message: 'Conversation already exists' })
      }
    }

    // Create conversation
    const { rows: [conv] } = await query(
      `INSERT INTO conversations (title, is_group, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [title || null, isGroup, userId]
    )

    // Add creator as OWNER
    await query(
      `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
      [conv.id, userId]
    )

    // Add other members
    const uniqueMembers = [...new Set(memberIds.filter(id => id !== userId))]
    for (const memberId of uniqueMembers) {
      await query(
        `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'MEMBER') ON CONFLICT DO NOTHING`,
        [conv.id, memberId]
      )
    }

    res.status(201).json({ success: true, data: { id: conv.id } })
  } catch (err) {
    console.error('[chat] create error:', err)
    res.status(500).json({ success: false, message: 'Failed to create conversation' })
  }
})

// ── Get messages for a conversation ────────────────────────
router.get('/:id/messages', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200)
  const before = req.query.before as string | undefined

  try {
    // Verify membership
    const { rows: member } = await query(
      `SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [id, userId]
    )
    if (member.length === 0) return res.status(403).json({ success: false, message: 'Not a member' })

    let sql = `
      SELECT m.id, m.sender_id, m.content, m.message_type, m.is_edited, m.is_deleted, m.created_at,
             u.full_name AS sender_name, u.username AS sender_username, u.phone AS sender_phone,
             u.profile_image AS sender_image, r.name AS sender_role
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      JOIN roles r ON r.id = u.role_id
      WHERE m.conversation_id = $1
    `
    const params: any[] = [id]

    if (before) {
      params.push(before)
      sql += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`
    }

    sql += ` AND m.is_deleted = FALSE ORDER BY m.created_at DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const { rows } = await query(sql, params)

    // Mark as read
    if (rows.length > 0) {
      const latestMsgId = rows[0].id
      await query(
        `INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = NOW()`,
        [latestMsgId, userId]
      )
    }

    const formatted = rows.map(r => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      senderUsername: r.sender_username,
      senderPhone: r.sender_phone,
      senderImage: r.sender_image,
      senderRole: r.sender_role,
      content: r.content,
      messageType: r.message_type,
      isEdited: r.is_edited,
      isDeleted: r.is_deleted,
      createdAt: r.created_at,
    }))

    res.json({ success: true, data: formatted.reverse() })
  } catch (err) {
    console.error('[chat] messages error:', err)
    res.status(500).json({ success: false, message: 'Failed to load messages' })
  }
})

// ── Send a message ─────────────────────────────────────────
router.post('/:id/messages', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  const schema = z.object({
    content: z.string().min(1).max(10000),
    messageType: z.enum(['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'LOCATION', 'CALL', 'SYSTEM', 'DOCUMENT']).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message })

  const { content, messageType = 'TEXT' } = parsed.data

  try {
    // Verify membership
    const { rows: member } = await query(
      `SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [id, userId]
    )
    if (member.length === 0) return res.status(403).json({ success: false, message: 'Not a member' })

    // Insert message
    const { rows: [msg] } = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [id, userId, content, messageType]
    )

    // Update conversation timestamp
    await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [id])

    // Get sender info
    const { rows: [sender] } = await query(
      `SELECT u.full_name, u.username, u.phone, u.profile_image, r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId]
    )

    res.status(201).json({
      success: true,
      data: {
        id: msg.id,
        senderId: userId,
        senderName: sender.full_name,
        senderUsername: sender.username,
        senderPhone: sender.phone,
        senderImage: sender.profile_image,
        senderRole: sender.role_name,
        content,
        messageType,
        isEdited: false,
        isDeleted: false,
        createdAt: msg.created_at,
      }
    })
  } catch (err) {
    console.error('[chat] send error:', err)
    res.status(500).json({ success: false, message: 'Failed to send message' })
  }
})

// ── Get conversation members ───────────────────────────────
router.get('/:id/members', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  try {
    const { rows: member } = await query(
      `SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [id, userId]
    )
    if (member.length === 0) return res.status(403).json({ success: false, message: 'Not a member' })

    const { rows } = await query(
      `SELECT cm.user_id, u.full_name, u.username, u.phone, u.email, u.employee_code,
              u.profile_image, r.name AS role_name, d.name AS department_name, cm.role, cm.joined_at
       FROM conversation_members cm
       JOIN users u ON u.id = cm.user_id
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE cm.conversation_id = $1
       ORDER BY cm.role DESC, u.full_name`,
      [id]
    )
    res.json({
      success: true,
      data: rows.map(r => ({
        userId: r.user_id,
        fullName: r.full_name,
        username: r.username,
        phone: r.phone,
        email: r.email,
        employeeCode: r.employee_code,
        profileImage: r.profile_image,
        roleName: r.role_name,
        departmentName: r.department_name,
        role: r.role,
        joinedAt: r.joined_at,
      }))
    })
  } catch (err) {
    console.error('[chat] members error:', err)
    res.status(500).json({ success: false, message: 'Failed to load members' })
  }
})

// ── Call logs (WhatsApp calls tab) ─────────────────────────
router.get('/calls', async (req, res) => {
  const userId = req.user!.id
  try {
    const { rows } = await query(
      `SELECT cl.id, cl.caller_id, cl.receiver_id, cl.call_type, cl.status, cl.duration, cl.started_at, cl.ended_at,
              u_caller.full_name AS caller_name, u_caller.username AS caller_username, u_caller.phone AS caller_phone,
              u_caller.profile_image AS caller_image, r_caller.name AS caller_role,
              u_recv.full_name AS receiver_name, u_recv.username AS receiver_username, u_recv.phone AS receiver_phone,
              u_recv.profile_image AS receiver_image, r_recv.name AS receiver_role
       FROM call_logs cl
       JOIN users u_caller ON u_caller.id = cl.caller_id
       JOIN roles r_caller ON r_caller.id = u_caller.role_id
       JOIN users u_recv ON u_recv.id = cl.receiver_id
       JOIN roles r_recv ON r_recv.id = u_recv.role_id
       WHERE cl.caller_id = $1 OR cl.receiver_id = $1
       ORDER BY cl.started_at DESC
       LIMIT 50`,
      [userId]
    )

    const logs = rows.map(r => {
      const isOutgoing = r.caller_id === userId
      const otherUser = isOutgoing
        ? {
            id: r.receiver_id,
            fullName: r.receiver_name,
            username: r.receiver_username,
            phone: r.receiver_phone,
            image: r.receiver_image,
            roleName: r.receiver_role,
          }
        : {
            id: r.caller_id,
            fullName: r.caller_name,
            username: r.caller_username,
            phone: r.caller_phone,
            image: r.caller_image,
            roleName: r.caller_role,
          }
      return {
        id: r.id,
        isOutgoing,
        callType: r.call_type, // 'AUDIO' | 'VIDEO'
        status: r.status, // 'COMPLETED' | 'MISSED' | 'REJECTED'
        duration: r.duration,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        otherUser,
      }
    })

    res.json({ success: true, data: logs })
  } catch (err) {
    console.error('[chat] calls error:', err)
    res.status(500).json({ success: false, message: 'Failed to load call logs' })
  }
})

// ── Log a completed or missed call ─────────────────────────
router.post('/calls', async (req, res) => {
  const userId = req.user!.id
  const schema = z.object({
    receiverId: z.string().uuid(),
    callType: z.enum(['AUDIO', 'VIDEO']).default('AUDIO'),
    status: z.enum(['COMPLETED', 'MISSED', 'REJECTED', 'BUSY', 'NO_ANSWER']).default('COMPLETED'),
    duration: z.number().min(0).default(0),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message })

  const { receiverId, callType, status, duration } = parsed.data
  try {
    const { rows: [call] } = await query(
      `INSERT INTO call_logs (caller_id, receiver_id, call_type, status, duration, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - ($5 || ' seconds')::INTERVAL, NOW())
       RETURNING id, started_at`,
      [userId, receiverId, callType, status, duration]
    )
    res.status(201).json({ success: true, data: call })
  } catch (err) {
    console.error('[chat] log call error:', err)
    res.status(500).json({ success: false, message: 'Failed to log call' })
  }
})

// ── Delete a message (soft delete) ─────────────────────────
router.delete('/:id/messages/:messageId', async (req, res) => {
  const userId = req.user!.id
  const { id, messageId } = req.params
  try {
    const { rows } = await query(
      `UPDATE messages SET is_deleted = TRUE, content = 'This message was deleted', updated_at = NOW()
       WHERE id = $1 AND sender_id = $2 AND conversation_id = $3 RETURNING id`,
      [messageId, userId, id]
    )
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found or not yours' })
    res.json({ success: true })
  } catch (err) {
    console.error('[chat] delete msg error:', err)
    res.status(500).json({ success: false, message: 'Failed to delete message' })
  }
})

// ── Leave a conversation ───────────────────────────────────
router.post('/:id/leave', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  try {
    await query(
      `DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 AND role != 'OWNER'`,
      [id, userId]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('[chat] leave error:', err)
    res.status(500).json({ success: false, message: 'Failed to leave conversation' })
  }
})

export default router
