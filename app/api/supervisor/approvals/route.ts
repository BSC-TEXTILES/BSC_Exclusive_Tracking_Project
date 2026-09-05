import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || 'SUBMITTED'

    const where: Record<string, unknown> = { status }

    if (user.departmentId) {
      where.user = { departmentId: user.departmentId }
    }

    const [submissions, total] = await Promise.all([
      prisma.checkpointSubmission.findMany({
        where,
        include: {
          checkpoint: {
            include: { module: true },
          },
          user: {
            select: { id: true, fullName: true, employeeCode: true, departmentId: true },
          },
          answer: true,
          evidence: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.checkpointSubmission.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        approvals: submissions.map((s) => ({
          id: s.id,
          status: s.status,
          submissionDate: s.submissionDate,
          submittedAt: s.submittedAt,
          reviewComment: s.reviewComment,
          checkpoint: {
            id: s.checkpoint.id,
            title: s.checkpoint.title,
            score: s.checkpoint.score,
          },
          module: {
            id: s.checkpoint.module.id,
            name: s.checkpoint.module.name,
            slug: s.checkpoint.module.slug,
          },
          employee: {
            id: s.user.id,
            fullName: s.user.fullName,
            employeeCode: s.user.employeeCode,
          },
          hasAnswer: !!s.answer,
          evidenceCount: s.evidence.length,
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
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }
    console.error('Supervisor approvals GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supervisor = await requireAuth()

    if (supervisor.role.name !== 'SUPERVISOR' && supervisor.role.name !== 'ADMIN' && supervisor.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { submissionId, status, comment } = body as {
      submissionId?: string
      status?: string
      comment?: string
    }

    if (!submissionId || !status) {
      return NextResponse.json(
        { success: false, message: 'Submission ID and status are required' },
        { status: 400 }
      )
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status must be APPROVED or REJECTED' },
        { status: 400 }
      )
    }

    const submission = await prisma.checkpointSubmission.findUnique({
      where: { id: submissionId },
      include: {
        checkpoint: { include: { module: true } },
        user: { select: { id: true, fullName: true, departmentId: true } },
      },
    })

    if (!submission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      )
    }

    if (submission.status !== 'SUBMITTED') {
      return NextResponse.json(
        { success: false, message: 'Only submitted checkpoints can be reviewed' },
        { status: 400 }
      )
    }

    if (
      supervisor.departmentId &&
      submission.user.departmentId !== supervisor.departmentId
    ) {
      return NextResponse.json(
        { success: false, message: 'Submission is not from your department' },
        { status: 403 }
      )
    }

    const updateData: Record<string, unknown> = {
      status,
      reviewedById: supervisor.id,
      reviewComment: comment || null,
    }

    if (status === 'APPROVED') {
      updateData.approvedAt = new Date()
    } else {
      updateData.rejectedAt = new Date()
    }

    await prisma.checkpointSubmission.update({
      where: { id: submissionId },
      data: updateData,
    })

    await createAuditLog({
      userId: supervisor.id,
      action: status === 'APPROVED' ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REJECTED',
      entityType: 'checkpoint_submission',
      entityId: submissionId,
      newValues: {
        status,
        comment: comment || null,
        checkpointTitle: submission.checkpoint.title,
        moduleName: submission.checkpoint.module.name,
        submittedBy: submission.user.fullName,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Submission ${status.toLowerCase()} successfully`,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }
    console.error('Supervisor approvals POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to process approval' },
      { status: 500 }
    )
  }
}
