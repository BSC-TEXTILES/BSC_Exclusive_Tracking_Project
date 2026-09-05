import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseServerClient()
    const supervisorDeptId = user.departmentId

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Get department user IDs for department-filtered queries
    let deptUserIds: string[] | null = null
    if (supervisorDeptId) {
      const { data: deptUsers } = await supabase
        .from('users')
        .select('id')
        .eq('department_id', supervisorDeptId)
      deptUserIds = deptUsers?.map((u: any) => u.id) || []
    }

    const hasDeptFilter = deptUserIds !== null

    const [
      totalEmployeesRes,
      activeEmployeesRes,
      assignedDepartmentsRes,
      assignedModulesRes,
      pendingApprovalsRes,
      approvedCountRes,
      rejectedCountRes,
      todaySubmissionsRes,
      totalSubmissionsRes,
      recentActivityRes,
    ] = await Promise.all([
      hasDeptFilter
        ? supabase.from('users').select('*', { count: 'exact', head: true }).in('id', deptUserIds!)
        : supabase.from('users').select('*', { count: 'exact', head: true }),
      hasDeptFilter
        ? supabase.from('users').select('*', { count: 'exact', head: true }).in('id', deptUserIds!).eq('status', 'ACTIVE')
        : supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supervisorDeptId
        ? supabase.from('departments').select('id, name, code').eq('id', supervisorDeptId)
        : Promise.resolve({ data: [] as any[] }),
      supervisorDeptId
        ? supabase.from('modules').select('id, name, slug, display_order').eq('department_id', supervisorDeptId).eq('status', 'ACTIVE').order('display_order', { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      hasDeptFilter
        ? supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED').in('user_id', deptUserIds!)
        : supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
      hasDeptFilter
        ? supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED').in('user_id', deptUserIds!)
        : supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      hasDeptFilter
        ? supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED').in('user_id', deptUserIds!)
        : supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED'),
      hasDeptFilter
        ? supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).gte('submission_date', todayStr).lt('submission_date', tomorrowStr).in('user_id', deptUserIds!)
        : supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).gte('submission_date', todayStr).lt('submission_date', tomorrowStr),
      hasDeptFilter
        ? supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }).in('user_id', deptUserIds!)
        : supabase.from('checkpoint_submissions').select('*', { count: 'exact', head: true }),
      hasDeptFilter
        ? supabase.from('audit_logs').select('*, user:users(id, full_name)').order('created_at', { ascending: false }).limit(10).in('user_id', deptUserIds!)
        : supabase.from('audit_logs').select('*, user:users(id, full_name)').order('created_at', { ascending: false }).limit(10),
    ])

    const totalEmployees = totalEmployeesRes.count || 0
    const activeEmployees = activeEmployeesRes.count || 0
    const assignedDepartments = assignedDepartmentsRes.data || []
    const assignedModules = (assignedModulesRes.data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      displayOrder: m.display_order,
    }))
    const pendingApprovals = pendingApprovalsRes.count || 0
    const approvedCount = approvedCountRes.count || 0
    const rejectedCount = rejectedCountRes.count || 0
    const todaySubmissions = todaySubmissionsRes.count || 0
    const totalSubmissions = totalSubmissionsRes.count || 0

    const completionRate =
      totalSubmissions > 0
        ? Math.round(((approvedCount + rejectedCount) / totalSubmissions) * 100)
        : 0

    const approvalRate =
      approvedCount + rejectedCount > 0
        ? Math.round((approvedCount / (approvedCount + rejectedCount)) * 100)
        : 0

    const recentActivity = (recentActivityRes.data || []).map((log: any) => ({
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      user: log.user?.full_name ?? 'System',
      createdAt: log.created_at,
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalEmployees,
          activeEmployees,
          assignedDepartments: assignedDepartments.length,
          assignedModules: assignedModules.length,
          pendingApprovals,
          approvedCount,
          rejectedCount,
          todaySubmissions,
          totalSubmissions,
          completionRate,
          approvalRate,
        },
        departments: assignedDepartments,
        modules: assignedModules,
        recentActivity,
      },
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }
    console.error('Supervisor dashboard GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}
