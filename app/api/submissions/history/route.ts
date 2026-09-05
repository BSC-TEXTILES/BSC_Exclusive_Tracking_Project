import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = user.role.name === 'ADMIN'
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const moduleId = searchParams.get('moduleId') || ''
    const status = searchParams.get('status') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const where: Record<string, unknown> = {}

    if (!isAdmin) {
      where.userId = user.id
    }

    if (moduleId) where.checkpoint = { moduleId }
    if (status) where.status = status

    if (dateFrom || dateTo) {
      where.submissionDate = {}
      if (dateFrom) (where.submissionDate as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.submissionDate as Record<string, unknown>).lte = new Date(dateTo)
    }

    const [submissions, total] = await Promise.all([
      prisma.checkpointSubmission.findMany({
        where,
        include: {
          checkpoint: {
            include: { module: true },
          },
          user: { select: { id: true, fullName: true, employeeCode: true } },
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
    console.error('Submission history GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
