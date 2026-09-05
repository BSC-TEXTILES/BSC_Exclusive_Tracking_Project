import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const departmentId = searchParams.get('departmentId') || ''

    const where: Record<string, unknown> = {}

    if (user.departmentId) {
      where.departmentId = user.departmentId
    } else if (departmentId) {
      where.departmentId = departmentId
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) where.status = status

    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
          department: true,
        },
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        employees: employees.map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          email: e.email,
          phone: e.phone,
          role: e.role.name,
          roleId: e.roleId,
          department: e.department?.name ?? null,
          departmentId: e.departmentId,
          status: e.status,
          lastLoginAt: e.lastLoginAt,
          createdAt: e.createdAt,
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

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: { department: true },
    })

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

    const department = await prisma.department.findUnique({
      where: { id: targetDeptId },
    })

    if (!department) {
      return NextResponse.json(
        { success: false, message: 'Department not found' },
        { status: 404 }
      )
    }

    const updatedEmployee = await prisma.user.update({
      where: { id: employeeId },
      data: { departmentId: targetDeptId },
      include: { role: true, department: true },
    })

    await createAuditLog({
      userId: supervisor.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: employeeId,
      oldValues: { departmentId: employee.departmentId },
      newValues: { departmentId: targetDeptId, assignedBy: supervisor.fullName },
    })

    return NextResponse.json({
      success: true,
      message: 'Employee assigned successfully',
      data: {
        id: updatedEmployee.id,
        employeeCode: updatedEmployee.employeeCode,
        fullName: updatedEmployee.fullName,
        department: updatedEmployee.department?.name ?? null,
        departmentId: updatedEmployee.departmentId,
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
