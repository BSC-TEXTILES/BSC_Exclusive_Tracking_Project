import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const moduleSlug = searchParams.get('module') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('checkpoint_submissions')
      .select(`
        *,
        checkpoint:checkpoints(id, title, score, module:modules(id, name, slug)),
        answer:submission_answers(*),
        evidence:evidence_files(id)
      `, { count: 'exact' })
      .eq('user_id', user.id)

    if (status) {
      query = query.eq('status', status)
    }

    if (dateFrom) {
      query = query.gte('submission_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('submission_date', dateTo)
    }

    let checkpointIds: string[] = []
    let hasCheckpointFilter = false

    if (moduleSlug) {
      const { data: modules } = await supabase.from('modules').select('id').eq('slug', moduleSlug)
      const moduleIds = (modules ?? []).map((m: any) => m.id)
      const { data: cpIds } = moduleIds.length > 0
        ? await supabase.from('checkpoints').select('id').in('module_id', moduleIds)
        : { data: [] }
      const ids = (cpIds ?? []).map((c: any) => c.id)
      checkpointIds = ids
      hasCheckpointFilter = true
    }

    if (search) {
      const { data: cpIds } = await supabase.from('checkpoints').select('id').ilike('title', `%${search}%`)
      const ids = (cpIds ?? []).map((c: any) => c.id)
      checkpointIds = hasCheckpointFilter ? checkpointIds.filter((id) => ids.includes(id)) : ids
      hasCheckpointFilter = true
    }

    if (hasCheckpointFilter && checkpointIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          submissions: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      })
    }

    if (hasCheckpointFilter) {
      query = query.in('checkpoint_id', checkpointIds)
    }

    const { data: submissions, count: total, error } = await query
      .order('submission_date', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('History API error:', error)
      return NextResponse.json({ success: false, message: 'Internal error', code: 'INTERNAL_ERROR' }, { status: 500 })
    }

    const data = (submissions || []).map((sub: any) => ({
      id: sub.id,
      date: sub.submission_date,
      module: sub.checkpoint?.module?.name,
      moduleSlug: sub.checkpoint?.module?.slug,
      checkpoint: sub.checkpoint?.title,
      compliance: sub.answer?.compliance_status || null,
      accuracy: sub.answer?.accuracy_status || null,
      correctiveAction: sub.answer?.corrective_action || null,
      score: sub.checkpoint?.score,
      status: sub.status,
      evidenceCount: sub.evidence?.length || 0,
      submittedAt: sub.submitted_at,
    }))

    return NextResponse.json({
      success: true,
      data: {
        submissions: data,
        pagination: {
          page,
          limit,
          total: total || 0,
          totalPages: Math.ceil((total || 0) / limit),
        },
      },
    })
  } catch (error) {
    console.error('History API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
