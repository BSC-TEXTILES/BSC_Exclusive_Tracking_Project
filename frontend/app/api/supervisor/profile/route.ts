import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseServerClient()

    let deptUserIds: string[] | null = null
    if (user.departmentId) {
      const { data: deptUsers } = await supabase
        .from('users')
        .select('id')
        .eq('department_id', user.departmentId)
      deptUserIds = deptUsers?.map((u: any) => u.id) || []
    }

    const hasDeptFilter = deptUserIds !== null

    const [
      totalEmployeesRes,
      activeEmployeesRes,
      pendingApprovalsRes,
      approvedCountRes,
      rejectedCountRes,
      totalSubmissionsRes,
    ] = await Promise.all([
      hasDeptFilter
        ? supabase.from('users').select('*', { count: 'exact', head: true }).in('id', deptUserIds!)
        : supabase.from('users').select('*', { count: 'exact', head: true }),
      hasDeptFilter
        ? supabase.from('users').select('*', { count: 'exact', head: true }).in('id', deptUserIds!).eq('status', 'ACTIVE')
        : supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      hasDeptFilter
        ? supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED').in('user_id', deptUserIds!)
        : supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
      supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED').eq('reviewed_by', user.id),
      supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED').eq('reviewed_by', user.id),
      hasDeptFilter
        ? supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).in('user_id', deptUserIds!)
        : supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }),
    ])

    const totalEmployees = totalEmployeesRes.count || 0
    const activeEmployees = activeEmployeesRes.count || 0
    const pendingApprovals = pendingApprovalsRes.count || 0
    const approvedCount = approvedCountRes.count || 0
    const rejectedCount = rejectedCountRes.count || 0
    const totalSubmissions = totalSubmissionsRes.count || 0

    const names = user.fullName.trim().split(/\s+/)
    const initials =
      names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : (names[0]?.substring(0, 2) || 'U').toUpperCase()

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          employeeCode: user.employeeCode,
          fullName: user.fullName,
          firstName: names[0] || user.fullName,
          initials,
          email: user.email,
          phone: user.phone,
          role: user.role.name,
          department: user.department?.name ?? null,
          departmentId: user.departmentId,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
        stats: {
          totalEmployees,
          activeEmployees,
          pendingApprovals,
          approvedCount,
          rejectedCount,
          totalSubmissions,
          approvalRate:
            approvedCount + rejectedCount > 0
              ? Math.round(
                  (approvedCount / (approvedCount + rejectedCount)) * 100
                )
              : 0,
        },
      },
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }
    console.error('Supervisor profile GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseServerClient()
    const body = await request.json()
    const { fullName, phone } = body as { fullName?: string; phone?: string }

    const updateData: Record<string, unknown> = {}
    if (fullName) updateData.full_name = fullName
    if (phone !== undefined) updateData.phone = phone || null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No fields to update' },
        { status: 400 }
      )
    }

    const oldValues: Record<string, unknown> = {}
    if (fullName) oldValues.fullName = user.fullName
    if (phone !== undefined) oldValues.phone = user.phone

    const { data: updatedUser } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select('*, role:roles(*), department:departments(*)')
      .single()

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: 'Failed to update profile' },
        { status: 500 }
      )
    }

    await createAuditLog({
      userId: user.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: user.id,
      oldValues,
      newValues: updateData,
    })

    const names = updatedUser.full_name.trim().split(/\s+/)
    const initials =
      names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : (names[0]?.substring(0, 2) || 'U').toUpperCase()

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        employeeCode: updatedUser.employee_code,
        fullName: updatedUser.full_name,
        firstName: names[0] || updatedUser.full_name,
        initials,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role?.name,
        department: updatedUser.department?.name ?? null,
      },
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }
    console.error('Supervisor profile PUT error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
