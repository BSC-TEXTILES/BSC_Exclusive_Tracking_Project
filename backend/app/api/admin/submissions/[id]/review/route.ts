import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const { status, comment } = body as { status: string; comment?: string }

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status must be APPROVED or REJECTED' },
        { status: 400 }
      )
    }

    const submission = await prisma.checkpointSubmission.findUnique({
      where: { id },
      include: {
        checkpoint: { include: { module: true } },
        user: { select: { id: true, fullName: true } },
      },
    })

    if (!submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 })
    }

    if (submission.status !== 'SUBMITTED') {
      return NextResponse.json(
        { success: false, message: 'Only submitted checkpoints can be reviewed' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      status,
      reviewedById: admin.id,
      reviewComment: comment || null,
    }

    if (status === 'APPROVED') {
      updateData.approvedAt = new Date()
    } else {
      updateData.rejectedAt = new Date()
    }

    await prisma.checkpointSubmission.update({
      where: { id },
      data: updateData,
    })

    await createAuditLog({
      userId: admin.id,
      action: status === 'APPROVED' ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REJECTED',
      entityType: 'checkpoint_submission',
      entityId: id,
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
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Review submission error:', error)
    return NextResponse.json({ success: false, message: 'Failed to review submission' }, { status: 500 })
  }
}
