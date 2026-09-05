import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get today's assignments for this user
    let assignments = await prisma.checkpointAssignment.findMany({
      where: {
        userId: user.id,
        assignedDate: today,
        status: 'ACTIVE',
      },
      include: {
        checkpoint: {
          include: {
            module: true,
          },
        },
      },
    })

    // If no assignments exist for today, auto-assign active checkpoints
    if (assignments.length === 0) {
      const activeCheckpoints = await prisma.checkpoint.findMany({
        where: { status: 'ACTIVE' },
        include: { module: true },
        orderBy: { displayOrder: 'asc' },
      })

      if (activeCheckpoints.length > 0) {
        for (const cp of activeCheckpoints) {
          await prisma.checkpointAssignment.upsert({
            where: {
              userId_checkpointId_assignedDate: {
                userId: user.id,
                checkpointId: cp.id,
                assignedDate: today,
              },
            },
            update: {},
            create: {
              checkpointId: cp.id,
              userId: user.id,
              assignedDate: today,
              frequency: 'DAILY',
            },
          })
        }

        assignments = await prisma.checkpointAssignment.findMany({
          where: {
            userId: user.id,
            assignedDate: today,
            status: 'ACTIVE',
          },
          include: {
            checkpoint: {
              include: {
                module: true,
              },
            },
          },
        })
      }
    }

    // Get today's submissions for this user
    const submissions = await prisma.checkpointSubmission.findMany({
      where: {
        userId: user.id,
        submissionDate: today,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
    })

    const submittedCheckpointIds = new Set(submissions.map(s => s.checkpointId))

    // Get all drafts
    const drafts = await prisma.checkpointSubmission.findMany({
      where: {
        userId: user.id,
        submissionDate: today,
        status: 'DRAFT',
      },
    })

    const draftCheckpointIds = new Set(drafts.map(d => d.checkpointId))

    // Calculate module stats
    const moduleMap = new Map<string, {
      id: string
      name: string
      slug: string
      displayOrder: number
      total: number
      submitted: number
      pending: number
      draft: number
    }>()

    for (const assignment of assignments) {
      const mod = assignment.checkpoint.module
      if (!moduleMap.has(mod.id)) {
        moduleMap.set(mod.id, {
          id: mod.id,
          name: mod.name,
          slug: mod.slug,
          displayOrder: mod.displayOrder ?? 0,
          total: 0,
          submitted: 0,
          pending: 0,
          draft: 0,
        })
      }

      const stats = moduleMap.get(mod.id)!
      stats.total++

      if (submittedCheckpointIds.has(assignment.checkpointId)) {
        stats.submitted++
      } else {
        stats.pending++
        if (draftCheckpointIds.has(assignment.checkpointId)) {
          stats.draft++
        }
      }
    }

    const modules = Array.from(moduleMap.values()).sort((a, b) => {
      return a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)
    })

    const totalCheckpoints = assignments.length
    const submittedToday = submissions.length

    // Generate initials (e.g. "Prakash Chand" -> "PC", or "Admin" -> "A")
    const names = user.fullName.trim().split(/\s+/)
    const initials = names.length > 1
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : (names[0]?.substring(0, 2) || 'U').toUpperCase()

    return NextResponse.json({
      success: true,
      data: {
        user: {
          fullName: user.fullName,
          firstName: names[0] || user.fullName,
          initials,
          role: user.role.name,
        },
        totalCheckpoints,
        submittedToday,
        modules,
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
