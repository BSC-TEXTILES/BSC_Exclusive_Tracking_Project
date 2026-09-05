import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
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
    const supabase = getSupabaseServerClient()

    const { data: mod } = await supabase
      .from('modules')
      .select('*, department:departments(*), checkpoints:checkpoints(*)')
      .eq('slug', moduleSlug)
      .single()

    if (!mod) {
      return NextResponse.json(
        { success: false, message: 'Module not found' },
        { status: 404 }
      )
    }

    const activeCheckpoints = (mod.checkpoints || []).filter((cp: any) => cp.status === 'ACTIVE')
    activeCheckpoints.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const checkpointIds = activeCheckpoints.map((cp: any) => cp.id)

    const { data: submissions } = await supabase
      .from('checkpoint_submissions')
      .select('*, answer:submission_answers(*), evidence:evidence_files(*)')
      .eq('user_id', user.id)
      .in('checkpoint_id', checkpointIds)
      .eq('submission_date', todayStr)

    const submissionMap = new Map(
      (submissions || []).map((s: any) => [s.checkpoint_id, s])
    )

    const checkpoints = activeCheckpoints.map((cp: any) => {
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
        displayOrder: cp.display_order,
        isAccuracyRequired: cp.is_accuracy_required,
        isCorrectiveActionRequired: cp.is_corrective_action_required,
        isPhotoRequired: cp.is_photo_required,
        status,
        submissionId: submission?.id ?? null,
        hasAnswer: !!submission?.answer,
        answer: submission?.answer ? {
          complianceStatus: submission.answer.compliance_status,
          accuracyStatus: submission.answer.accuracy_status,
          comments: submission.answer.comments,
          correctiveAction: submission.answer.corrective_action,
        } : null,
        evidence: submission?.evidence ? submission.evidence.map((e: any) => ({
          id: e.id,
          name: e.original_name,
          size: e.file_size,
          storagePath: e.storage_path,
        })) : [],
      }
    })

    const totalCheckpoints = checkpoints.length
    const submittedCount = checkpoints.filter(
      (cp: any) => cp.status === 'SUBMITTED' || cp.status === 'APPROVED'
    ).length

    return NextResponse.json({
      success: true,
      data: {
        module: {
          id: mod.id,
          name: mod.name,
          slug: mod.slug,
          description: mod.description,
          department: mod.department?.name,
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
