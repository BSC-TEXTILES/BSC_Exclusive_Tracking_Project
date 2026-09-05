import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const isAdmin = currentUser.role.name === 'ADMIN'
    if (!isAdmin && currentUser.id !== id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const modules = await prisma.module.findMany({
      where: { status: 'ACTIVE' },
      include: {
        department: true,
        checkpoints: {
          where: { status: 'ACTIVE' },
          include: {
            assignments: {
              where: { userId: id },
            },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    const assignedModules = modules.filter(m =>
      m.checkpoints.some(cp => cp.assignments.length > 0)
    ).map(m => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      description: m.description,
      department: m.department.name,
      checkpointCount: m.checkpoints.length,
      assignedCheckpointCount: m.checkpoints.filter(cp => cp.assignments.length > 0).length,
    }))

    const availableModules = modules
      .filter(m => !m.checkpoints.some(cp => cp.assignments.length > 0))
      .map(m => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        description: m.description,
        department: m.department.name,
        checkpointCount: m.checkpoints.length,
      }))

    return NextResponse.json({
      success: true,
      data: {
        user: { id: user.id, fullName: user.fullName },
        assignedModules,
        availableModules,
      },
    })
  } catch (error) {
    console.error('User modules GET error:', error)
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
    const body = await request.json()

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const { moduleIds } = body as { moduleIds: string[] }

    if (!moduleIds || !Array.isArray(moduleIds) || moduleIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'moduleIds array is required' },
        { status: 400 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let createdCount = 0

    for (const moduleId of moduleIds) {
      const mod = await prisma.module.findUnique({
        where: { id: moduleId },
        include: { checkpoints: { where: { status: 'ACTIVE' } } },
      })

      if (!mod) continue

      for (const checkpoint of mod.checkpoints) {
        const existing = await prisma.checkpointAssignment.findFirst({
          where: {
            checkpointId: checkpoint.id,
            userId: id,
            assignedDate: today,
          },
        })

        if (!existing) {
          await prisma.checkpointAssignment.create({
            data: {
              checkpointId: checkpoint.id,
              userId: id,
              assignedDate: today,
              frequency: 'DAILY',
            },
          })
          createdCount++
        }
      }
    }

    await createAuditLog({
      userId: admin.id,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'user_module',
      entityId: id,
      newValues: { moduleIds, assignmentsCreated: createdCount },
    })

    return NextResponse.json({
      success: true,
      message: `Created ${createdCount} checkpoint assignments`,
      data: { assignmentsCreated: createdCount },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('User modules POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to assign modules' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const { moduleIds } = body as { moduleIds: string[] }

    if (!moduleIds || !Array.isArray(moduleIds)) {
      return NextResponse.json(
        { success: false, message: 'moduleIds array is required' },
        { status: 400 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const allCheckpoints = await prisma.checkpoint.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, moduleId: true },
    })

    const checkpointsToRemove = allCheckpoints.filter(cp => !moduleIds.includes(cp.moduleId))

    await prisma.checkpointAssignment.deleteMany({
      where: {
        userId: id,
        checkpointId: { in: checkpointsToRemove.map(cp => cp.id) },
      },
    })

    let createdCount = 0
    for (const moduleId of moduleIds) {
      const mod = await prisma.module.findUnique({
        where: { id: moduleId },
        include: { checkpoints: { where: { status: 'ACTIVE' } } },
      })

      if (!mod) continue

      for (const checkpoint of mod.checkpoints) {
        const existing = await prisma.checkpointAssignment.findFirst({
          where: {
            checkpointId: checkpoint.id,
            userId: id,
            assignedDate: today,
          },
        })

        if (!existing) {
          await prisma.checkpointAssignment.create({
            data: {
              checkpointId: checkpoint.id,
              userId: id,
              assignedDate: today,
              frequency: 'DAILY',
            },
          })
          createdCount++
        }
      }
    }

    await createAuditLog({
      userId: admin.id,
      action: 'ASSIGNMENT_UPDATED',
      entityType: 'user_module',
      entityId: id,
      newValues: { moduleIds, assignmentsCreated: createdCount, assignmentsRemoved: checkpointsToRemove.length },
    })

    return NextResponse.json({
      success: true,
      message: 'Module assignments updated successfully',
      data: { assignmentsCreated: createdCount, assignmentsRemoved: checkpointsToRemove.length },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('User modules PUT error:', error)
    return NextResponse.json({ success: false, message: 'Failed to update module assignments' }, { status: 500 })
  }
}
