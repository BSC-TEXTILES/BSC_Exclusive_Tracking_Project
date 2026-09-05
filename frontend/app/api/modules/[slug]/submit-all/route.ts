import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { getLocalDateString } from '@/lib/utils/date'

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
    const supabase = getSupabaseServerClient()

    const { data: mod } = await supabase
      .from('modules')
      .select('*')
      .eq('slug', moduleSlug)
      .single()

    if (!mod) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const todayStr = getLocalDateString()

    const { data: moduleCheckpoints } = await supabase
      .from('checkpoints')
      .select('id')
      .eq('module_id', mod.id)
      .eq('status', 'ACTIVE')

    const checkpointIds = (moduleCheckpoints || []).map((c: any) => c.id)

    const { data: draftSubmissions } = await supabase
      .from('checkpoint_submissions')
      .select('*, answer:submission_answers(*), evidence:evidence_files(*), checkpoint:checkpoints(*)')
      .eq('user_id', user.id)
      .eq('submission_date', todayStr)
      .eq('status', 'DRAFT')
      .in('checkpoint_id', checkpointIds)

    if (!draftSubmissions || draftSubmissions.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No draft checkpoints to submit' },
        { status: 400 }
      )
    }

    const errors: string[] = []
    const validSubmissions: string[] = []

    for (const sub of draftSubmissions) {
      if (!sub.answer?.compliance_status) {
        errors.push(`"${(sub.checkpoint?.title || '').substring(0, 50)}..." - Please select compliance status`)
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

    const now = new Date().toISOString()
    const { error: submitError } = await supabase
      .from('checkpoint_submissions')
      .update({ status: 'SUBMITTED', submitted_at: now })
      .in('id', validSubmissions)

    if (submitError) {
      console.error('Submit all update error:', submitError)
      return NextResponse.json({ success: false, message: 'Failed to submit' }, { status: 500 })
    }

    await createAuditLog({
      userId: user.id,
      action: 'CHECKPOINT_SUBMITTED',
      entityType: 'module',
      entityId: mod.id,
      newValues: {
        submittedCount: validSubmissions.length,
        moduleSlug,
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
