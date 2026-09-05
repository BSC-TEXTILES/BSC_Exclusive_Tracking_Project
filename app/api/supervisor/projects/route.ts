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
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = { status: 'ACTIVE' }

    if (user.departmentId) {
      where.departmentId = user.departmentId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const modules = await prisma.module.findMany({
      where,
      include: {
        department: true,
        _count: { select: { checkpoints: true } },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        modules: modules.map((m) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
          description: m.description,
          department: m.department.name,
          departmentId: m.departmentId,
          displayOrder: m.displayOrder,
          status: m.status,
          checkpointCount: m._count.checkpoints,
          createdAt: m.createdAt,
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
    console.error('Supervisor projects GET error:', error)
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
    const { moduleId, departmentId } = body as {
      moduleId?: string
      departmentId?: string
    }

    if (!moduleId) {
      return NextResponse.json(
        { success: false, message: 'Module ID is required' },
        { status: 400 }
      )
    }

    const mod = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { department: true },
    })

    if (!mod) {
      return NextResponse.json(
        { success: false, message: 'Module not found' },
        { status: 404 }
      )
    }

    const targetDeptId = departmentId || supervisor.departmentId

    if (targetDeptId && mod.departmentId !== targetDeptId) {
      return NextResponse.json(
        { success: false, message: 'Module does not belong to the assigned department' },
        { status: 400 }
      )
    }

    await createAuditLog({
      userId: supervisor.id,
      action: 'MODULE_UPDATED',
      entityType: 'module',
      entityId: moduleId,
      newValues: { assignedTo: supervisor.fullName, moduleName: mod.name, departmentName: mod.department.name },
    })

    return NextResponse.json({
      success: true,
      message: 'Module assigned successfully',
      data: {
        id: mod.id,
        name: mod.name,
        slug: mod.slug,
        department: mod.department.name,
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
    console.error('Supervisor projects POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to assign module' },
      { status: 500 }
    )
  }
}
