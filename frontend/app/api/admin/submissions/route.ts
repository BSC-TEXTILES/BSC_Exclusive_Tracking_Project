import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('userId') || ''
    const moduleId = searchParams.get('moduleId') || ''
    const status = searchParams.get('status') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const search = searchParams.get('search') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('checkpoint_submissions')
      .select(`*, checkpoint:checkpoints(id, title, score, module:modules(id, name)), user:users!user_id(id, full_name, employee_code), reviewed_by:users!reviewed_by(id, full_name), answer:submission_answers(compliance_status, accuracy_status, comments, corrective_action)`, { count: 'exact' })
      .order('submission_date', { ascending: false })
      .range(from, to)

    if (userId) query = query.eq('user_id', userId)
    if (status) query = query.eq('status', status)
    if (moduleId) {
      const { data: checkpointIds } = await supabase.from('checkpoints').select('id').eq('module_id', moduleId)
      if (checkpointIds && checkpointIds.length > 0) {
        query = query.in('checkpoint_id', checkpointIds.map(c => c.id))
      } else {
        return NextResponse.json({ success: true, data: { submissions: [], pagination: { page, limit, total: 0, totalPages: 0 } } })
      }
    }
    if (dateFrom) query = query.gte('submission_date', dateFrom)
    if (dateTo) query = query.lte('submission_date', dateTo + 'T23:59:59.999Z')
    if (search) {
      const { data: matchedUsers } = await supabase
        .from('users')
        .select('id')
        .or(`full_name.ilike.%${search}%,employee_code.ilike.%${search}%`)
      if (matchedUsers && matchedUsers.length > 0) {
        query = query.in('user_id', matchedUsers.map(u => u.id))
      } else {
        return NextResponse.json({ success: true, data: { submissions: [], pagination: { page, limit, total: 0, totalPages: 0 } } })
      }
    }

    const { data: submissions, count } = await query

    return NextResponse.json({
      success: true,
      data: {
        submissions: (submissions ?? []).map((s: Record<string, unknown>) => {
          const cp = s.checkpoint as Record<string, unknown> | null
          const mod = cp?.module as Record<string, unknown> | null
          const usr = s.user as Record<string, unknown> | null
          const rev = s.reviewed_by as Record<string, unknown> | null
          const ans = s.answer as Record<string, unknown> | null
          return {
            id: s.id,
            status: s.status,
            submissionDate: s.submission_date,
            submittedAt: s.submitted_at,
            approvedAt: s.approved_at,
            rejectedAt: s.rejected_at,
            reviewComment: s.review_comment,
            reviewedBy: rev ? { id: rev.id, fullName: rev.full_name } : null,
            checkpoint: cp ? { id: cp.id, title: cp.title, score: cp.score } : null,
            module: mod ? { id: mod.id, name: mod.name } : null,
            user: usr ? { id: usr.id, fullName: usr.full_name, employeeCode: usr.employee_code } : null,
            answer: ans ? {
              complianceStatus: ans.compliance_status,
              accuracyStatus: ans.accuracy_status,
              comments: ans.comments,
              correctiveAction: ans.corrective_action,
            } : null,
            createdAt: s.created_at,
          }
        }),
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit),
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin submissions GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
