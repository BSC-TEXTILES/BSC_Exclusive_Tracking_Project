import os from 'node:os'
import { getPoolStats } from './dbPool.js'
import { dbCircuit, externalCircuit } from './circuitBreaker.js'
import { apiQueue } from './requestQueue.js'

const startTime = Date.now()

export function getHealthCheck() {
  const uptime = Math.floor((Date.now() - startTime) / 1000)
  const mem = process.memoryUsage()
  const poolStats = getPoolStats()

  return {
    status: dbCircuit.isOpen() ? 'degraded' : 'ok',
    uptime,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      external: formatBytes(mem.external),
    },
    database: {
      pool: poolStats,
      circuitBreaker: dbCircuit.getStats(),
    },
    queue: apiQueue.getStats(),
    external: {
      circuitBreaker: externalCircuit.getStats(),
    },
    cpu: {
      loadAvg: os.loadavg().map((l: number) => Math.round(l * 100) / 100),
      cpuCount: os.cpus().length,
    },
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
