import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const createAssignmentSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Select at least one user'),
  checkpointIds: z.array(z.string()).min(1, 'Select at least one checkpoint'),
  assignedDate: z.string(), // YYYY-MM-DD
  dueDate: z.string().optional().nullable(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME']).default('DAILY'),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    const userId = searchParams.get('userId')
    const moduleId = searchParams.get('moduleId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const page = parseInt(searchParams.get('page') || '1')

    const where: Record<string, unknown> = {}

    if (dateStr) {
      const date = new Date(dateStr)
      date.setHours(0, 0, 0, 0)
      where.assignedDate = date
    }

    if (userId) where.userId = userId
    if (status) where.status = status
    if (moduleId) {
      where.checkpoint = { moduleId }
    }

    const [assignments, total, users, modules] = await Promise.all([
      prisma.checkpointAssignment.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, employeeCode: true, email: true },
          },
          checkpoint: {
            include: { module: { select: { id: true, name: true, slug: true } } },
          },
        },
        orderBy: [{ assignedDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.checkpointAssignment.count({ where }),
      prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, fullName: true, employeeCode: true, department: { select: { name: true } } },
        orderBy: { fullName: 'asc' },
      }),
      prisma.module.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          slug: true,
          checkpoints: {
            where: { status: 'ACTIVE' },
            select: { id: true, title: true, score: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        assignments: assignments.map(a => ({
          id: a.id,
          assignedDate: a.assignedDate.toISOString().split('T')[0],
          dueDate: a.dueDate ? a.dueDate.toISOString().split('T')[0] : null,
          frequency: a.frequency,
          status: a.status,
          user: a.user,
          checkpoint: {
            id: a.checkpoint.id,
            title: a.checkpoint.title,
            score: a.checkpoint.score,
            module: a.checkpoint.module,
          },
        })),
        total,
        page,
        limit,
        users,
        modules,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Assignments GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()

    const parsed = createAssignmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { userIds, checkpointIds, assignedDate, dueDate, frequency } = parsed.data
    const dateObj = new Date(assignedDate)
    dateObj.setHours(0, 0, 0, 0)

    const dueDateObj = dueDate ? new Date(dueDate) : null

    let createdCount = 0

    for (const userId of userIds) {
      for (const checkpointId of checkpointIds) {
        await prisma.checkpointAssignment.upsert({
          where: {
            userId_checkpointId_assignedDate: {
              userId,
              checkpointId,
              assignedDate: dateObj,
            },
          },
          update: {
            frequency,
            status: 'ACTIVE',
            ...(dueDateObj && { dueDate: dueDateObj }),
          },
          create: {
            userId,
            checkpointId,
            assignedDate: dateObj,
            dueDate: dueDateObj,
            frequency,
            status: 'ACTIVE',
          },
        })
        createdCount++
      }
    }

    await createAuditLog({
      userId: admin.id,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'checkpoint_assignment',
      entityId: userIds[0],
      newValues: { userCount: userIds.length, checkpointCount: checkpointIds.length, assignedDate },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${createdCount} checkpoint assignment(s)`,
      data: { createdCount },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Assignments POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to assign checkpoints' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, message: 'Assignment ID required' }, { status: 400 })
    }

    const existing = await prisma.checkpointAssignment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Assignment not found' }, { status: 404 })
    }

    await prisma.checkpointAssignment.delete({ where: { id } })

    await createAuditLog({
      userId: admin.id,
      action: 'ASSIGNMENT_DELETED',
      entityType: 'checkpoint_assignment',
      entityId: id,
    })

    return NextResponse.json({ success: true, message: 'Assignment deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Assignments DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
