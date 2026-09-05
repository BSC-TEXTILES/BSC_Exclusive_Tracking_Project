import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params
    const moduleSlug = slug

    const mod = await prisma.module.findUnique({
      where: { slug: moduleSlug },
    })

    if (!mod) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all draft submissions for this module today
    const draftSubmissions = await prisma.checkpointSubmission.findMany({
      where: {
        userId: user.id,
        submissionDate: today,
        status: 'DRAFT',
        checkpoint: {
          moduleId: mod.id,
        },
      },
      include: {
        answer: true,
        evidence: true,
        checkpoint: true,
      },
    })

    if (draftSubmissions.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No draft checkpoints to submit' },
        { status: 400 }
      )
    }

    // Validate each submission
    const errors: string[] = []
    const validSubmissions: string[] = []

    for (const sub of draftSubmissions) {
      if (!sub.answer?.complianceStatus) {
        errors.push(`"${sub.checkpoint.title.substring(0, 50)}..." - Please select compliance status`)
      } else {
        validSubmissions.push(sub.id)
      }
    }

    if (validSubmissions.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Please select compliance status for at least one checkpoint before submitting.', errors },
        { status: 400 }
      )
    }

    // Submit valid submissions
    const now = new Date()
    await prisma.checkpointSubmission.updateMany({
      where: { id: { in: validSubmissions } },
      data: {
        status: 'SUBMITTED',
        submittedAt: now,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CHECKPOINT_SUBMITTED',
        entityType: 'module',
        entityId: mod.id,
        newValues: {
          submittedCount: validSubmissions.length,
          moduleSlug,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${validSubmissions.length} checkpoint(s)`,
      data: {
        submittedCount: validSubmissions.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error) {
    console.error('Submit all error:', error)
    return NextResponse.json({ success: false, message: 'Failed to submit' }, { status: 500 })
  }
}
