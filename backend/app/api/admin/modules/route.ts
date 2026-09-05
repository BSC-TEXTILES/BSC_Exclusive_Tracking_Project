import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { moduleSchema } from '@/lib/validations/schemas'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = user.role.name === 'ADMIN'
    const where: Record<string, unknown> = {}

    if (!isAdmin) {
      where.status = 'ACTIVE'
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const search = searchParams.get('search')

    if (departmentId) where.departmentId = departmentId
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
        modules: modules.map(m => ({
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
    console.error('Modules GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()

    const parsed = moduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await prisma.module.findFirst({
      where: { OR: [{ slug: data.slug }, { name: data.name }] },
    })
    if (existing) {
      const field = existing.slug === data.slug ? 'Slug' : 'Name'
      return NextResponse.json({ success: false, message: `${field} already exists` }, { status: 409 })
    }

    const mod = await prisma.module.create({
      data: {
        departmentId: data.departmentId,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        displayOrder: data.displayOrder,
        status: data.status,
      },
      include: { department: true },
    })

    await createAuditLog({
      userId: admin.id,
      action: 'MODULE_CREATED',
      entityType: 'module',
      entityId: mod.id,
      newValues: { name: mod.name, slug: mod.slug, department: mod.department.name },
    })

    return NextResponse.json({
      success: true,
      message: 'Module created successfully',
      data: { id: mod.id, name: mod.name, slug: mod.slug },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Modules POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to create module' }, { status: 500 })
  }
}
