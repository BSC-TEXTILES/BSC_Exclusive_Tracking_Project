import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { hashPassword } from '@/lib/auth/password'
import { safeJson } from '@/lib/utils/parse'

// GET single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const supabase = getSupabaseServerClient()

    const { data: user, error } = await supabase
      .from('users')
      .select('*, role:roles(id, name), department:departments(id, name), user_locations(id, location:locations(id, name))')
      .eq('id', id)
      .single()

    if (error || !user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        employeeCode: user.employee_code,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role?.name,
        roleId: user.role_id,
        department: user.department?.name ?? null,
        departmentId: user.department_id,
        status: user.status,
        mustChangePassword: user.must_change_password,
        locations: (user.user_locations || []).map((ul: any) => ({
          id: ul.location?.id,
          name: ul.location?.name,
        })),
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

// UPDATE user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const supabase = getSupabaseServerClient()
    const body = (await safeJson(request)) as Record<string, any> | null
    if (body === null) {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*, role:roles(id, name)')
      .eq('id', id)
      .single()

    if (fetchError || !existingUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.fullName !== undefined) updateData.full_name = body.fullName
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone || null
    if (body.departmentId !== undefined) updateData.department_id = body.departmentId || null
    if (body.roleId !== undefined) updateData.role_id = body.roleId
    if (body.status !== undefined) updateData.status = body.status
    if (body.username !== undefined && body.username !== existingUser.username) {
      const { data: usernameTaken } = await supabase
        .from('users')
        .select('id')
        .eq('username', body.username)
        .neq('id', id)
        .limit(1)
        .single()
      if (usernameTaken) {
        return NextResponse.json({ success: false, message: 'Username already taken' }, { status: 409 })
      }
      updateData.username = body.username
    }
    if (body.employeeCode !== undefined && body.employeeCode !== existingUser.employee_code) {
      const { data: codeTaken } = await supabase
        .from('users')
        .select('id')
        .eq('employee_code', body.employeeCode)
        .neq('id', id)
        .limit(1)
        .single()
      if (codeTaken) {
        return NextResponse.json({ success: false, message: 'Employee code already taken' }, { status: 409 })
      }
      updateData.employee_code = body.employeeCode
    }
    if (body.password && body.password.trim()) {
      updateData.password_hash = await hashPassword(body.password)
    }
    updateData.updated_by = admin.id

    const { data: user, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('*, role:roles(id, name), department:departments(id, name)')
      .single()

    if (updateError) throw updateError

    await createAuditLog({
      userId: admin.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      oldValues: { fullName: existingUser.full_name, email: existingUser.email, role: existingUser.role?.name },
      newValues: { fullName: user.full_name, email: user.email, role: user.role?.name },
    })

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      data: { id: user.id, fullName: user.full_name },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 })
  }
}
