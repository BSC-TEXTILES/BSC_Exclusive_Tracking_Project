import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { loginSchema } from '@/lib/validations/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const { username, password } = parsed.data
    const trimmedUsername = username.trim()

    const supabase = getSupabaseServerClient()

    // Find user by username or email
    const { data: users, error: queryError } = await supabase
      .from('users')
      .select('*, role:roles(*)')
      .or(`username.eq.${trimmedUsername},email.eq.${trimmedUsername}`)
      .limit(1)

    if (queryError) {
      console.error('Supabase query error:', queryError)
      return NextResponse.json(
        { success: false, message: 'Database connection error. Please check your configuration.', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    const user = users?.[0] ?? null

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid username or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      )
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, message: 'Your account has been deactivated. Please contact administrator.', code: 'ACCOUNT_INACTIVE' },
        { status: 403 }
      )
    }

    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid username or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      )
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    await createSession(user.id, ipAddress, userAgent)

    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    await createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
    })

    let redirectUrl = '/dashboard'
    if (user.must_change_password) {
      redirectUrl = '/profile?changePassword=true'
    } else if (user.role.name === 'ADMIN') {
      redirectUrl = '/admin'
    } else if (user.role.name === 'SUPERVISOR' || user.role.name === 'MANAGER') {
      redirectUrl = '/supervisor'
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role.name,
          mustChangePassword: user.must_change_password,
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
