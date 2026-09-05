import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    let dayStart: Date
    let dayEnd: Date

    if (dateParam) {
      dayStart = new Date(dateParam)
      dayStart.setHours(0, 0, 0, 0)
      dayEnd = new Date(dateParam)
      dayEnd.setHours(23, 59, 59, 999)
    } else {
      dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      dayEnd = new Date()
      dayEnd.setDate(dayEnd.getDate() + 7)
      dayEnd.setHours(23, 59, 59, 999)
    }

    const [upcomingAssignments, recentSubmissions] = await Promise.all([
      prisma.checkpointAssignment.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          assignedDate: {
            gte: dayStart,
            lte: dateParam ? dayEnd : dayEnd,
          },
        },
        include: {
          checkpoint: {
            include: {
              module: { select: { name: true } },
            },
          },
        },
        orderBy: { assignedDate: 'asc' },
        take: dateParam ? 20 : 10,
      }),
      prisma.checkpointSubmission.findMany({
        where: {
          userId: user.id,
          ...(dateParam ? {
            submissionDate: {
              gte: dayStart,
              lte: dayEnd,
            },
          } : {}),
        },
        include: {
          checkpoint: {
            include: {
              module: { select: { name: true } },
            },
          },
        },
        orderBy: { submissionDate: 'desc' },
        take: dateParam ? 20 : 5,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        upcoming: upcomingAssignments.map(a => ({
          id: a.id,
          checkpointTitle: a.checkpoint.title,
          moduleName: a.checkpoint.module.name,
          assignedDate: a.assignedDate,
          dueDate: a.dueDate,
        })),
        recent: recentSubmissions.map(s => ({
          id: s.id,
          checkpointTitle: s.checkpoint.title,
          moduleName: s.checkpoint.module.name,
          status: s.status,
          submissionDate: s.submissionDate,
        })),
      },
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
