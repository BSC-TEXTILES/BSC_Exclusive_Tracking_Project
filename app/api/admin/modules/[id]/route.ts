import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { moduleSchema } from '@/lib/validations/schemas'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const mod = await prisma.module.findUnique({
      where: { id },
      include: {
        department: true,
        checkpoints: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    if (!mod) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: mod.id,
        name: mod.name,
        slug: mod.slug,
        description: mod.description,
        department: mod.department.name,
        departmentId: mod.departmentId,
        displayOrder: mod.displayOrder,
        status: mod.status,
        checkpoints: mod.checkpoints.map(cp => ({
          id: cp.id,
          title: cp.title,
          description: cp.description,
          score: cp.score,
          displayOrder: cp.displayOrder,
          isAccuracyRequired: cp.isAccuracyRequired,
          isCorrectiveActionRequired: cp.isCorrectiveActionRequired,
          isPhotoRequired: cp.isPhotoRequired,
          status: cp.status,
        })),
        createdAt: mod.createdAt,
      },
    })
  } catch (error) {
    console.error('Module GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.module.findUnique({ where: { id }, include: { department: true } })
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const parsed = moduleSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    if (data.slug && data.slug !== existing.slug) {
      const dup = await prisma.module.findFirst({ where: { slug: data.slug } })
      if (dup) {
        return NextResponse.json({ success: false, message: 'Slug already exists' }, { status: 409 })
      }
    }

    const mod = await prisma.module.update({
      where: { id },
      data: {
        departmentId: data.departmentId ?? undefined,
        name: data.name ?? undefined,
        slug: data.slug ?? undefined,
        description: data.description !== undefined ? (data.description || null) : undefined,
        displayOrder: data.displayOrder ?? undefined,
        status: data.status ?? undefined,
      },
      include: { department: true },
    })

    await createAuditLog({
      userId: admin.id,
      action: 'MODULE_UPDATED',
      entityType: 'module',
      entityId: id,
      oldValues: { name: existing.name, slug: existing.slug },
      newValues: { name: mod.name, slug: mod.slug },
    })

    return NextResponse.json({
      success: true,
      message: 'Module updated successfully',
      data: { id: mod.id, name: mod.name, slug: mod.slug },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Module PATCH error:', error)
    return NextResponse.json({ success: false, message: 'Failed to update module' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    const existing = await prisma.module.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    await prisma.module.update({
      where: { id },
      data: { status: 'INACTIVE' },
    })

    await createAuditLog({
      userId: admin.id,
      action: 'MODULE_UPDATED',
      entityType: 'module',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: 'INACTIVE' },
    })

    return NextResponse.json({
      success: true,
      message: 'Module deactivated successfully',
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Module DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Failed to delete module' }, { status: 500 })
  }
}
