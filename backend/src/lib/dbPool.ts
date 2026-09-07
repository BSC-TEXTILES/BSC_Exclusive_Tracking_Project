import pg from 'pg'
import { config } from '../config.js'
import { dbCircuit } from './circuitBreaker.js'

const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '0', 10) || 50
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '0', 10) || 5
const ACQUIRE_TIMEOUT = parseInt(process.env.DB_ACQUIRE_TIMEOUT || '0', 10) || 10_000
const STATEMENT_TIMEOUT = parseInt(process.env.DB_STATEMENT_TIMEOUT || '0', 10) || 30_000
const IDLE_TIMEOUT = parseInt(process.env.DB_IDLE_TIMEOUT || '0', 10) || 10_000

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: POOL_MAX,
  min: POOL_MIN,
  idleTimeoutMillis: IDLE_TIMEOUT,
  connectionTimeoutMillis: ACQUIRE_TIMEOUT,
  statement_timeout: STATEMENT_TIMEOUT,
  application_name: 'bsc_exclusive_api',
  ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
})

let totalQueries = 0
let failedQueries = 0
let totalQueryTime = 0

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
  dbCircuit.recordFailure()
})

pool.on('connect', () => {
  console.log('[db] New client connected to pool')
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  if (dbCircuit.isOpen()) {
    throw new Error('Database circuit breaker is OPEN — service temporarily unavailable')
  }

  const start = Date.now()
  try {
    const result = await pool.query<T>(text, params as never[])
    const elapsed = Date.now() - start
    totalQueries++
    totalQueryTime += elapsed
    dbCircuit.recordSuccess()

    if (elapsed > 5000) {
      console.warn(`[db] Slow query (${elapsed}ms): ${text.substring(0, 100)}`)
    }

    return result
  } catch (err) {
    failedQueries++
    dbCircuit.recordFailure()
    throw err
  }
}

export async function ping(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    return true
  } catch (err: any) {
    console.error('[db] Health ping failed:', err?.message || err)
    dbCircuit.recordFailure()
    return false
  }
}

export async function pingWithRetry(retries = 5, delayMs = 3000): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1')
      return true
    } catch (err: any) {
      console.error(`[db] Connection attempt ${attempt}/${retries} failed:`, err?.message || err)
      if (attempt < retries) {
        console.log(`[db] Retrying in ${delayMs / 1000}s...`)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }
  return false
}

export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: POOL_MAX,
    min: POOL_MIN,
    totalQueries,
    failedQueries,
    avgQueryTime: totalQueries > 0 ? Math.round(totalQueryTime / totalQueries) : 0,
    circuitBreaker: dbCircuit.getStats(),
  }
}

export async function closePool() {
  try {
    await pool.end()
    console.log('[db] Pool closed gracefully')
  } catch (err) {
    console.error('[db] Error closing pool:', err)
  }
}
