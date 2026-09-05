import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { safeJson } from '@/lib/utils/parse'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await safeJson(request)
    if (body === null) {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const { status, comment } = body as { status: string; comment?: string }

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status must be APPROVED or REJECTED' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServerClient()

    const { data: submission } = await supabase
      .from('checkpoint_submissions')
      .select('id, status, checkpoint:checkpoints(id, title, module:modules(id, name)), user:users!user_id(id, full_name)')
      .eq('id', id)
      .single()

    if (!submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 })
    }

    if (submission.status !== 'SUBMITTED') {
      return NextResponse.json(
        { success: false, message: 'Only submitted checkpoints can be reviewed' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      status,
      reviewed_by: admin.id,
      review_comment: comment || null,
    }

    if (status === 'APPROVED') {
      updateData.approved_at = now
    } else {
      updateData.rejected_at = now
    }

    const { error: updateError } = await supabase
      .from('checkpoint_submissions')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      console.error('Review submission update error:', updateError)
      return NextResponse.json({ success: false, message: 'Failed to review submission' }, { status: 500 })
    }

    const cp = submission.checkpoint as unknown as Record<string, unknown> | null
    const mod = cp?.module as unknown as Record<string, unknown> | null
    const usr = submission.user as unknown as Record<string, unknown> | null

    await createAuditLog({
      userId: admin.id,
      action: status === 'APPROVED' ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REJECTED',
      entityType: 'checkpoint_submission',
      entityId: id,
      newValues: {
        status,
        comment: comment || null,
        checkpointTitle: cp?.title,
        moduleName: mod?.name,
        submittedBy: usr?.full_name,
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
