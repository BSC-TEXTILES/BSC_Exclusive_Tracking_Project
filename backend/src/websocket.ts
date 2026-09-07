import { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { config } from './config.js'
import { verifyToken } from './utils/session.js'
import { query } from './db.js'

let io: Server
// Map of userId -> count of active socket connections
const onlineUsers = new Map<string, number>()

export function getIO(): Server {
  return io
}

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  })

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie?.match(/bsc_session=([^;]+)/)?.[1]
      if (!token) return next(new Error('Authentication required'))

      const payload = await verifyToken(token)
      if (!payload) return next(new Error('Invalid token'))

      const { rows } = await query<{ id: string; full_name: string; username: string; phone: string | null; role_name: string }>(
        `SELECT u.id, u.full_name, u.username, u.phone, r.name AS role_name
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1 AND u.status = 'ACTIVE'`,
        [payload.uid]
      )
      if (rows.length === 0) return next(new Error('User not found'))

      socket.data.user = {
        id: rows[0].id,
        fullName: rows[0].full_name,
        username: rows[0].username,
        phone: rows[0].phone,
        roleName: rows[0].role_name,
      }
      next()
    } catch {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user
    console.log(`[ws] ${user.fullName} (@${user.username}) connected (${socket.id})`)

    // Track online status
    const currentCount = onlineUsers.get(user.id) || 0
    onlineUsers.set(user.id, currentCount + 1)

    // Join personal room
    socket.join(`user:${user.id}`)

    // Join role-based rooms
    if (user.roleName === 'ADMIN') socket.join('admins')
    if (['SUPERVISOR', 'MANAGER'].includes(user.roleName)) socket.join('supervisors')

    // Send current online user IDs to the newly connected user
    socket.emit('users:online', Array.from(onlineUsers.keys()))

    // Broadcast online event to all clients
    io.emit('user:online', { userId: user.id, username: user.username })

    // ── Chat events ──────────────────────────────────────────
    socket.on('chat:join', (conversationId: string) => {
      socket.join(`chat:${conversationId}`)
    })

    socket.on('chat:leave', (conversationId: string) => {
      socket.leave(`chat:${conversationId}`)
    })

    socket.on('chat:message', async (data: { conversationId: string; content: string; messageType?: string }) => {
      try {
        const msgType = data.messageType || 'TEXT'
        // Verify membership
        const { rows: member } = await query(
          `SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
          [data.conversationId, user.id]
        )
        if (member.length === 0) return

        // Insert message
        const { rows: [msg] } = await query<{ id: string; created_at: string }>(
          `INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
          [data.conversationId, user.id, data.content, msgType]
        )

        // Update conversation
        await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [data.conversationId])

        const message = {
          id: msg.id,
          senderId: user.id,
          senderName: user.fullName,
          senderUsername: user.username,
          senderPhone: user.phone,
          senderRole: user.roleName,
          content: data.content,
          messageType: msgType,
          isEdited: false,
          isDeleted: false,
          createdAt: msg.created_at,
        }

        // Broadcast to conversation room
        io.to(`chat:${data.conversationId}`).emit('chat:message', {
          conversationId: data.conversationId,
          message,
        })

        // Get conversation members for unread notification
        const { rows: members } = await query<{ user_id: string }>(
          `SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2`,
          [data.conversationId, user.id]
        )

        for (const m of members) {
          io.to(`user:${m.user_id}`).emit('chat:unread', {
            conversationId: data.conversationId,
            senderName: user.fullName,
            senderUsername: user.username,
            preview: data.content.substring(0, 100),
            messageType: msgType,
          })
        }
      } catch (err) {
        console.error('[ws] chat:message error:', err)
      }
    })

    socket.on('chat:typing', (data: { conversationId: string }) => {
      socket.to(`chat:${data.conversationId}`).emit('chat:typing', {
        conversationId: data.conversationId,
        userId: user.id,
        userName: user.fullName,
        username: user.username,
      })
    })

    socket.on('chat:stop-typing', (data: { conversationId: string }) => {
      socket.to(`chat:${data.conversationId}`).emit('chat:stop-typing', {
        conversationId: data.conversationId,
        userId: user.id,
      })
    })

    // ── Calling events (WhatsApp Audio & Video Calls) ─────────
    socket.on('call:initiate', (data: {
      toUserId: string
      conversationId?: string
      callType: 'AUDIO' | 'VIDEO'
    }) => {
      console.log(`[ws] call:initiate from ${user.username} to ${data.toUserId} (${data.callType})`)
      io.to(`user:${data.toUserId}`).emit('call:incoming', {
        callerId: user.id,
        callerName: user.fullName,
        callerUsername: user.username,
        callerPhone: user.phone,
        callerRole: user.roleName,
        conversationId: data.conversationId,
        callType: data.callType,
      })
    })

    socket.on('call:accept', (data: { callerId: string; callType: 'AUDIO' | 'VIDEO' }) => {
      console.log(`[ws] call:accept by ${user.username} to caller ${data.callerId}`)
      io.to(`user:${data.callerId}`).emit('call:accepted', {
        responderId: user.id,
        responderName: user.fullName,
        responderUsername: user.username,
        callType: data.callType,
      })
    })

    socket.on('call:reject', (data: { callerId: string; reason?: string }) => {
      console.log(`[ws] call:reject by ${user.username} for ${data.callerId}`)
      io.to(`user:${data.callerId}`).emit('call:rejected', {
        responderId: user.id,
        reason: data.reason || 'declined',
      })
    })

    socket.on('call:end', (data: { toUserId: string; duration?: number }) => {
      console.log(`[ws] call:end between ${user.username} and ${data.toUserId}`)
      io.to(`user:${data.toUserId}`).emit('call:ended', {
        byUserId: user.id,
        duration: data.duration || 0,
      })
    })

    socket.on('call:signal', (data: { toUserId: string; signal: any }) => {
      io.to(`user:${data.toUserId}`).emit('call:signal', {
        fromUserId: user.id,
        signal: data.signal,
      })
    })

    // ── Continuous Live Tracking events ───────────────────────
    socket.on('tracking:update', async (data: { latitude: number; longitude: number; accuracy?: number; batteryLevel?: number }) => {
      try {
        await query(
          `INSERT INTO location_tracks (user_id, latitude, longitude, accuracy, battery_level) VALUES ($1,$2,$3,$4,$5)`,
          [user.id, data.latitude, data.longitude, data.accuracy ?? null, data.batteryLevel ?? null]
        )

        const trackData = {
          userId: user.id,
          fullName: user.fullName,
          username: user.username,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy ?? null,
          batteryLevel: data.batteryLevel ?? null,
          trackedAt: new Date().toISOString(),
          online: true,
        }

        // Broadcast to admins and supervisors
        io.to('admins').to('supervisors').emit('tracking:update', trackData)
        socket.emit('tracking:confirmed', { trackedAt: trackData.trackedAt })
      } catch (err) {
        console.error('[ws] tracking:update error:', err)
      }
    })

    // ── Notification events ──────────────────────────────────
    socket.on('notification:read', async (notificationId: string) => {
      await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [notificationId, user.id])
      io.to(`user:${user.id}`).emit('notification:count')
    })

    socket.on('disconnect', (reason) => {
      console.log(`[ws] ${user.fullName} disconnected (${reason})`)
      const count = onlineUsers.get(user.id) || 1
      if (count <= 1) {
        onlineUsers.delete(user.id)
        io.emit('user:offline', { userId: user.id, lastSeen: new Date().toISOString() })
      } else {
        onlineUsers.set(user.id, count - 1)
      }
    })
  })

  console.log('[ws] WebSocket server initialized with Chat, WhatsApp Calling & Continuous Tracking')
  return io
}

// Helper to send notifications via WebSocket
export function emitNotification(userId: string, notification: { title: string; message: string; type: string; linkUrl?: string }) {
  if (!io) return
  io.to(`user:${userId}`).emit('notification:new', notification)
}

// Helper to broadcast tracking updates
export function broadcastTracking(data: Record<string, unknown>) {
  if (!io) return
  io.to('admins').to('supervisors').emit('tracking:update', data)
}
