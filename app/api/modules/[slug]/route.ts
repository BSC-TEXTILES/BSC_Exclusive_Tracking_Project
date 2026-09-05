import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { slug } = await params
    const moduleSlug = slug

    // Get the module
    const mod = await prisma.module.findUnique({
      where: { slug: moduleSlug },
      include: {
        department: true,
        checkpoints: {
          where: { status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    if (!mod) {
      return NextResponse.json(
        { success: false, message: 'Module not found' },
        { status: 404 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get today's submissions for each checkpoint
    const submissions = await prisma.checkpointSubmission.findMany({
      where: {
        userId: user.id,
        checkpointId: { in: mod.checkpoints.map(cp => cp.id) },
        submissionDate: today,
      },
      include: {
        answer: true,
        evidence: true,
      },
    })

    const submissionMap = new Map(
      submissions.map(s => [s.checkpointId, s])
    )

    // Build checkpoint data with status
    const checkpoints = mod.checkpoints.map(cp => {
      const submission = submissionMap.get(cp.id)
      let status = 'PENDING'

      if (submission) {
        status = submission.status
      }

      return {
        id: cp.id,
        title: cp.title,
        description: cp.description,
        score: cp.score,
        displayOrder: cp.displayOrder,
        isAccuracyRequired: cp.isAccuracyRequired,
        isCorrectiveActionRequired: cp.isCorrectiveActionRequired,
        isPhotoRequired: cp.isPhotoRequired,
        status,
        submissionId: submission?.id ?? null,
        hasAnswer: !!submission?.answer,
        answer: submission?.answer ? {
          complianceStatus: submission.answer.complianceStatus,
          accuracyStatus: submission.answer.accuracyStatus,
          comments: submission.answer.comments,
          correctiveAction: submission.answer.correctiveAction,
        } : null,
        evidence: submission?.evidence ? submission.evidence.map(e => ({
          id: e.id,
          name: e.originalName,
          size: e.fileSize,
          storagePath: e.storagePath,
        })) : [],
      }
    })

    const totalCheckpoints = checkpoints.length
    const submittedCount = checkpoints.filter(
      cp => cp.status === 'SUBMITTED' || cp.status === 'APPROVED'
    ).length

    return NextResponse.json({
      success: true,
      data: {
        module: {
          id: mod.id,
          name: mod.name,
          slug: mod.slug,
          description: mod.description,
          department: mod.department.name,
        },
        checkpoints,
        totalCheckpoints,
        submittedCount,
      },
    })
  } catch (error) {
    console.error('Module detail API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}
