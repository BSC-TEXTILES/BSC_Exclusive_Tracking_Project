import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { safeJson } from '@/lib/utils/parse'
import { getLocalDateString } from '@/lib/utils/date'

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
    const supabase = getSupabaseServerClient()

    const { data: checkpoint } = await supabase
      .from('checkpoints')
      .select('*, module:modules(*, department:departments(*))')
      .eq('id', id)
      .single()

    if (!checkpoint) {
      return NextResponse.json({ success: false, message: 'Checkpoint not found' }, { status: 404 })
    }

    const todayStr = getLocalDateString()

    const { data: submissions } = await supabase
      .from('checkpoint_submissions')
      .select('*, answer:submission_answers(*), evidence:evidence_files(*)')
      .eq('checkpoint_id', id)
      .eq('user_id', user.id)
      .eq('submission_date', todayStr)
      .limit(1)

    const submission = submissions?.[0] || null

    return NextResponse.json({
      success: true,
      data: {
        checkpoint: {
          id: checkpoint.id,
          title: checkpoint.title,
          description: checkpoint.description,
          score: checkpoint.score,
          isAccuracyRequired: checkpoint.is_accuracy_required,
          isCorrectiveActionRequired: checkpoint.is_corrective_action_required,
          isPhotoRequired: checkpoint.is_photo_required,
          moduleName: checkpoint.module?.name,
          moduleSlug: checkpoint.module?.slug,
          departmentName: checkpoint.module?.department?.name,
        },
        submission: submission ? {
          id: submission.id,
          status: submission.status,
          answer: submission.answer ? {
            complianceStatus: submission.answer.compliance_status,
            accuracyStatus: submission.answer.accuracy_status,
            comments: submission.answer.comments,
            correctiveAction: submission.answer.corrective_action,
          } : null,
          evidence: (submission.evidence || []).map((e: any) => ({
            id: e.id,
            originalName: e.original_name,
            mimeType: e.mime_type,
            fileSize: e.file_size,
            storagePath: e.storage_path,
          })),
        } : null,
      },
    })
  } catch (error) {
    console.error('Checkpoint detail error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

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
    const supabase = getSupabaseServerClient()
    const body = (await safeJson(request)) as Record<string, any> | null
    if (body === null) {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const todayStr = getLocalDateString()

    const { data: existingSubmissions } = await supabase
      .from('checkpoint_submissions')
      .select('*')
      .eq('checkpoint_id', id)
      .eq('user_id', user.id)
      .eq('submission_date', todayStr)
      .limit(1)

    let submission = existingSubmissions?.[0] || null

    if (!submission) {
      const { data: assignments } = await supabase
        .from('checkpoint_assignments')
        .select('id')
        .eq('checkpoint_id', id)
        .eq('user_id', user.id)
        .eq('assigned_date', todayStr)
        .limit(1)

      const assignment = assignments?.[0] || null

      const { data: newSubmission } = await supabase
        .from('checkpoint_submissions')
        .insert({
          checkpoint_id: id,
          user_id: user.id,
          assignment_id: assignment?.id || null,
          submission_date: todayStr,
          status: 'DRAFT',
        })
        .select()
        .single()

      submission = newSubmission
    }

    if (!submission) {
      return NextResponse.json({ success: false, message: 'Failed to create submission' }, { status: 500 })
    }

    if (submission.status === 'SUBMITTED' || submission.status === 'APPROVED') {
      return NextResponse.json(
        { success: false, message: 'Cannot edit a submitted checkpoint' },
        { status: 400 }
      )
    }

    const answerData = {
      submission_id: submission.id,
      compliance_status: body.complianceStatus || null,
      accuracy_status: body.accuracyStatus || null,
      comments: body.comments || null,
      corrective_action: body.correctiveAction || null,
    }

    const { data: existingAnswer } = await supabase
      .from('submission_answers')
      .select('id')
      .eq('submission_id', submission.id)
      .limit(1)

    if (existingAnswer && existingAnswer.length > 0) {
      await supabase
        .from('submission_answers')
        .update(answerData)
        .eq('submission_id', submission.id)
    } else {
      await supabase
        .from('submission_answers')
        .insert(answerData)
    }

    if (submission.status === 'PENDING' || submission.status === 'REJECTED') {
      await supabase
        .from('checkpoint_submissions')
        .update({ status: 'DRAFT' })
        .eq('id', submission.id)
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
    const supabase = getSupabaseServerClient()

    const todayStr = getLocalDateString()

    const { data: checkpoint } = await supabase
      .from('checkpoints')
      .select('*')
      .eq('id', id)
      .single()

    if (!checkpoint) {
      return NextResponse.json({ success: false, message: 'Checkpoint not found' }, { status: 404 })
    }

    const { data: submissions } = await supabase
      .from('checkpoint_submissions')
      .select('*, answer:submission_answers(*), evidence:evidence_files(*)')
      .eq('checkpoint_id', id)
      .eq('user_id', user.id)
      .eq('submission_date', todayStr)
      .limit(1)

    const submission = submissions?.[0] || null

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

    const errors: string[] = []
    if (!submission.answer?.compliance_status) {
      errors.push('Compliance status is required')
    }

    if (checkpoint.is_accuracy_required && !submission.answer?.accuracy_status) {
      errors.push('Accuracy status is required')
    }

    const compliance = submission.answer?.compliance_status
    if (
      compliance &&
      ['NOT_FOLLOWED', 'PARTIALLY_FOLLOWED', 'YET_TO_IMPLEMENT'].includes(compliance) &&
      !submission.answer?.corrective_action?.trim()
    ) {
      errors.push('Corrective action is required for this compliance status')
    }

    if (checkpoint.is_photo_required && (!submission.evidence || submission.evidence.length === 0)) {
      errors.push('Photo evidence is required')
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, message: errors.join('. '), errors },
        { status: 400 }
      )
    }

    const { error: submitError } = await supabase
      .from('checkpoint_submissions')
      .update({
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', submission.id)

    if (submitError) {
      console.error('Submit checkpoint update error:', submitError)
      return NextResponse.json({ success: false, message: 'Failed to submit' }, { status: 500 })
    }

    await createAuditLog({
      userId: user.id,
      action: 'CHECKPOINT_SUBMITTED',
      entityType: 'checkpoint_submission',
      entityId: submission.id,
      newValues: {
        checkpointId: id,
        compliance: submission.answer?.compliance_status,
        accuracy: submission.answer?.accuracy_status,
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
