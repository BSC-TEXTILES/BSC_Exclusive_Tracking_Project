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
    const range = searchParams.get('range') || 'all'
    const moduleId = searchParams.get('moduleId') || ''

    let query = supabase
      .from('checkpoint_submissions')
      .select(`
        *,
        checkpoint:checkpoints(id, title, module_id, module:modules(id, name, slug)),
        answer:submission_answers(*),
        evidence:evidence_files(id)
      `)
      .eq('user_id', user.id)

    if (moduleId) {
      query = query.eq('checkpoint.module_id', moduleId)
    }

    const now = new Date()
    if (range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      query = query.gte('submission_date', startOfDay.toISOString().split('T')[0])
    } else if (range === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      query = query.gte('submission_date', sevenDaysAgo.toISOString().split('T')[0])
    } else if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      query = query.gte('submission_date', startOfMonth.toISOString().split('T')[0])
    }

    const { data: submissions } = await query.order('submission_date', { ascending: false })

    const { data: allModules } = await supabase
      .from('modules')
      .select('*, checkpoints:checkpoints(id, title)')
      .eq('status', 'ACTIVE')
      .order('display_order', { ascending: true })

    const subs = submissions || []
    const totalSubmissions = subs.length
    const approved = subs.filter((s: any) => s.status === 'APPROVED').length
    const rejected = subs.filter((s: any) => s.status === 'REJECTED').length
    const pending = subs.filter((s: any) => s.status === 'SUBMITTED' || s.status === 'PENDING').length
    const drafts = subs.filter((s: any) => s.status === 'DRAFT').length

    const compliantCount = subs.filter((s: any) =>
      s.answer?.compliance_status === 'FULLY_FOLLOWED' || s.answer?.compliance_status === 'PARTIALLY_FOLLOWED'
    ).length
    const accurateCount = subs.filter((s: any) =>
      s.answer?.accuracy_status === 'FULLY_ACCURATE' || s.answer?.accuracy_status === 'PARTLY_ACCURATE'
    ).length

    const complianceRate = totalSubmissions > 0 ? Math.round((compliantCount / totalSubmissions) * 100) : 100
    const accuracyRate = totalSubmissions > 0 ? Math.round((accurateCount / totalSubmissions) * 100) : 100

    const moduleBreakdown = (allModules || []).map((m: any) => {
      const moduleSubs = subs.filter((s: any) => s.checkpoint?.module_id === m.id)
      const modCompliant = moduleSubs.filter((s: any) =>
        s.answer?.compliance_status === 'FULLY_FOLLOWED' || s.answer?.compliance_status === 'PARTIALLY_FOLLOWED'
      ).length
      return {
        id: m.id,
        name: m.name,
        slug: m.slug,
        totalCheckpoints: m.checkpoints?.length || 0,
        submissionsCount: moduleSubs.length,
        approvedCount: moduleSubs.filter((s: any) => s.status === 'APPROVED').length,
        pendingCount: moduleSubs.filter((s: any) => s.status === 'SUBMITTED' || s.status === 'PENDING').length,
        complianceRate: moduleSubs.length > 0 ? Math.round((modCompliant / moduleSubs.length) * 100) : 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          employeeCode: user.employeeCode,
          email: user.email,
          role: user.role.name,
          department: user.department?.name ?? 'Operations',
        },
        summary: {
          totalSubmissions,
          approved,
          rejected,
          pending,
          drafts,
          complianceRate,
          accuracyRate,
        },
        moduleBreakdown,
        recentSubmissions: subs.slice(0, 15).map((s: any) => ({
          id: s.id,
          checkpointTitle: s.checkpoint?.title,
          moduleName: s.checkpoint?.module?.name,
          status: s.status,
          complianceStatus: s.answer?.compliance_status || 'N/A',
          accuracyStatus: s.answer?.accuracy_status || 'N/A',
          submissionDate: s.submission_date,
          evidenceCount: s.evidence?.length || 0,
        })),
      },
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseServerClient()
    const body = await request.json().catch(() => ({}))
    const range = body.range || 'all'

    let query = supabase
      .from('checkpoint_submissions')
      .select(`
        *,
        checkpoint:checkpoints(title, module:modules(name)),
        answer:submission_answers(*)
      `)
      .eq('user_id', user.id)

    const now = new Date()
    if (range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      query = query.gte('submission_date', startOfDay.toISOString().split('T')[0])
    } else if (range === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      query = query.gte('submission_date', sevenDaysAgo.toISOString().split('T')[0])
    } else if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      query = query.gte('submission_date', startOfMonth.toISOString().split('T')[0])
    }

    const { data: submissions } = await query.order('submission_date', { ascending: false })

    let csv = 'Date,Module,Checkpoint,Status,Compliance,Accuracy,Comments\n'
    for (const s of (submissions || []) as any[]) {
      csv += [
        s.submission_date,
        `"${(s.checkpoint?.module?.name || '').replace(/"/g, '""')}"`,
        `"${(s.checkpoint?.title || '').replace(/"/g, '""')}"`,
        s.status,
        s.answer?.compliance_status || 'N/A',
        s.answer?.accuracy_status || 'N/A',
        `"${(s.answer?.comments || '').replace(/"/g, '""')}"`,
      ].join(',') + '\n'
    }

    const filename = `bsc-exclusive-report-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Reports Export error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
