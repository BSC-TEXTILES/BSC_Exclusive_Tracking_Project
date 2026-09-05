import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
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

    const employee = await prisma.user.findUnique({
      where: { id },
      include: { department: true },
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Employee not found' },
        { status: 404 }
      )
    }

    if (supervisor.departmentId && employee.departmentId !== supervisor.departmentId) {
      return NextResponse.json(
        { success: false, message: 'Employee is not in your department' },
        { status: 403 }
      )
    }

    const updatedEmployee = await prisma.user.update({
      where: { id },
      data: { departmentId: null },
      include: { role: true, department: true },
    })

    await createAuditLog({
      userId: supervisor.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      oldValues: { departmentId: employee.departmentId, departmentName: employee.department?.name },
      newValues: { departmentId: null, removedBy: supervisor.fullName },
    })

    return NextResponse.json({
      success: true,
      message: 'Employee removed from supervisor successfully',
      data: {
        id: updatedEmployee.id,
        employeeCode: updatedEmployee.employeeCode,
        fullName: updatedEmployee.fullName,
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
