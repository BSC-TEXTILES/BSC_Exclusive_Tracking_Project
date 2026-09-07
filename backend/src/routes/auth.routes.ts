import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, fail, ok } from '../utils/http.js'
import { clearCookie, createSession, destroySession } from '../utils/session.js'
import { logAudit } from '../utils/audit.js'
import { config } from '../config.js'
import {
  authRateLimiter,
  checkLoginLockout,
  recordFailedAttempt,
  resetFailedAttempts,
} from '../middleware/rateLimit.js'

const router = Router()

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  clientHint: z
    .object({
      platform: z.string().optional(),
      isMobile: z.boolean().optional(),
      screen: z.string().optional(),
    })
    .optional(),
})

// POST /api/auth/login
router.post(
  '/login',
  authRateLimiter,
  ah(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Username and password are required')

    const { username, password } = parsed.data
    const { getClientIp, parseDevice } = await import('../utils/deviceInfo.js')
    const clientIp = getClientIp(req)

    // 1. Check if account or IP is locked out
    const lockout = checkLoginLockout(username, clientIp)
    if (lockout.locked) {
      const min = Math.floor(lockout.remainingSec / 60)
      const sec = lockout.remainingSec % 60
      const timeStr = min > 0 ? `${min}m ${sec}s` : `${sec}s`
      return fail(
        res,
        429,
        `Too many failed login attempts (5/5). Account temporarily locked for 15 minutes. Try again in ${timeStr} or contact your system administrator.`,
        'ACCOUNT_LOCKED'
      )
    }

    const { rows } = await query<{
      id: string
      password_hash: string
      status: string
      role_name: string
      banned_until: string | null
      restriction_reason: string | null
    }>(
      `SELECT u.id, u.password_hash, u.status, u.banned_until, u.restriction_reason, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1)`,
      [username]
    )
    const user = rows[0]

    if (!user) {
      const attempt = recordFailedAttempt(username, clientIp)
      if (attempt.locked) {
        return fail(
          res,
          429,
          'Too many failed login attempts (5/5). Account temporarily locked for 15 minutes. Please contact your administrator if you need immediate assistance.',
          'ACCOUNT_LOCKED'
        )
      }
      return fail(
        res,
        401,
        `Invalid username or password. ${attempt.remainingAttempts} attempt(s) remaining before a 15-minute lockout.`,
        'INVALID_CREDENTIALS'
      )
    }

    // Auto-reopen if time-based restriction expired
    if (user.banned_until) {
      const banEnd = new Date(user.banned_until).getTime()
      if (banEnd <= Date.now()) {
        await query(
          `UPDATE users SET status = 'ACTIVE', banned_until = NULL, restriction_reason = NULL, updated_at = NOW() WHERE id = $1`,
          [user.id]
        )
        user.status = 'ACTIVE'
        user.banned_until = null
      } else {
        const dateStr = new Date(user.banned_until).toLocaleString()
        const reasonStr = user.restriction_reason ? ` Reason: ${user.restriction_reason}.` : ''
        return fail(
          res,
          403,
          `Your account has been restricted until ${dateStr}.${reasonStr} Contact your administrator for assistance.`,
          'ACCOUNT_RESTRICTED'
        )
      }
    }

    if (user.status !== 'ACTIVE') {
      return fail(res, 403, 'Your account is not active. Contact your administrator.', 'ACCOUNT_INACTIVE')
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      const attempt = recordFailedAttempt(username, clientIp)
      if (attempt.locked) {
        return fail(
          res,
          429,
          'Too many failed login attempts (5/5). Account temporarily locked for 15 minutes. Please contact your administrator.',
          'ACCOUNT_LOCKED'
        )
      }
      return fail(
        res,
        401,
        `Invalid username or password. ${attempt.remainingAttempts} attempt(s) remaining before a 15-minute lockout.`,
        'INVALID_CREDENTIALS'
      )
    }

    // Reset failed attempts on successful login
    resetFailedAttempts(username, clientIp)

    const userAgent = (req.headers['user-agent'] || null) as string | null
    const dev = parseDevice(userAgent, parsed.data.clientHint)

    await createSession(user.id, req, res)
    await query(
      `UPDATE users
       SET last_login_at = NOW(),
           last_login_ip = $2,
           last_login_device = $3,
           last_login_device_type = $4
       WHERE id = $1`,
      [user.id, clientIp, dev.formatted, dev.deviceType]
    )
    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      newValues: { ip: clientIp, device: dev.formatted, deviceType: dev.deviceType },
      req,
    })

    return ok(res, {
      redirectUrl:
        user.role_name === 'ADMIN'
          ? '/admin'
          : ['SUPERVISOR', 'MANAGER'].includes(user.role_name)
            ? '/supervisor'
            : '/dashboard',
    })
  })
)

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => ok(res, { user: req.user }))

// POST /api/auth/logout
router.post(
  '/logout',
  ah(async (req, res) => {
    const token = (req.cookies as Record<string, string>)[config.cookieName]
    if (token) {
      const user = await import('../middleware/auth.js').then((m) => m.loadUser(req))
      await destroySession(token)
      if (user) {
        await logAudit({ userId: user.id, action: 'LOGOUT', entityType: 'user', entityId: user.id, req })
      }
    }
    clearCookie(res)
    return ok(res, { loggedOut: true })
  })
)

export default router
