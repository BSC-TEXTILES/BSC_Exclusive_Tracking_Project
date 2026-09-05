import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const moduleId = searchParams.get('moduleId') || ''
    const departmentId = searchParams.get('departmentId') || ''
    const userId = searchParams.get('userId') || ''

    let submissionsQuery = supabase
      .from('checkpoint_submissions')
      .select(`id, status, submission_date, checkpoint:checkpoints(id, title, module:modules(id, name, department:departments(id, name))), user:users!user_id(id, full_name, employee_code, department_id), answer:submission_answers(compliance_status, accuracy_status)`)
      .order('submission_date', { ascending: false })

    if (userId) submissionsQuery = submissionsQuery.eq('user_id', userId)
    if (dateFrom) submissionsQuery = submissionsQuery.gte('submission_date', dateFrom)
    if (dateTo) submissionsQuery = submissionsQuery.lte('submission_date', dateTo + 'T23:59:59.999Z')
    if (moduleId) {
      const { data: cpIds } = await supabase.from('checkpoints').select('id').eq('module_id', moduleId)
      if (cpIds && cpIds.length > 0) {
        submissionsQuery = submissionsQuery.in('checkpoint_id', cpIds.map(c => c.id))
      }
    }

    let modulesQuery = supabase
      .from('modules')
      .select('id, name, department:departments(id, name), checkpoints(id, submissions:checkpoint_submissions(id, status))')

    let usersQuery = supabase
      .from('users')
      .select('id, full_name, employee_code, role:roles(id, name), department:departments(id, name), checkpoint_submissions(id, status)')

    if (moduleId) modulesQuery = modulesQuery.eq('id', moduleId)
    if (departmentId) {
      modulesQuery = modulesQuery.eq('department_id', departmentId)
      usersQuery = usersQuery.eq('department_id', departmentId)
    }

    const [{ data: submissions }, { data: moduleStats }, { data: userStats }] = await Promise.all([
      submissionsQuery,
      modulesQuery,
      usersQuery,
    ])

    const submissionsList = submissions ?? []

    const summary = {
      totalSubmissions: submissionsList.length,
      approved: submissionsList.filter((s: Record<string, unknown>) => s.status === 'APPROVED').length,
      rejected: submissionsList.filter((s: Record<string, unknown>) => s.status === 'REJECTED').length,
      pending: submissionsList.filter((s: Record<string, unknown>) => s.status === 'SUBMITTED').length,
      draft: submissionsList.filter((s: Record<string, unknown>) => s.status === 'DRAFT').length,
    }

    const byModule = (moduleStats ?? []).map((m: Record<string, unknown>) => {
      const dept = m.department as Record<string, unknown> | null
      const cps = (m.checkpoints as Array<Record<string, unknown>> | null) ?? []
      const allSubmissions = cps.flatMap(cp => (cp.submissions as Array<Record<string, unknown>>) ?? [])
      return {
        moduleId: m.id,
        moduleName: m.name,
        department: dept?.name,
        totalCheckpoints: cps.length,
        totalSubmissions: allSubmissions.length,
        approved: allSubmissions.filter((s: Record<string, unknown>) => s.status === 'APPROVED').length,
        rejected: allSubmissions.filter((s: Record<string, unknown>) => s.status === 'REJECTED').length,
        pending: allSubmissions.filter((s: Record<string, unknown>) => s.status === 'SUBMITTED').length,
      }
    })

    const byUser = (userStats ?? []).map((u: Record<string, unknown>) => {
      const role = u.role as Record<string, unknown> | null
      const dept = u.department as Record<string, unknown> | null
      const subs = (u.checkpoint_submissions as Array<Record<string, unknown>>) ?? []
      return {
        userId: u.id,
        fullName: u.full_name,
        employeeCode: u.employee_code,
        role: role?.name,
        department: dept?.name ?? null,
        totalSubmissions: subs.length,
        approved: subs.filter((s: Record<string, unknown>) => s.status === 'APPROVED').length,
        rejected: subs.filter((s: Record<string, unknown>) => s.status === 'REJECTED').length,
        pending: subs.filter((s: Record<string, unknown>) => s.status === 'SUBMITTED').length,
      }
    })

    return NextResponse.json({
      success: true,
      data: { summary, byModule, byUser },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Reports GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const body = await request.json()
    const { type, dateFrom, dateTo, moduleId, departmentId, userId } = body as {
      type: string
      dateFrom?: string
      dateTo?: string
      moduleId?: string
      departmentId?: string
      userId?: string
    }

    if (!type || !['submissions', 'modules', 'users'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid report type' },
        { status: 400 }
      )
    }

    let csvContent = ''
    let filename = ''

    if (type === 'submissions') {
      let query = supabase
        .from('checkpoint_submissions')
        .select(`id, status, submission_date, checkpoint:checkpoints(id, title, module:modules(id, name)), user:users!user_id(full_name, employee_code), answer:submission_answers(compliance_status, accuracy_status, comments)`)
        .order('submission_date', { ascending: false })

      if (userId) query = query.eq('user_id', userId)
      if (dateFrom) query = query.gte('submission_date', dateFrom)
      if (dateTo) query = query.lte('submission_date', dateTo + 'T23:59:59.999Z')
      if (moduleId) {
        const { data: cpIds } = await supabase.from('checkpoints').select('id').eq('module_id', moduleId)
        if (cpIds && cpIds.length > 0) {
          query = query.in('checkpoint_id', cpIds.map(c => c.id))
        }
      }

      const { data: submissions } = await query

      csvContent = 'Date,User,Employee Code,Module,Checkpoint,Status,Compliance,Accuracy,Comments\n'
      for (const s of submissions ?? []) {
        const sub = s as Record<string, unknown>
        const cp = sub.checkpoint as Record<string, unknown> | null
        const mod = cp?.module as Record<string, unknown> | null
        const usr = sub.user as Record<string, unknown> | null
        const ans = sub.answer as Record<string, unknown> | null
        csvContent += [
          (sub.submission_date as string)?.split('T')?.[0] ?? '',
          usr?.full_name ?? '',
          usr?.employee_code ?? '',
          mod?.name ?? '',
          cp?.title ?? '',
          sub.status ?? '',
          ans?.compliance_status ?? '',
          ans?.accuracy_status ?? '',
          `"${((ans?.comments as string) || '').replace(/"/g, '""')}"`,
        ].join(',') + '\n'
      }
      filename = `submissions-report-${new Date().toISOString().split('T')[0]}.csv`
    } else if (type === 'modules') {
      let query = supabase
        .from('modules')
        .select('id, name, department:departments(name), checkpoints(id, title, submissions:checkpoint_submissions(status))')

      if (departmentId) query = query.eq('department_id', departmentId)

      const { data: modules } = await query

      csvContent = 'Module,Department,Checkpoints,Total Submissions,Approved,Rejected,Pending\n'
      for (const m of modules ?? []) {
        const mod = m as Record<string, unknown>
        const dept = mod.department as Record<string, unknown> | null
        const cps = (mod.checkpoints as Array<Record<string, unknown>> | null) ?? []
        const allSubs = cps.flatMap(cp => (cp.submissions as Array<Record<string, unknown>>) ?? [])
        csvContent += [
          mod.name,
          dept?.name ?? '',
          cps.length,
          allSubs.length,
          allSubs.filter((s: Record<string, unknown>) => s.status === 'APPROVED').length,
          allSubs.filter((s: Record<string, unknown>) => s.status === 'REJECTED').length,
          allSubs.filter((s: Record<string, unknown>) => s.status === 'SUBMITTED').length,
        ].join(',') + '\n'
      }
      filename = `modules-report-${new Date().toISOString().split('T')[0]}.csv`
    } else {
      let query = supabase
        .from('users')
        .select('id, full_name, employee_code, email, role:roles(name), department:departments(name), checkpoint_submissions(status)')

      if (departmentId) query = query.eq('department_id', departmentId)

      const { data: users } = await query

      csvContent = 'Name,Employee Code,Email,Role,Department,Total Submissions,Approved,Rejected\n'
      for (const u of users ?? []) {
        const usr = u as Record<string, unknown>
        const role = usr.role as Record<string, unknown> | null
        const dept = usr.department as Record<string, unknown> | null
        const subs = (usr.checkpoint_submissions as Array<Record<string, unknown>>) ?? []
        csvContent += [
          usr.full_name,
          usr.employee_code,
          usr.email,
          role?.name ?? '',
          dept?.name ?? '',
          subs.length,
          subs.filter((s: Record<string, unknown>) => s.status === 'APPROVED').length,
          subs.filter((s: Record<string, unknown>) => s.status === 'REJECTED').length,
        ].join(',') + '\n'
      }
      filename = `users-report-${new Date().toISOString().split('T')[0]}.csv`
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Reports POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to generate report' }, { status: 500 })
  }
}
