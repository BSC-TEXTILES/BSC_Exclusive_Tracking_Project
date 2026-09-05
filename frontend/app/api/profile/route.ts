import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'
import { getLocalDateString } from '@/lib/utils/date'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseServerClient()

    const sevenDaysAgoStr = getLocalDateString(new Date(Date.now() - 7 * 864e5))
    const monthStartStr = getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

    const [
      totalSubmissions,
      approvedCount,
      rejectedCount,
      pendingCount,
      draftCount,
      thisWeekSubmissions,
      thisMonthSubmissions,
    ] = await Promise.all([
      supabase
        .from('checkpoint_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('checkpoint_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'APPROVED'),
      supabase
        .from('checkpoint_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'REJECTED'),
      supabase
        .from('checkpoint_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'PENDING'),
      supabase
        .from('checkpoint_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'DRAFT'),
      supabase
        .from('checkpoint_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('submission_date', sevenDaysAgoStr),
      supabase
        .from('checkpoint_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('submission_date', monthStartStr),
    ])

    const ts = totalSubmissions.count ?? 0
    const ac = approvedCount.count ?? 0

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          employeeCode: user.employee_code,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role.name,
          department: user.department?.name ?? null,
          status: user.status,
          lastLoginAt: user.last_login_at,
          createdAt: user.created_at,
        },
        stats: {
          totalSubmissions: ts,
          approvedCount: ac,
          rejectedCount: rejectedCount.count ?? 0,
          pendingCount: pendingCount.count ?? 0,
          draftCount: draftCount.count ?? 0,
          thisWeekSubmissions: thisWeekSubmissions.count ?? 0,
          thisMonthSubmissions: thisMonthSubmissions.count ?? 0,
          approvalRate: ts > 0 ? Math.round((ac / ts) * 100) : 0,
        },
      },
    })
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
