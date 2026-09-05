import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const departmentId = searchParams.get('departmentId') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('users')
      .select('*, role:roles(*), department:departments(*)', { count: 'exact' })

    if (user.departmentId) {
      query = query.eq('department_id', user.departmentId)
    } else if (departmentId) {
      query = query.eq('department_id', departmentId)
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,employee_code.ilike.%${search}%`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: employees, count: total, error } = await query
      .order('full_name', { ascending: true })
      .range(from, to)

    if (error) {
      console.error('Supervisor employees GET error:', error)
      return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        employees: (employees || []).map((e: any) => ({
          id: e.id,
          employeeCode: e.employee_code,
          fullName: e.full_name,
          email: e.email,
          phone: e.phone,
          role: e.role?.name,
          roleId: e.role_id,
          department: e.department?.name ?? null,
          departmentId: e.department_id,
          status: e.status,
          lastLoginAt: e.last_login_at,
          createdAt: e.created_at,
        })),
        pagination: {
          page,
          limit,
          total: total || 0,
          totalPages: Math.ceil((total || 0) / limit),
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
    console.error('Supervisor employees GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supervisor = await requireAuth()

    if (supervisor.role.name !== 'SUPERVISOR' && supervisor.role.name !== 'ADMIN' && supervisor.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseServerClient()
    const body = await request.json()
    const { employeeId, departmentId } = body as {
      employeeId?: string
      departmentId?: string
    }

    if (!employeeId) {
      return NextResponse.json(
        { success: false, message: 'Employee ID is required' },
        { status: 400 }
      )
    }

    const { data: employee } = await supabase
      .from('users')
      .select('*, department:departments(*)')
      .eq('id', employeeId)
      .single()

    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Employee not found' },
        { status: 404 }
      )
    }

    const targetDeptId = departmentId || supervisor.departmentId

    if (!targetDeptId) {
      return NextResponse.json(
        { success: false, message: 'Department ID is required' },
        { status: 400 }
      )
    }

    const { data: department } = await supabase
      .from('departments')
      .select('*')
      .eq('id', targetDeptId)
      .single()

    if (!department) {
      return NextResponse.json(
        { success: false, message: 'Department not found' },
        { status: 404 }
      )
    }

    const { data: updatedEmployee } = await supabase
      .from('users')
      .update({ department_id: targetDeptId })
      .eq('id', employeeId)
      .select('*, role:roles(*), department:departments(*)')
      .single()

    await createAuditLog({
      userId: supervisor.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: employeeId,
      oldValues: { departmentId: employee.department_id },
      newValues: { departmentId: targetDeptId, assignedBy: supervisor.fullName },
    })

    return NextResponse.json({
      success: true,
      message: 'Employee assigned successfully',
      data: {
        id: updatedEmployee?.id,
        employeeCode: updatedEmployee?.employee_code,
        fullName: updatedEmployee?.full_name,
        department: updatedEmployee?.department?.name ?? null,
        departmentId: updatedEmployee?.department_id,
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
    console.error('Supervisor employees POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to assign employee' },
      { status: 500 }
    )
  }
}
