import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()
    const isAdmin = user.role.name === 'ADMIN'
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const moduleId = searchParams.get('moduleId') || ''
    const status = searchParams.get('status') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('checkpoint_submissions')
      .select(`
        *,
        checkpoint:checkpoints(id, title, score, module:modules(id, name)),
        user:users!user_id(id, full_name, employee_code),
        answer:submission_answers(*)
      `, { count: 'exact' })

    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    if (moduleId) {
      query = query.eq('checkpoint.module_id', moduleId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    if (dateFrom) {
      query = query.gte('submission_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('submission_date', dateTo)
    }

    const { data: submissions, count: total, error } = await query
      .order('submission_date', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Submission history GET error:', error)
      return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        submissions: (submissions || []).map((s: any) => ({
          id: s.id,
          status: s.status,
          submissionDate: s.submission_date,
          submittedAt: s.submitted_at,
          approvedAt: s.approved_at,
          rejectedAt: s.rejected_at,
          reviewComment: s.review_comment,
          checkpoint: {
            id: s.checkpoint?.id,
            title: s.checkpoint?.title,
            score: s.checkpoint?.score,
          },
          module: {
            id: s.checkpoint?.module?.id,
            name: s.checkpoint?.module?.name,
          },
          user: {
            id: s.user?.id,
            fullName: s.user?.full_name,
            employeeCode: s.user?.employee_code,
          },
          answer: s.answer ? {
            complianceStatus: s.answer.compliance_status,
            accuracyStatus: s.answer.accuracy_status,
            comments: s.answer.comments,
            correctiveAction: s.answer.corrective_action,
          } : null,
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
    console.error('Submission history GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
