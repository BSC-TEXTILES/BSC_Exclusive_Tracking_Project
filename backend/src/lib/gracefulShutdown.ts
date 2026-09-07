import type { Server as HttpServer } from 'http'
import { closePool } from './dbPool.js'

let httpServer: HttpServer
let isShuttingDown = false

export function registerGracefulShutdown(server: HttpServer) {
  httpServer = server

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true

    console.log(`[shutdown] ${signal} received. Starting graceful shutdown...`)

    server.close(async () => {
      console.log('[shutdown] HTTP server closed')

      await closePool()

      console.log('[shutdown] Cleanup complete. Exiting.')
      process.exit(0)
    })

    const timeout = setTimeout(() => {
      console.error('[shutdown] Forced exit after 30s timeout')
      process.exit(1)
    }, 30_000)

    timeout.unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  process.on('uncaughtException', (err) => {
    console.error('[shutdown] Uncaught exception:', err)
    shutdown('uncaughtException')
  })

  process.on('unhandledRejection', (reason) => {
    console.error('[shutdown] Unhandled rejection:', reason)
  })
}

export function isServerShuttingDown() {
  return isShuttingDown
}
