import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const checkpoint = await prisma.checkpoint.findUnique({
      where: { id },
      include: {
        module: {
          include: { department: true },
        },
      },
    })

    if (!checkpoint) {
      return NextResponse.json({ success: false, message: 'Checkpoint not found' }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find existing submission for today
    const submission = await prisma.checkpointSubmission.findFirst({
      where: {
        checkpointId: id,
        userId: user.id,
        submissionDate: today,
      },
      include: {
        answer: true,
        evidence: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        checkpoint: {
          id: checkpoint.id,
          title: checkpoint.title,
          description: checkpoint.description,
          score: checkpoint.score,
          isAccuracyRequired: checkpoint.isAccuracyRequired,
          isCorrectiveActionRequired: checkpoint.isCorrectiveActionRequired,
          isPhotoRequired: checkpoint.isPhotoRequired,
          moduleName: checkpoint.module.name,
          moduleSlug: checkpoint.module.slug,
          departmentName: checkpoint.module.department.name,
        },
        submission: submission ? {
          id: submission.id,
          status: submission.status,
          answer: submission.answer ? {
            complianceStatus: submission.answer.complianceStatus,
            accuracyStatus: submission.answer.accuracyStatus,
            comments: submission.answer.comments,
            correctiveAction: submission.answer.correctiveAction,
          } : null,
          evidence: submission.evidence.map(e => ({
            id: e.id,
            originalName: e.originalName,
            mimeType: e.mimeType,
            fileSize: e.fileSize,
            storagePath: e.storagePath,
          })),
        } : null,
      },
    })
  } catch (error) {
    console.error('Checkpoint detail error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

// Save draft or update submission answer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find or create submission
    let submission = await prisma.checkpointSubmission.findFirst({
      where: {
        checkpointId: id,
        userId: user.id,
        submissionDate: today,
      },
    })

    if (!submission) {
      // Find assignment
      const assignment = await prisma.checkpointAssignment.findFirst({
        where: {
          checkpointId: id,
          userId: user.id,
          assignedDate: today,
        },
      })

      submission = await prisma.checkpointSubmission.create({
        data: {
          checkpointId: id,
          userId: user.id,
          assignmentId: assignment?.id,
          submissionDate: today,
          status: 'DRAFT',
        },
      })
    }

    // Don't allow editing submitted/approved submissions
    if (submission.status === 'SUBMITTED' || submission.status === 'APPROVED') {
      return NextResponse.json(
        { success: false, message: 'Cannot edit a submitted checkpoint' },
        { status: 400 }
      )
    }

    // Upsert the answer
    await prisma.submissionAnswer.upsert({
      where: { submissionId: submission.id },
      update: {
        complianceStatus: body.complianceStatus || null,
        accuracyStatus: body.accuracyStatus || null,
        comments: body.comments || null,
        correctiveAction: body.correctiveAction || null,
      },
      create: {
        submissionId: submission.id,
        complianceStatus: body.complianceStatus || null,
        accuracyStatus: body.accuracyStatus || null,
        comments: body.comments || null,
        correctiveAction: body.correctiveAction || null,
      },
    })

    // Update submission status to DRAFT if it was PENDING or REJECTED
    if (submission.status === 'PENDING' || submission.status === 'REJECTED') {
      await prisma.checkpointSubmission.update({
        where: { id: submission.id },
        data: { status: 'DRAFT' },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Draft saved',
      data: { submissionId: submission.id },
    })
  } catch (error) {
    console.error('Save draft error:', error)
    return NextResponse.json({ success: false, message: 'Failed to save' }, { status: 500 })
  }
}

// Submit checkpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get checkpoint config
    const checkpoint = await prisma.checkpoint.findUnique({ where: { id } })
    if (!checkpoint) {
      return NextResponse.json({ success: false, message: 'Checkpoint not found' }, { status: 404 })
    }

    // Find submission
    const submission = await prisma.checkpointSubmission.findFirst({
      where: {
        checkpointId: id,
        userId: user.id,
        submissionDate: today,
      },
      include: {
        answer: true,
        evidence: true,
      },
    })

    if (!submission) {
      return NextResponse.json(
        { success: false, message: 'Please complete the checkpoint form first' },
        { status: 400 }
      )
    }

    if (submission.status === 'SUBMITTED' || submission.status === 'APPROVED') {
      return NextResponse.json(
        { success: false, message: 'Already submitted' },
        { status: 400 }
      )
    }

    // Validate required fields
    const errors: string[] = []
    if (!submission.answer?.complianceStatus) {
      errors.push('Compliance status is required')
    }

    if (checkpoint.isAccuracyRequired && !submission.answer?.accuracyStatus) {
      errors.push('Accuracy status is required')
    }

    // Check corrective action requirement
    const compliance = submission.answer?.complianceStatus
    if (
      compliance &&
      ['NOT_FOLLOWED', 'PARTIALLY_FOLLOWED', 'YET_TO_IMPLEMENT'].includes(compliance) &&
      !submission.answer?.correctiveAction?.trim()
    ) {
      errors.push('Corrective action is required for this compliance status')
    }

    if (checkpoint.isPhotoRequired && submission.evidence.length === 0) {
      errors.push('Photo evidence is required')
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, message: errors.join('. '), errors },
        { status: 400 }
      )
    }

    // Submit
    await prisma.checkpointSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CHECKPOINT_SUBMITTED',
        entityType: 'checkpoint_submission',
        entityId: submission.id,
        newValues: {
          checkpointId: id,
          compliance: submission.answer?.complianceStatus,
          accuracy: submission.answer?.accuracyStatus,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Checkpoint submitted successfully',
    })
  } catch (error) {
    console.error('Submit checkpoint error:', error)
    return NextResponse.json({ success: false, message: 'Failed to submit' }, { status: 500 })
  }
}
