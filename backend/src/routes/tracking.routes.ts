import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { query } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { ah, fail, ok } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

const trackSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  batteryLevel: z.number().min(0).max(100).optional().nullable(),
})

// POST /api/tracking — client reports live location continuously
router.post(
  '/',
  ah(async (req, res) => {
    const user = req.user!
    const parsed = trackSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid location data')

    const t = parsed.data
    const { getClientIp, parseDevice } = await import('../utils/deviceInfo.js')
    const clientIp = getClientIp(req)
    const userAgent = (req.headers['user-agent'] || null) as string | null
    const dev = parseDevice(userAgent)

    const { rows } = await query<{ id: string; tracked_at: string }>(
      `INSERT INTO location_tracks (user_id, latitude, longitude, accuracy, address, battery_level, ip_address, device_info, device_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, tracked_at`,
      [user.id, t.latitude, t.longitude, t.accuracy ?? null, t.address ?? null, t.batteryLevel ?? null, clientIp, dev.formatted, dev.deviceType]
    )
    ok(res, { trackId: rows[0].id, trackedAt: rows[0].tracked_at })
  })
)

// GET /api/tracking/me — my recent tracks
router.get(
  '/me',
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT id, latitude, longitude, accuracy, address, battery_level, tracked_at
       FROM location_tracks WHERE user_id = $1 ORDER BY tracked_at DESC LIMIT 50`,
      [req.user!.id]
    )
    ok(res, {
      items: rows.map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        accuracy: r.accuracy,
        address: r.address,
        batteryLevel: r.battery_level,
        trackedAt: r.tracked_at,
      })),
    })
  })
)

// GET /api/tracking/latest — live overview of all users (admins/supervisors/managers)
router.get(
  '/latest',
  requirePermission('tracking:view_all'),
  ah(async (_req, res) => {
    const { rows } = await query<{
      user_id: string
      full_name: string
      employee_code: string
      role_name: string
      department_name: string | null
      profile_image: string | null
      latitude: number
      longitude: number
      accuracy: number | null
      address: string | null
      battery_level: number | null
      tracked_at: string
      online: boolean
      ip_address: string | null
      device_info: string | null
      device_type: string | null
    }>(
      `SELECT DISTINCT ON (u.id)
              u.id AS user_id, u.full_name, u.employee_code, r.name AS role_name,
              d.name AS department_name, u.profile_image,
              lt.latitude, lt.longitude, lt.accuracy, lt.address, lt.battery_level, lt.tracked_at,
              COALESCE(lt.ip_address, u.last_login_ip) AS ip_address,
              COALESCE(lt.device_info, u.last_login_device) AS device_info,
              COALESCE(lt.device_type, u.last_login_device_type, 'Desktop') AS device_type,
              (lt.tracked_at >= NOW() - ($1 * INTERVAL '1 minute')) AS online
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN location_tracks lt ON lt.user_id = u.id
       WHERE u.status = 'ACTIVE' AND r.name <> 'ADMIN'
       ORDER BY u.id, lt.tracked_at DESC NULLS LAST`,
      [config.onlineWindowMinutes]
    )
    const { rows: offices } = await query<{
      id: string
      name: string
      code: string
      address: string | null
      latitude: number | null
      longitude: number | null
    }>(`SELECT id, name, code, address, latitude, longitude FROM locations WHERE status = 'ACTIVE'`)
    ok(res, {
      users: rows.map((r) => ({
        userId: r.user_id,
        fullName: r.full_name,
        employeeCode: r.employee_code,
        roleName: r.role_name,
        departmentName: r.department_name,
        profileImage: r.profile_image,
        latitude: r.latitude,
        longitude: r.longitude,
        accuracy: r.accuracy,
        address: r.address,
        batteryLevel: r.battery_level,
        trackedAt: r.tracked_at,
        online: r.online,
        ipAddress: r.ip_address,
        deviceInfo: r.device_info,
        deviceType: r.device_type,
      })),
      offices,
    })
  })
)

// GET /api/tracking/history?userId= — track history for one user
router.get(
  '/history',
  requirePermission('tracking:view_all'),
  ah(async (req, res) => {
    const userId = req.query.userId as string
    if (!userId) return fail(res, 400, 'userId is required')
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '200', 10) || 200, 1), 500)
    const { rows } = await query(
      `SELECT id, latitude, longitude, accuracy, address, battery_level, tracked_at
       FROM location_tracks WHERE user_id = $1 ORDER BY tracked_at DESC LIMIT $2`,
      [userId, limit]
    )
    ok(res, {
      items: rows.map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        accuracy: r.accuracy,
        address: r.address,
        batteryLevel: r.battery_level,
        trackedAt: r.tracked_at,
      })),
    })
  })
)

// GET /api/tracking/my-admittance-code — employee's own admittance code
router.get(
  '/my-admittance-code',
  requirePermission('tracking:update'),
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT ac.admittance_code, ac.is_active, l.name AS location_name, l.code AS location_code, l.address AS location_address
       FROM admittance_codes ac
       LEFT JOIN locations l ON l.id = ac.location_id
       WHERE ac.user_id = $1 AND ac.is_active = TRUE
       ORDER BY ac.created_at DESC LIMIT 1`,
      [req.user!.id]
    )
    ok(res, { code: rows[0] || null })
  })
)

export default router
