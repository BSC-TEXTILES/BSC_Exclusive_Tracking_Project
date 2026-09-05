import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
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
    const supabase = getSupabaseServerClient()

    const { data: submission } = await supabase
      .from('checkpoint_submissions')
      .select(`
        *,
        checkpoint:checkpoints(id, title, description, score, is_accuracy_required, is_photo_required, module:modules(id, name, slug)),
        user:users!user_id(id, full_name, employee_code, email, department_id, department:departments(name)),
        answer:submission_answers(*),
        evidence:evidence_files(*),
        reviewedBy:users!reviewed_by(id, full_name)
      `)
      .eq('id', id)
      .single()

    if (!submission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      )
    }

    if (
      user.departmentId &&
      submission.user?.department_id !== user.departmentId
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
        submissionDate: submission.submission_date,
        submittedAt: submission.submitted_at,
        approvedAt: submission.approved_at,
        rejectedAt: submission.rejected_at,
        reviewComment: submission.review_comment,
        checkpoint: {
          id: submission.checkpoint?.id,
          title: submission.checkpoint?.title,
          description: submission.checkpoint?.description,
          score: submission.checkpoint?.score,
          isAccuracyRequired: submission.checkpoint?.is_accuracy_required,
          isPhotoRequired: submission.checkpoint?.is_photo_required,
        },
        module: {
          id: submission.checkpoint?.module?.id,
          name: submission.checkpoint?.module?.name,
          slug: submission.checkpoint?.module?.slug,
        },
        employee: {
          id: submission.user?.id,
          fullName: submission.user?.full_name,
          employeeCode: submission.user?.employee_code,
          email: submission.user?.email,
          department: submission.user?.department?.name ?? null,
        },
        answer: submission.answer
          ? {
              id: submission.answer.id,
              complianceStatus: submission.answer.compliance_status,
              accuracyStatus: submission.answer.accuracy_status,
              comments: submission.answer.comments,
              correctiveAction: submission.answer.corrective_action,
            }
          : null,
        evidence: (submission.evidence || []).map((e: any) => ({
          id: e.id,
          originalName: e.original_name,
          mimeType: e.mime_type,
          fileSize: e.file_size,
          publicUrl: e.public_url,
          createdAt: e.created_at,
        })),
        reviewedBy: submission.reviewedBy
          ? {
              id: submission.reviewedBy.id,
              fullName: submission.reviewedBy.full_name,
            }
          : null,
        createdAt: submission.created_at,
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
    const supabase = getSupabaseServerClient()
    const body = await request.json()
    const { status, comment } = body as { status?: string; comment?: string }

    if (!status || !['APPROVED', 'REJECTED', 'ESCALATED'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status must be APPROVED, REJECTED, or ESCALATED' },
        { status: 400 }
      )
    }

    const { data: submission } = await supabase
      .from('checkpoint_submissions')
      .select(`
        *,
        checkpoint:checkpoints(title, module:modules(name)),
        user:users!user_id(id, full_name, department_id)
      `)
      .eq('id', id)
      .single()

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
      submission.user?.department_id !== supervisor.departmentId
    ) {
      return NextResponse.json(
        { success: false, message: 'Submission is not from your department' },
        { status: 403 }
      )
    }

    const updateData: Record<string, unknown> = {
      reviewed_by: supervisor.id,
      review_comment: comment || null,
    }

    if (status === 'APPROVED') {
      updateData.status = 'APPROVED'
      updateData.approved_at = new Date().toISOString()
    } else if (status === 'REJECTED') {
      updateData.status = 'REJECTED'
      updateData.rejected_at = new Date().toISOString()
    } else {
      updateData.status = 'REJECTED'
      updateData.rejected_at = new Date().toISOString()
      updateData.review_comment = `[ESCALATED] ${comment || ''}`
    }

    await supabase
      .from('checkpoint_submissions')
      .update(updateData)
      .eq('id', id)

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
        checkpointTitle: submission.checkpoint?.title,
        moduleName: submission.checkpoint?.module?.name,
        submittedBy: submission.user?.full_name,
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
