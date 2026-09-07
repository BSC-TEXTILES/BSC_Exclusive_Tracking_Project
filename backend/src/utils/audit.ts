import type { Request } from 'express'
import { query } from '../db.js'

export async function logAudit(input: {
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  oldValues?: unknown
  newValues?: unknown
  req?: Request
}) {
  try {
    let clientIp: string | null = null
    let userAgent: string | null = null
    let deviceInfo: string | null = null
    let deviceType: string | null = null

    if (input.req) {
      const { getClientIp, parseDevice } = await import('./deviceInfo.js')
      clientIp = getClientIp(input.req)
      userAgent = (input.req.headers['user-agent'] || null) as string | null
      const parsedDev = parseDevice(userAgent)
      deviceInfo = parsedDev.formatted
      deviceType = parsedDev.deviceType
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, device_info, device_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        input.userId || null,
        input.action,
        input.entityType,
        input.entityId || null,
        input.oldValues ? JSON.stringify(input.oldValues) : null,
        input.newValues ? JSON.stringify(input.newValues) : null,
        clientIp,
        userAgent,
        deviceInfo,
        deviceType,
      ]
    )
  } catch (err) {
    console.error('[audit] write failed:', (err as Error).message)
  }
}
