import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('userId') || ''
    const moduleId = searchParams.get('moduleId') || ''
    const status = searchParams.get('status') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}

    if (userId) where.userId = userId
    if (status) where.status = status
    if (moduleId) where.checkpoint = { moduleId }

    if (dateFrom || dateTo) {
      where.submissionDate = {}
      if (dateFrom) (where.submissionDate as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.submissionDate as Record<string, unknown>).lte = new Date(dateTo)
    }

    if (search) {
      where.user = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const [submissions, total] = await Promise.all([
      prisma.checkpointSubmission.findMany({
        where,
        include: {
          checkpoint: {
            include: { module: true },
          },
          user: { select: { id: true, fullName: true, employeeCode: true } },
          reviewedBy: { select: { id: true, fullName: true } },
          answer: true,
        },
        orderBy: { submissionDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.checkpointSubmission.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        submissions: submissions.map(s => ({
          id: s.id,
          status: s.status,
          submissionDate: s.submissionDate,
          submittedAt: s.submittedAt,
          approvedAt: s.approvedAt,
          rejectedAt: s.rejectedAt,
          reviewComment: s.reviewComment,
          reviewedBy: s.reviewedBy ? { id: s.reviewedBy.id, fullName: s.reviewedBy.fullName } : null,
          checkpoint: {
            id: s.checkpoint.id,
            title: s.checkpoint.title,
            score: s.checkpoint.score,
          },
          module: {
            id: s.checkpoint.module.id,
            name: s.checkpoint.module.name,
          },
          user: {
            id: s.user.id,
            fullName: s.user.fullName,
            employeeCode: s.user.employeeCode,
          },
          answer: s.answer ? {
            complianceStatus: s.answer.complianceStatus,
            accuracyStatus: s.answer.accuracyStatus,
            comments: s.answer.comments,
            correctiveAction: s.answer.correctiveAction,
          } : null,
          createdAt: s.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin submissions GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
