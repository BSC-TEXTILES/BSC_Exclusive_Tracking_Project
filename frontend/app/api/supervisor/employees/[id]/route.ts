import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supervisor = await requireAuth()

    if (supervisor.role.name !== 'SUPERVISOR' && supervisor.role.name !== 'ADMIN' && supervisor.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = getSupabaseServerClient()

    const { data: employee } = await supabase
      .from('users')
      .select('*, department:departments(*)')
      .eq('id', id)
      .single()

    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Employee not found' },
        { status: 404 }
      )
    }

    if (supervisor.departmentId && employee.department_id !== supervisor.departmentId) {
      return NextResponse.json(
        { success: false, message: 'Employee is not in your department' },
        { status: 403 }
      )
    }

    const { data: updatedEmployee } = await supabase
      .from('users')
      .update({ department_id: null })
      .eq('id', id)
      .select('*, role:roles(*), department:departments(*)')
      .single()

    await createAuditLog({
      userId: supervisor.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      oldValues: { departmentId: employee.department_id, departmentName: employee.department?.name },
      newValues: { departmentId: null, removedBy: supervisor.fullName },
    })

    return NextResponse.json({
      success: true,
      message: 'Employee removed from supervisor successfully',
      data: {
        id: updatedEmployee?.id,
        employeeCode: updatedEmployee?.employee_code,
        fullName: updatedEmployee?.full_name,
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
    console.error('Supervisor employee DELETE error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to remove employee' },
      { status: 500 }
    )
  }
}
