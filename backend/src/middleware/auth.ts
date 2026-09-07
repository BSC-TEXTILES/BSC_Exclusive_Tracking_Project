import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { config } from '../config.js'
import { query } from '../db.js'
import { fail } from '../utils/http.js'
import { destroySession, verifyToken } from '../utils/session.js'
import type { AuthUser } from '../types.js'

export async function loadUser(req: Request): Promise<AuthUser | null> {
  const token = (req.cookies as Record<string, string>)[config.cookieName]
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  const { rows } = await query<{
    id: string
    employee_code: string
    full_name: string
    email: string
    phone: string | null
    username: string
    role_id: string
    role_name: string
    department_id: string | null
    department_name: string | null
    profile_image: string | null
    status: string
    session_id: string | null
  }>(
    `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.username,
            u.role_id, r.name AS role_name, u.department_id, d.name AS department_name,
            u.profile_image, u.status, s.id AS session_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN sessions s ON s.token = $1 AND s.expires_at > NOW()
     WHERE u.id = $2`,
    [token, payload.uid]
  )
  if (rows.length === 0 || !rows[0].session_id || rows[0].status !== 'ACTIVE') {
    if (rows.length > 0) await destroySession(token)
    return null
  }

  const user = rows[0]
  const perms = await query<{ name: string }>(
    `SELECT p.name FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = $1`,
    [user.role_id]
  )
  const permissions = perms.rows.map((p) => p.name)
  if (user.role_name === 'ADMIN') {
    const all = await query<{ name: string }>('SELECT name FROM permissions')
    all.rows.forEach((p) => {
      if (!permissions.includes(p.name)) permissions.push(p.name)
    })
  }

  return {
    id: user.id,
    employeeCode: user.employee_code,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    username: user.username,
    roleId: user.role_id,
    roleName: user.role_name,
    departmentId: user.department_id,
    departmentName: user.department_name,
    profileImage: user.profile_image,
    permissions,
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const user = await loadUser(req)
    if (!user) return fail(res, 401, 'Authentication required', 'UNAUTHORIZED')
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

export function requirePermission(permission: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) return fail(res, 401, 'Authentication required', 'UNAUTHORIZED')
    if (user.roleName === 'ADMIN' || user.permissions.includes(permission)) return next()
    return fail(res, 403, 'You do not have permission to perform this action', 'FORBIDDEN')
  }
}

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) return fail(res, 401, 'Authentication required', 'UNAUTHORIZED')
    if (roles.includes(user.roleName)) return next()
    return fail(res, 403, 'You do not have access to this area', 'FORBIDDEN')
  }
}
