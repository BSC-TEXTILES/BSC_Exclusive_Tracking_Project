import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { loginSchema } from '@/lib/validations/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const { username, password } = parsed.data

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
      },
      include: { role: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid username or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      )
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, message: 'Your account has been deactivated. Please contact administrator.', code: 'ACCOUNT_INACTIVE' },
        { status: 403 }
      )
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid username or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      )
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create session
    await createSession(user.id, ipAddress, userAgent)

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
    })

    // Determine redirect URL based on role
    const redirectUrl = user.role.name === 'ADMIN' ? '/admin' : '/dashboard'

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role.name,
          mustChangePassword: user.mustChangePassword,
        },
        redirectUrl,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred during login', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
