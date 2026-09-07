import express from 'express'
import cors from 'cors'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import fs from 'node:fs'
import { config } from './config.js'
import authRoutes from './routes/auth.routes.js'
import publicRoutes from './routes/public.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import modulesRoutes from './routes/modules.routes.js'
import checkpointsRoutes from './routes/checkpoints.routes.js'
import submissionsRoutes from './routes/submissions.routes.js'
import evidenceRoutes from './routes/evidence.routes.js'
import calendarRoutes from './routes/calendar.routes.js'
import reportsRoutes from './routes/reports.routes.js'
import profileRoutes from './routes/profile.routes.js'
import notificationsRoutes from './routes/notifications.routes.js'
import trackingRoutes from './routes/tracking.routes.js'
import adminRoutes from './routes/admin.routes.js'
import supervisorRoutes from './routes/supervisor.routes.js'
import chatRoutes from './routes/chat.routes.js'
import searchRoutes from './routes/search.routes.js'
import whatsappRoutes from './routes/whatsapp.routes.js'
import { ping } from './db.js'
import { apiRateLimiter } from './middleware/rateLimit.js'
import { getHealthCheck } from './lib/healthCheck.js'
import { dbCircuit } from './lib/circuitBreaker.js'
import { apiQueue } from './lib/requestQueue.js'
import { isServerShuttingDown } from './lib/gracefulShutdown.js'

fs.mkdirSync(config.uploadDir, { recursive: true })

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false
      return compression.filter(req, res)
    },
  }))

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true)
        return cb(null, false)
      },
      credentials: true,
      maxAge: 86400,
    })
  )

  // ── Security Headers (Anti-tamper, Anti-clickjacking, Anti-sniff) ──────
  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=()')
    next()
  })

  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())

  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      maxAge: '365d',
      immutable: true,
      index: false,
    })
  )

  // ── Pre-flight shutdown check ──────────────────────────────
  app.use((_req, res, next) => {
    if (isServerShuttingDown()) {
      res.setHeader('Connection', 'close')
      return res.status(503).json({
        success: false,
        message: 'Server is shutting down. Please retry.',
        code: 'SERVER_SHUTTING_DOWN',
      })
    }
    next()
  })

  // ── Request queue backpressure ─────────────────────────────
  app.use('/api', async (_req, res, next) => {
    try {
      await apiQueue.acquire()
      res.on('finish', () => apiQueue.release())
      res.on('close', () => apiQueue.release())
      next()
    } catch (err: any) {
      if (err.message === 'SERVER_OVERLOADED') {
        return res.status(503).json({
          success: false,
          message: 'Server is temporarily overloaded. Please retry in a few seconds.',
          code: 'SERVER_OVERLOADED',
          retryAfter: 5,
        })
      }
      if (err.message === 'QUEUE_TIMEOUT') {
        return res.status(504).json({
          success: false,
          message: 'Request timed out waiting for server capacity.',
          code: 'QUEUE_TIMEOUT',
        })
      }
      next(err)
    }
  })

  // ── Health endpoints ───────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    const dbOk = await ping()
    const health = getHealthCheck()
    health.status = dbOk ? 'ok' : 'degraded'
    health.database.circuitBreaker = dbCircuit.getStats()
    const statusCode = health.status === 'ok' ? 200 : 503
    res.status(statusCode).json(health)
  })

  app.get('/api/health/ready', async (_req, res) => {
    const dbOk = await ping()
    const queueStats = apiQueue.getStats()
    const ready = dbOk && !dbCircuit.isOpen() && queueStats.queued < queueStats.maxQueue * 0.8
    res.status(ready ? 200 : 503).json({
      ready,
      database: dbOk,
      circuitBreaker: dbCircuit.isOpen() ? 'open' : 'closed',
      queue: queueStats,
    })
  })

  app.get('/api/health/live', (_req, res) => {
    res.json({ alive: true, uptime: process.uptime(), pid: process.pid })
  })

  // ── Global rate limiter ────────────────────────────────────
  app.use('/api', apiRateLimiter)

  // ── Routes ─────────────────────────────────────────────────
  app.use('/api/auth', authRoutes)
  app.use('/api/public', publicRoutes)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/modules', modulesRoutes)
  app.use('/api/checkpoints', checkpointsRoutes)
  app.use('/api/submissions', submissionsRoutes)
  app.use('/api/evidence', evidenceRoutes)
  app.use('/api/calendar', calendarRoutes)
  app.use('/api/reports', reportsRoutes)
  app.use('/api/profile', profileRoutes)
  app.use('/api/notifications', notificationsRoutes)
  app.use('/api/tracking', trackingRoutes)
  app.use('/api/supervisor', supervisorRoutes)
  app.use('/api/chat', chatRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/search', searchRoutes)
  app.use('/api/whatsapp', whatsappRoutes)

  // 404
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' })
  })

  // Central error handler
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('[api] error:', err.message)
      if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ success: false, message: 'Invalid JSON body' })
      }
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  )

  return app
}
