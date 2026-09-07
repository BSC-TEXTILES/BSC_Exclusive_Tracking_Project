import { createApp } from './app.js'
import { config } from './config.js'
import { pingWithRetry } from './db.js'
import { startAutoApprovalJob } from './jobs/autoApproval.js'
import { initWebSocket } from './websocket.js'
import { registerGracefulShutdown } from './lib/gracefulShutdown.js'
import { shouldUseCluster, forkWorkers } from './cluster.js'

if (shouldUseCluster()) {
  forkWorkers()
} else {
  startServer()
}

async function startServer() {
  const workerLabel = process.env.NODE_ENV === 'production' ? `Worker ${process.pid}` : 'Server'
  console.log(`[server] ${workerLabel} starting...`)
  console.log(`[server] NODE_ENV=${process.env.NODE_ENV || 'development'}`)
  console.log(`[server] DATABASE_URL is ${config.databaseUrl ? 'set' : 'NOT SET'}`)

  const app = createApp()
  const server = app.listen(config.port, () => {
    console.log(`[server] ${workerLabel} listening on port ${config.port}`)
    console.log(`[server] Evidence storage: ${config.fileStorageType}${config.fileStorageType === 'local' ? ` (${config.uploadDir})` : ` (Supabase bucket "${config.supabaseBucket}")`}`)
    console.log(`[server] DB SSL: ${config.dbSsl ? 'enabled' : 'disabled'}`)
  })

  registerGracefulShutdown(server)
  initWebSocket(server)

  console.log(`[server] ${workerLabel} verifying database connectivity...`)
  const dbOk = await pingWithRetry(5, 3000)
  if (!dbOk) {
    console.error(`[server] ${workerLabel} FATAL: Could not connect to the database after 5 attempts.`)
    console.error('[server] Check that DATABASE_URL is set correctly in your Render environment.')
    server.close(() => process.exit(1))
    return
  }
  console.log(`[server] ${workerLabel} database connection OK`)
  await import('./utils/deviceInfo.js').then((m) => m.ensureDeviceTrackingSchema()).catch((e) => console.error('[server] schema check error:', e))

  startAutoApprovalJob()
  console.log(`[server] ${workerLabel} auto-approval job started (window: ${config.autoApproveHours}h, checked every minute)`)
}
