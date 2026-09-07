import type { Request, Response, NextFunction } from 'express'
import { fail } from '../utils/http.js'

interface RateLimitOptions {
  windowMs: number
  max: number
  message?: string
  keyGenerator?: (req: Request) => string
  skipSuccessfulRequests?: boolean
}

interface SlidingWindowRecord {
  timestamps: number[]
}

const store = new Map<string, SlidingWindowRecord>()

setInterval(() => {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < 120_000)
    if (record.timestamps.length === 0) {
      store.delete(key)
    }
  }
}, 60_000)

function getStoreSize(): number {
  return store.size
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown-ip',
    skipSuccessfulRequests = false,
  } = options

  return (req: Request, res: Response, next: NextFunction) => {
    if (getStoreSize() > 100_000) {
      console.warn('[rate-limit] Store size > 100k, aggressive cleanup')
      const now = Date.now()
      for (const [key, record] of store.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < windowMs)
        if (record.timestamps.length === 0) store.delete(key)
      }
    }

    const key = `${req.baseUrl || ''}:${keyGenerator(req)}`
    const now = Date.now()
    const windowStart = now - windowMs

    let record = store.get(key)
    if (!record) {
      record = { timestamps: [] }
      store.set(key, record)
    }

    record.timestamps = record.timestamps.filter((t) => t > windowStart)

    const count = record.timestamps.length
    const remaining = Math.max(0, max - count)
    const oldestInWindow = record.timestamps[0] || now
    const resetSeconds = Math.ceil((oldestInWindow + windowMs - now) / 1000)

    res.setHeader('RateLimit-Limit', max)
    res.setHeader('RateLimit-Remaining', remaining)
    res.setHeader('RateLimit-Reset', Math.max(0, resetSeconds))

    if (count >= max) {
      res.setHeader('Retry-After', Math.max(0, resetSeconds))
      return fail(res, 429, message, 'RATE_LIMIT_EXCEEDED')
    }

    record.timestamps.push(now)

    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const idx = record.timestamps.indexOf(now)
          if (idx !== -1) record.timestamps.splice(idx, 1)
        }
      })
    }

    next()
  }
}

export const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.API_RATE_LIMIT || '0', 10) || 10000,
  message: 'Too many API requests. Please slow down.',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || ''
    return `${userId || 'ip'}:${req.ip || req.socket.remoteAddress || 'unknown-ip'}`
  },
})

export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.AUTH_RATE_LIMIT || '0', 10) || 5000,
  message: 'Too many authentication attempts. Please try again shortly.',
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const username = req.body?.username ? String(req.body.username).toLowerCase().trim() : ''
    return `${username || 'anon'}:${req.ip || req.socket.remoteAddress || 'unknown-ip'}`
  },
})

export const uploadRateLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.UPLOAD_RATE_LIMIT || '0', 10) || 500,
  message: 'Upload rate limit reached. Please wait before sending more files.',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || ''
    return `${userId || 'ip'}:${req.ip || req.socket.remoteAddress || 'unknown-ip'}`
  },
})

export const loginRateLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT || '0', 10) || 5000,
  message: 'Too many login requests.',
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const username = req.body?.username ? String(req.body.username).toLowerCase().trim() : ''
    return `${username || 'anon'}:${req.ip || req.socket.remoteAddress || 'unknown-ip'}`
  },
})

// ------------------------------------------------------------
// Login Account Lockout (5 attempts, 15 minute lockout)
// ------------------------------------------------------------

interface LoginAttemptRecord {
  failedAttempts: number
  lockoutUntil: number | null
  firstAttemptAt: number
}

const loginAttempts = new Map<string, LoginAttemptRecord>()

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [key, record] of loginAttempts.entries()) {
    if (record.lockoutUntil && now >= record.lockoutUntil) {
      loginAttempts.delete(key)
    }
  }
}, 60_000)

function getLoginKey(username: string, ip: string): string {
  return `${username.toLowerCase().trim()}:${ip}`
}

export function checkLoginLockout(username: string, ip: string): {
  locked: boolean
  remainingSec: number
  attempts: number
} {
  const key = getLoginKey(username, ip)
  const record = loginAttempts.get(key)
  const now = Date.now()

  if (!record) return { locked: false, remainingSec: 0, attempts: 0 }

  if (record.lockoutUntil && now >= record.lockoutUntil) {
    loginAttempts.delete(key)
    return { locked: false, remainingSec: 0, attempts: 0 }
  }

  if (record.lockoutUntil && now < record.lockoutUntil) {
    return { locked: true, remainingSec: Math.ceil((record.lockoutUntil - now) / 1000), attempts: record.failedAttempts }
  }

  return { locked: false, remainingSec: 0, attempts: record.failedAttempts }
}

export function unlockUser(username: string): void {
  const userLower = username.toLowerCase().trim()
  for (const key of loginAttempts.keys()) {
    if (key.startsWith(`${userLower}:`)) {
      loginAttempts.delete(key)
    }
  }
}

export function recordFailedAttempt(
  username: string,
  ip: string
): { locked: boolean; remainingAttempts: number; lockoutSec: number } {
  const key = getLoginKey(username, ip)
  const now = Date.now()
  let record = loginAttempts.get(key)

  if (!record) {
    record = { failedAttempts: 1, lockoutUntil: null, firstAttemptAt: now }
    loginAttempts.set(key, record)
    return { locked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1, lockoutSec: 0 }
  }

  record.failedAttempts += 1

  if (record.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockoutUntil = now + LOCKOUT_DURATION_MS
    return { locked: true, remainingAttempts: 0, lockoutSec: Math.ceil(LOCKOUT_DURATION_MS / 1000) }
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - record.failedAttempts),
    lockoutSec: 0,
  }
}

export function resetFailedAttempts(username: string, ip: string): void {
  loginAttempts.delete(getLoginKey(username, ip))
}
