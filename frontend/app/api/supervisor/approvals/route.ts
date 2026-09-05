import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
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

    const supabase = getSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || 'SUBMITTED'

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('checkpoint_submissions')
      .select(`
        *,
        checkpoint:checkpoints(id, title, score, module:modules(id, name, slug)),
        user:users!user_id(id, full_name, employee_code, department_id),
        answer:submission_answers(*),
        evidence:evidence_files(*)
      `, { count: 'exact' })
      .eq('status', status)

    if (user.departmentId) {
      query = query.eq('user.department_id', user.departmentId)
    }

    const { data: submissions, count: total, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Supervisor approvals GET error:', error)
      return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        approvals: (submissions || []).map((s: any) => ({
          id: s.id,
          status: s.status,
          submissionDate: s.submission_date,
          submittedAt: s.submitted_at,
          reviewComment: s.review_comment,
          checkpoint: {
            id: s.checkpoint?.id,
            title: s.checkpoint?.title,
            score: s.checkpoint?.score,
          },
          module: {
            id: s.checkpoint?.module?.id,
            name: s.checkpoint?.module?.name,
            slug: s.checkpoint?.module?.slug,
          },
          employee: {
            id: s.user?.id,
            fullName: s.user?.full_name,
            employeeCode: s.user?.employee_code,
          },
          hasAnswer: !!s.answer,
          evidenceCount: s.evidence?.length || 0,
          createdAt: s.created_at,
        })),
        pagination: {
          page,
          limit,
          total: total || 0,
          totalPages: Math.ceil((total || 0) / limit),
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

    const supabase = getSupabaseServerClient()
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

    const { data: submission } = await supabase
      .from('checkpoint_submissions')
      .select(`
        *,
        checkpoint:checkpoints(title, module:modules(name)),
        user:users!user_id(id, full_name, department_id)
      `)
      .eq('id', submissionId)
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
      status,
      reviewed_by: supervisor.id,
      review_comment: comment || null,
    }

    if (status === 'APPROVED') {
      updateData.approved_at = new Date().toISOString()
    } else {
      updateData.rejected_at = new Date().toISOString()
    }

    await supabase
      .from('checkpoint_submissions')
      .update(updateData)
      .eq('id', submissionId)

    await createAuditLog({
      userId: supervisor.id,
      action: status === 'APPROVED' ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REJECTED',
      entityType: 'checkpoint_submission',
      entityId: submissionId,
      newValues: {
        status,
        comment: comment || null,
        checkpointTitle: submission.checkpoint?.title,
        moduleName: submission.checkpoint?.module?.name,
        submittedBy: submission.user?.full_name,
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
