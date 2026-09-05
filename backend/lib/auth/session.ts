import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import prisma from '@/lib/db/prisma'

const SESSION_COOKIE_NAME = 'session_token'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function createSession(userId: string, ipAddress?: string, userAgent?: string) {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)
  
  // Create JWT token
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey())

  // Store session in database
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    },
  })

  // Set HTTP-only cookie
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
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null

  try {
    // Verify JWT
    await jwtVerify(token, getSecretKey())

    // Verify session exists in database and is not expired
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
            department: true,
          },
        },
      },
    })

    if (!session || session.expiresAt < new Date()) {
      // Session expired, clean up
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
      }
      return null
    }

    if (session.user.status !== 'ACTIVE') {
      return null
    }

    return {
      session,
      user: session.user,
    }
  } catch {
    return null
  }
}

export async function getCurrentUser() {
  const result = await getSession()
  return result?.user ?? null
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {})
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
