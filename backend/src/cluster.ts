import cluster from 'node:cluster'
import os from 'node:os'
import process from 'node:process'

const isProduction = process.env.NODE_ENV === 'production'
const NUM_WORKERS = parseInt(process.env.WEB_CONCURRENCY || '0', 10) || Math.max(1, os.cpus().length)
const isClusterEnabled = isProduction && process.platform !== 'win32'

export function shouldUseCluster(): boolean {
  return isClusterEnabled && cluster.isPrimary
}

export function isWorker(): boolean {
  return isClusterEnabled && cluster.isWorker
}

export function forkWorkers() {
  if (!cluster.isPrimary || !isClusterEnabled) return

  console.log(`[cluster] Primary ${process.pid} starting ${NUM_WORKERS} workers (CPUs: ${os.cpus().length})`)

  const workers: Map<number, { pid: number; restarts: number; lastStart: number }> = new Map()
  const MAX_RESTARTS = 10
  const RESTART_WINDOW_MS = 60_000

  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = cluster.fork()
    workers.set(worker.id, { pid: worker.process.pid!, restarts: 0, lastStart: Date.now() })
  }

  cluster.on('exit', (worker, code, signal) => {
    const info = workers.get(worker.id)
    const pid = info?.pid || worker.process.pid

    if (info) {
      const now = Date.now()
      if (now - info.lastStart > RESTART_WINDOW_MS) {
        info.restarts = 0
      }
      info.restarts++
      info.lastStart = now

      if (info.restarts > MAX_RESTARTS) {
        console.error(`[cluster] Worker ${pid} exceeded ${MAX_RESTARTS} restarts in ${RESTART_WINDOW_MS / 1000}s. Not restarting.`)
        workers.delete(worker.id)
        return
      }
    }

    console.error(`[cluster] Worker ${pid} died (code: ${code}, signal: ${signal}). Restarting...`)
    const newWorker = cluster.fork()
    workers.set(newWorker.id, { pid: newWorker.process.pid!, restarts: info?.restarts || 1, lastStart: Date.now() })
  })

  process.on('SIGTERM', () => {
    console.log('[cluster] SIGTERM received. Shutting down workers gracefully...')
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill('SIGTERM')
    }
  })

  process.on('SIGINT', () => {
    console.log('[cluster] SIGINT received. Shutting down workers...')
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill('SIGINT')
    }
  })
}

export function getWorkerCount(): number {
  return isClusterEnabled ? NUM_WORKERS : 1
}
