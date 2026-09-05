import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { departmentSchema } from '@/lib/validations/schemas'

export async function GET() {
  try {
    await requireAdmin()

    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { users: true, modules: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        departments: departments.map(d => ({
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
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Departments GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()

    const parsed = departmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await prisma.department.findFirst({
      where: { OR: [{ name: data.name }, { code: data.code }] },
    })
    if (existing) {
      const field = existing.name === data.name ? 'Name' : 'Code'
      return NextResponse.json({ success: false, message: `${field} already exists` }, { status: 409 })
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        status: data.status,
      },
    })

    await createAuditLog({
      userId: admin.id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'department',
      entityId: department.id,
      newValues: { name: department.name, code: department.code },
    })

    return NextResponse.json({
      success: true,
      message: 'Department created successfully',
      data: { id: department.id, name: department.name, code: department.code },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Departments POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to create department' }, { status: 500 })
  }
}
