import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

// YYYY-MM-DD -> Date at local midnight
function parseDateParam(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// YYYY-MM -> { start, end } at local midnight
function monthRange(value: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null
  const [y, m] = value.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1) // first day of next month
  return { start, end }
}

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isCompleted(status: string, complianceStatus: string | null | undefined): boolean {
  if (status !== 'SUBMITTED' && status !== 'APPROVED') return false
  return complianceStatus === 'FULLY_FOLLOWED'
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const monthParam = searchParams.get('month')

    // ----- Single-day details -----
    if (dateParam) {
      const day = parseDateParam(dateParam)
      if (!day) {
        return NextResponse.json(
          { success: false, message: 'Invalid date parameter (expected YYYY-MM-DD)', code: 'VALIDATION_ERROR' },
          { status: 400 }
        )
      }
      day.setHours(0, 0, 0, 0)
      const next = new Date(day)
      next.setDate(next.getDate() + 1)

      const [assignments, submissions] = await Promise.all([
        prisma.checkpointAssignment.findMany({
          where: {
            userId: user.id,
            assignedDate: { gte: day, lt: next },
            status: 'ACTIVE',
          },
          include: {
            checkpoint: {
              include: {
                module: { select: { id: true, name: true, slug: true } },
              },
            },
          },
          orderBy: { checkpoint: { displayOrder: 'asc' } },
        }),
        prisma.checkpointSubmission.findMany({
          where: {
            userId: user.id,
            submissionDate: { gte: day, lt: next },
          },
          include: {
            checkpoint: {
              include: {
                module: { select: { id: true, name: true, slug: true } },
              },
            },
            answer: true,
            reviewedBy: { select: { id: true, fullName: true } },
            evidence: { select: { id: true, originalName: true, mimeType: true, fileSize: true } },
          },
          orderBy: { submittedAt: 'asc' },
        }),
      ])

      // counts
      const completed = submissions.filter(s => isCompleted(s.status, s.answer?.complianceStatus)).length
      const approved = submissions.filter(s => s.status === 'APPROVED').length
      const submitted = submissions.filter(s => s.status === 'SUBMITTED').length
      const rejected = submissions.filter(s => s.status === 'REJECTED').length
      const draft = submissions.filter(s => s.status === 'DRAFT').length
      const total = assignments.length

      // Merge: one record per checkpoint (prefer submission over bare assignment)
      const byCheckpoint = new Map<string, {
        assignmentId: string
        checkpointId: string
        checkpointTitle: string
        moduleName: string
        moduleSlug: string
        status: string
        submittedAt: string | null
        approvedAt: string | null
        rejectedAt: string | null
        reviewedBy: string | null
        reviewComment: string | null
        complianceStatus: string | null
        accuracyStatus: string | null
        comments: string | null
        correctiveAction: string | null
        evidenceCount: number
        evidenceFiles: { id: string; originalName: string; mimeType: string; fileSize: number }[]
      }>()

      for (const a of assignments) {
        byCheckpoint.set(a.checkpointId, {
          assignmentId: a.id,
          checkpointId: a.checkpointId,
          checkpointTitle: a.checkpoint.title,
          moduleName: a.checkpoint.module.name,
          moduleSlug: a.checkpoint.module.slug,
          status: 'PENDING',
          submittedAt: null,
          approvedAt: null,
          rejectedAt: null,
          reviewedBy: null,
          reviewComment: null,
          complianceStatus: null,
          accuracyStatus: null,
          comments: null,
          correctiveAction: null,
          evidenceCount: 0,
          evidenceFiles: [],
        })
      }

      for (const s of submissions) {
        byCheckpoint.set(s.checkpointId, {
          assignmentId: s.assignmentId || '',
          checkpointId: s.checkpointId,
          checkpointTitle: s.checkpoint.title,
          moduleName: s.checkpoint.module.name,
          moduleSlug: s.checkpoint.module.slug,
          status: s.status,
          submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
          approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
          rejectedAt: s.rejectedAt ? s.rejectedAt.toISOString() : null,
          reviewedBy: s.reviewedBy?.fullName || null,
          reviewComment: s.reviewComment,
          complianceStatus: s.answer?.complianceStatus || null,
          accuracyStatus: s.answer?.accuracyStatus || null,
          comments: s.answer?.comments || null,
          correctiveAction: s.answer?.correctiveAction || null,
          evidenceCount: s.evidence.length,
          evidenceFiles: s.evidence.map(e => ({
            id: e.id,
            originalName: e.originalName,
            mimeType: e.mimeType,
            fileSize: e.fileSize,
          })),
        })
      }

      const items = Array.from(byCheckpoint.values()).sort((a, b) =>
        a.moduleName.localeCompare(b.moduleName) ||
        a.checkpointTitle.localeCompare(b.checkpointTitle)
      )

      return NextResponse.json({
        success: true,
        data: {
          date: dayKey(day),
          counts: { total, completed, approved, submitted, rejected, draft, pending: total - submissions.length },
          items,
        },
      })
    }

    // ----- Month summary -----
    if (!monthParam) {
      return NextResponse.json(
        { success: false, message: 'Either ?date=YYYY-MM-DD or ?month=YYYY-MM is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    const range = monthRange(monthParam)
    if (!range) {
      return NextResponse.json(
        { success: false, message: 'Invalid month parameter (expected YYYY-MM)', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const [assignments, submissions] = await Promise.all([
      prisma.checkpointAssignment.findMany({
        where: {
          userId: user.id,
          assignedDate: { gte: range.start, lt: range.end },
          status: 'ACTIVE',
        },
        select: {
          assignedDate: true,
          checkpointId: true,
        },
      }),
      prisma.checkpointSubmission.findMany({
        where: {
          userId: user.id,
          submissionDate: { gte: range.start, lt: range.end },
        },
        select: {
          submissionDate: true,
          checkpointId: true,
          status: true,
          answer: { select: { complianceStatus: true } },
        },
      }),
    ])

    // Per-day buckets
    const buckets = new Map<string, { total: number; completed: number; pending: number; draft: number }>()

    for (const a of assignments) {
      const key = dayKey(a.assignedDate)
      const bucket = buckets.get(key) || { total: 0, completed: 0, pending: 0, draft: 0 }
      bucket.total++
      buckets.set(key, bucket)
    }

    const draftByKeyCheckpoint = new Set<string>()
    const completedByKeyCheckpoint = new Set<string>()
    const submittedByKeyCheckpoint = new Set<string>()

    for (const s of submissions) {
      const key = dayKey(s.submissionDate)
      const bucket = buckets.get(key) || { total: 0, completed: 0, pending: 0, draft: 0 }
      const ck = `${key}|${s.checkpointId}`

      if (s.status === 'DRAFT') {
        if (!submittedByKeyCheckpoint.has(ck)) {
          draftByKeyCheckpoint.add(ck)
          bucket.draft++
        }
      } else if (isCompleted(s.status, s.answer?.complianceStatus)) {
        if (!completedByKeyCheckpoint.has(ck)) {
          completedByKeyCheckpoint.add(ck)
          bucket.completed++
        }
        submittedByKeyCheckpoint.add(ck)
      } else {
        submittedByKeyCheckpoint.add(ck)
      }
      buckets.set(key, bucket)
    }

    // Compute pending = total - completed - draft
    for (const [, bucket] of buckets) {
      bucket.pending = Math.max(0, bucket.total - bucket.completed - bucket.draft)
    }

    const days = Array.from(buckets.entries())
      .map(([date, b]) => ({ date, ...b }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      success: true,
      data: {
        month: monthParam,
        days,
      },
    })
  } catch (error) {
    console.error('Calendar API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
