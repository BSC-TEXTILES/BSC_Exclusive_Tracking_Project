import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { checkpointSchema } from '@/lib/validations/schemas'

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
    const moduleId = id

    const mod = await prisma.module.findUnique({ where: { id: moduleId } })
    if (!mod) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const checkpoints = await prisma.checkpoint.findMany({
      where: { moduleId },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        module: { id: mod.id, name: mod.name, slug: mod.slug },
        checkpoints: checkpoints.map(cp => ({
          id: cp.id,
          title: cp.title,
          description: cp.description,
          score: cp.score,
          displayOrder: cp.displayOrder,
          isAccuracyRequired: cp.isAccuracyRequired,
          isCorrectiveActionRequired: cp.isCorrectiveActionRequired,
          isPhotoRequired: cp.isPhotoRequired,
          status: cp.status,
          createdAt: cp.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('Module checkpoints GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const moduleId = id
    const body = await request.json()

    const mod = await prisma.module.findUnique({ where: { id: moduleId } })
    if (!mod) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const parsed = checkpointSchema.safeParse({ ...body, moduleId })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const checkpoint = await prisma.checkpoint.create({
      data: {
        moduleId,
        title: data.title,
        description: data.description || null,
        score: data.score,
        isAccuracyRequired: data.isAccuracyRequired,
        isCorrectiveActionRequired: data.isCorrectiveActionRequired,
        isPhotoRequired: data.isPhotoRequired,
        displayOrder: data.displayOrder,
        status: data.status,
        createdById: admin.id,
      },
    })

    await createAuditLog({
      userId: admin.id,
      action: 'CHECKPOINT_CREATED',
      entityType: 'checkpoint',
      entityId: checkpoint.id,
      newValues: { title: checkpoint.title, moduleId, moduleName: mod.name },
    })

    return NextResponse.json({
      success: true,
      message: 'Checkpoint created successfully',
      data: { id: checkpoint.id, title: checkpoint.title },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Module checkpoints POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to create checkpoint' }, { status: 500 })
  }
}
