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

    let query = supabase
      .from('departments')
      .select('*, users:users(id), modules:modules(id)')
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true })

    if (user.departmentId) {
      query = query.eq('id', user.departmentId)
    }

    const { data: departments, error } = await query

    if (error) {
      console.error('Supervisor departments GET error:', error)
      return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        departments: (departments || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          description: d.description,
          status: d.status,
          userCount: d.users?.length || 0,
          moduleCount: d.modules?.length || 0,
          createdAt: d.created_at,
        })),
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
    console.error('Supervisor departments GET error:', error)
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
    const { departmentId } = body as { departmentId?: string }

    if (!departmentId) {
      return NextResponse.json(
        { success: false, message: 'Department ID is required' },
        { status: 400 }
      )
    }

    const { data: department } = await supabase
      .from('departments')
      .select('*')
      .eq('id', departmentId)
      .single()

    if (!department) {
      return NextResponse.json(
        { success: false, message: 'Department not found' },
        { status: 404 }
      )
    }

    if (supervisor.departmentId && supervisor.departmentId !== departmentId) {
      return NextResponse.json(
        { success: false, message: 'Cannot assign department outside your scope' },
        { status: 403 }
      )
    }

    await createAuditLog({
      userId: supervisor.id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'department',
      entityId: departmentId,
      newValues: { assignedTo: supervisor.fullName, departmentName: department.name },
    })

    return NextResponse.json({
      success: true,
      message: 'Department assigned successfully',
      data: {
        id: department.id,
        name: department.name,
        code: department.code,
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
    console.error('Supervisor departments POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to assign department' },
      { status: 500 }
    )
  }
}
