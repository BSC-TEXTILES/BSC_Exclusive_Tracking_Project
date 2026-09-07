import type { Request, Response } from 'express'
import { randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { config } from '../config.js'
import { query } from '../db.js'

const isProduction = process.env.NODE_ENV === 'production'

const secret = new TextEncoder().encode(config.sessionSecret)

export async function createSession(
  userId: string,
  req: Request,
  res: Response
): Promise<void> {
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 3600 * 1000)
  // Include a unique nonce so two sessions created in the same second
  // do not collide on the sessions.token unique index.
  const nonce = randomBytes(16).toString('hex')
  const token = await new SignJWT({ uid: userId, jti: nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .setJti(nonce)
    .sign(secret)

  const { getClientIp, parseDevice } = await import('./deviceInfo.js')
  const clientIp = getClientIp(req)
  const userAgent = (req.headers['user-agent'] || null) as string | null
  const dev = parseDevice(userAgent)

  await query(
    `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent, device_info, device_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, token, expiresAt, clientIp, userAgent, dev.formatted, dev.deviceType]
  )

  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
    maxAge: config.sessionTtlDays * 24 * 3600 * 1000,
  })
}

export async function destroySession(token: string): Promise<void> {
  try {
    await query('DELETE FROM sessions WHERE token = $1', [token])
  } catch (err) {
    console.error('[session] destroy failed:', (err as Error).message)
  }
}

export function clearCookie(res: Response): void {
  res.clearCookie(config.cookieName, {
    path: '/',
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
  })
}

export async function verifyToken(token: string): Promise<{ uid: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    if (typeof payload.uid === 'string') return { uid: payload.uid }
    return null
  } catch {
    return null
  }
}
