import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { id } = await params

    const submission = await prisma.checkpointSubmission.findUnique({
      where: { id },
      include: {
        checkpoint: {
          include: { module: true },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            email: true,
            departmentId: true,
            department: { select: { name: true } },
          },
        },
        answer: true,
        evidence: true,
        reviewedBy: {
          select: { id: true, fullName: true },
        },
      },
    })

    if (!submission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      )
    }

    if (
      user.departmentId &&
      submission.user.departmentId !== user.departmentId
    ) {
      return NextResponse.json(
        { success: false, message: 'Submission is not from your department' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: submission.id,
        status: submission.status,
        submissionDate: submission.submissionDate,
        submittedAt: submission.submittedAt,
        approvedAt: submission.approvedAt,
        rejectedAt: submission.rejectedAt,
        reviewComment: submission.reviewComment,
        checkpoint: {
          id: submission.checkpoint.id,
          title: submission.checkpoint.title,
          description: submission.checkpoint.description,
          score: submission.checkpoint.score,
          isAccuracyRequired: submission.checkpoint.isAccuracyRequired,
          isPhotoRequired: submission.checkpoint.isPhotoRequired,
        },
        module: {
          id: submission.checkpoint.module.id,
          name: submission.checkpoint.module.name,
          slug: submission.checkpoint.module.slug,
        },
        employee: {
          id: submission.user.id,
          fullName: submission.user.fullName,
          employeeCode: submission.user.employeeCode,
          email: submission.user.email,
          department: submission.user.department?.name ?? null,
        },
        answer: submission.answer
          ? {
              id: submission.answer.id,
              complianceStatus: submission.answer.complianceStatus,
              accuracyStatus: submission.answer.accuracyStatus,
              comments: submission.answer.comments,
              correctiveAction: submission.answer.correctiveAction,
            }
          : null,
        evidence: submission.evidence.map((e) => ({
          id: e.id,
          originalName: e.originalName,
          mimeType: e.mimeType,
          fileSize: e.fileSize,
          publicUrl: e.publicUrl,
          createdAt: e.createdAt,
        })),
        reviewedBy: submission.reviewedBy
          ? {
              id: submission.reviewedBy.id,
              fullName: submission.reviewedBy.fullName,
            }
          : null,
        createdAt: submission.createdAt,
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
    console.error('Supervisor approval detail GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supervisor = await requireAuth()

    if (supervisor.role.name !== 'SUPERVISOR' && supervisor.role.name !== 'ADMIN' && supervisor.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status, comment } = body as { status?: string; comment?: string }

    if (!status || !['APPROVED', 'REJECTED', 'ESCALATED'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status must be APPROVED, REJECTED, or ESCALATED' },
        { status: 400 }
      )
    }

    const submission = await prisma.checkpointSubmission.findUnique({
      where: { id },
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
      reviewedById: supervisor.id,
      reviewComment: comment || null,
    }

    if (status === 'APPROVED') {
      updateData.status = 'APPROVED'
      updateData.approvedAt = new Date()
    } else if (status === 'REJECTED') {
      updateData.status = 'REJECTED'
      updateData.rejectedAt = new Date()
    } else {
      updateData.status = 'REJECTED'
      updateData.rejectedAt = new Date()
      updateData.reviewComment = `[ESCALATED] ${comment || ''}`
    }

    await prisma.checkpointSubmission.update({
      where: { id },
      data: updateData,
    })

    const auditAction =
      status === 'APPROVED'
        ? 'SUBMISSION_APPROVED'
        : status === 'REJECTED'
          ? 'SUBMISSION_REJECTED'
          : 'SUBMISSION_REJECTED'

    await createAuditLog({
      userId: supervisor.id,
      action: auditAction,
      entityType: 'checkpoint_submission',
      entityId: id,
      newValues: {
        status,
        comment: comment || null,
        checkpointTitle: submission.checkpoint.title,
        moduleName: submission.checkpoint.module.name,
        submittedBy: submission.user.fullName,
        reviewedBy: supervisor.fullName,
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
    console.error('Supervisor approval PATCH error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update approval' },
      { status: 500 }
    )
  }
}
