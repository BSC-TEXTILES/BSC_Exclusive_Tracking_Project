import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'

export async function GET() {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayStr = today.toISOString()
    const tomorrowStr = tomorrow.toISOString()

    const [
      totalUsersRes,
      activeUsersRes,
      totalModulesRes,
      activeModulesRes,
      totalCheckpointsRes,
      activeCheckpointsRes,
      todaySubmissionsRes,
      totalSubmissionsRes,
      approvedSubmissionsRes,
      rejectedSubmissionsRes,
      pendingSubmissionsRes,
      totalDepartmentsRes,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('modules').select('*', { count: 'exact', head: true }),
      supabase.from('modules').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('checkpoints').select('*', { count: 'exact', head: true }),
      supabase.from('checkpoints').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).gte('submission_date', todayStr).lt('submission_date', tomorrowStr),
      supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }),
      supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED'),
      supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
      supabase.from('departments').select('*', { count: 'exact', head: true }),
    ])

    const totalUsers = totalUsersRes.count ?? 0
    const activeUsers = activeUsersRes.count ?? 0
    const totalModules = totalModulesRes.count ?? 0
    const activeModules = activeModulesRes.count ?? 0
    const totalCheckpoints = totalCheckpointsRes.count ?? 0
    const activeCheckpoints = activeCheckpointsRes.count ?? 0
    const todaySubmissions = todaySubmissionsRes.count ?? 0
    const totalSubmissions = totalSubmissionsRes.count ?? 0
    const approvedSubmissions = approvedSubmissionsRes.count ?? 0
    const rejectedSubmissions = rejectedSubmissionsRes.count ?? 0
    const pendingSubmissions = pendingSubmissionsRes.count ?? 0
    const totalDepartments = totalDepartmentsRes.count ?? 0

    const completionRate = totalSubmissions > 0
      ? Math.round(((approvedSubmissions + rejectedSubmissions) / totalSubmissions) * 100)
      : 0

    const approvalRate = (approvedSubmissions + rejectedSubmissions) > 0
      ? Math.round((approvedSubmissions / (approvedSubmissions + rejectedSubmissions)) * 100)
      : 0

    const { data: recentActivity } = await supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, created_at, user:users(id, full_name)')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          totalModules,
          activeModules,
          totalCheckpoints,
          activeCheckpoints,
          totalDepartments,
          todaySubmissions,
          totalSubmissions,
          approvedSubmissions,
          rejectedSubmissions,
          pendingSubmissions,
          completionRate,
          approvalRate,
        },
        recentActivity: (recentActivity ?? []).map((log: Record<string, unknown>) => {
          const user = log.user as Record<string, unknown> | null
          return {
            id: log.id,
            action: log.action,
            entityType: log.entity_type,
            entityId: log.entity_id,
            user: (user?.full_name as string) ?? 'System',
            createdAt: log.created_at,
          }
        }),
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
