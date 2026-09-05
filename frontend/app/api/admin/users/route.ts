import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'
import { createAuditLog } from '@/lib/audit'
import { createUserSchema } from '@/lib/validations/schemas'

// GET all users (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const supabase = getSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const roleId = searchParams.get('roleId') || ''
    const departmentId = searchParams.get('departmentId') || ''

    let query = supabase
      .from('users')
      .select('*, role:roles(id, name), department:departments(id, name)', { count: 'exact' })

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,employee_code.ilike.%${search}%,username.ilike.%${search}%`)
    }

    if (status) query = query.eq('status', status)
    if (roleId) query = query.eq('role_id', roleId)
    if (departmentId) query = query.eq('department_id', departmentId)

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    const total = count || 0

    return NextResponse.json({
      success: true,
      data: {
        users: (users || []).map(u => ({
          id: u.id,
          employeeCode: u.employee_code,
          fullName: u.full_name,
          email: u.email,
          phone: u.phone,
          username: u.username,
          role: u.role?.name,
          roleId: u.role_id,
          department: u.department?.name ?? null,
          departmentId: u.department_id,
          status: u.status,
          lastLoginAt: u.last_login_at,
          createdAt: u.created_at,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin users GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

// CREATE user (admin only)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const supabase = getSupabaseServerClient()
    const body = await request.json()

    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check for duplicate email/username/employeeCode
    const { data: existing } = await supabase
      .from('users')
      .select('id, email, username, employee_code')
      .or(`email.eq.${data.email},username.eq.${data.username},employee_code.eq.${data.employeeCode}`)
      .limit(1)
      .single()

    if (existing) {
      let field = 'Email'
      if (existing.username === data.username) field = 'Username'
      if (existing.employee_code === data.employeeCode) field = 'Employee code'
      return NextResponse.json(
        { success: false, message: `${field} already exists` },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(data.password)

    const { data: user, error: createError } = await supabase
      .from('users')
      .insert({
        employee_code: data.employeeCode,
        full_name: data.fullName,
        username: data.username,
        email: data.email,
        phone: data.phone || null,
        password_hash: hashedPassword,
        role_id: data.roleId,
        department_id: data.departmentId || null,
        status: data.status,
        must_change_password: data.mustChangePassword,
        created_by: admin.id,
      })
      .select('*, role:roles(id, name), department:departments(id, name)')
      .single()

    if (createError) throw createError

    // Assign to location if provided
    if (data.locationId) {
      const { error: locError } = await supabase
        .from('user_locations')
        .insert({ user_id: user.id, location_id: data.locationId })
      if (locError) throw locError
    }

    await createAuditLog({
      userId: admin.id,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      newValues: {
        employeeCode: user.employee_code,
        fullName: user.full_name,
        email: user.email,
        role: user.role?.name,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        employeeCode: user.employee_code,
        fullName: user.full_name,
        email: user.email,
        role: user.role?.name,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin users POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to create user' }, { status: 500 })
  }
}
