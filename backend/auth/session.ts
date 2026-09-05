import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { getSupabaseServerClient } from '@backend/supabase/client'

const SESSION_COOKIE_NAME = 'session_token'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function createSession(userId: string, ipAddress?: string, userAgent?: string) {
  const supabase = getSupabaseServerClient()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)

  const token = await new SignJWT({ userId, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey())

  await supabase.from('sessions').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return token
}

export async function getSession() {
  const supabase = getSupabaseServerClient()
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null

  try {
    await jwtVerify(token, getSecretKey())

    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('token', token)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      if (session) {
        await supabase.from('sessions').delete().eq('id', session.id)
      }
      return null
    }

    const { data: user } = await supabase
      .from('users')
      .select(`
        *,
        role:roles(*),
        department:departments(*)
      `)
      .eq('id', session.user_id)
      .single()

    if (!user || user.status !== 'ACTIVE') {
      return null
    }

    const { data: rolePermissions } = await supabase
      .from('role_permissions')
      .select('permission:permissions(*)')
      .eq('role_id', user.role_id)

    const enrichedUser = {
      ...user,
      fullName: user.full_name,
      employeeCode: user.employee_code,
      departmentId: user.department_id,
      roleId: user.role_id,
      role: {
        ...user.role,
        rolePermissions: rolePermissions || [],
      },
    }

    return { session, user: enrichedUser }
  } catch {
    return null
  }
}

export async function getCurrentUser() {
  const result = await getSession()
  return result?.user ?? null
}

export async function destroySession() {
  const supabase = getSupabaseServerClient()
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await supabase.from('sessions').delete().eq('token', token)
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role.name !== 'ADMIN') {
    throw new Error('FORBIDDEN')
  }
  return user
}
