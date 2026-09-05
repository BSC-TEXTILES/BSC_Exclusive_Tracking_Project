import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
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

    let departments

    if (user.departmentId) {
      departments = await prisma.department.findMany({
        where: { id: user.departmentId, status: 'ACTIVE' },
        include: {
          _count: { select: { users: true, modules: true } },
        },
        orderBy: { name: 'asc' },
      })
    } else {
      departments = await prisma.department.findMany({
        where: { status: 'ACTIVE' },
        include: {
          _count: { select: { users: true, modules: true } },
        },
        orderBy: { name: 'asc' },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          description: d.description,
          status: d.status,
          userCount: d._count.users,
          moduleCount: d._count.modules,
          createdAt: d.createdAt,
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

    const body = await request.json()
    const { departmentId } = body as { departmentId?: string }

    if (!departmentId) {
      return NextResponse.json(
        { success: false, message: 'Department ID is required' },
        { status: 400 }
      )
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    })

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
