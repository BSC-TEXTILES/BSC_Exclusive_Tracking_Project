import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'
import { getLocalDateString } from '@/lib/utils/date'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    let dayStr: string
    let nextDayStr: string

    if (dateParam) {
      dayStr = getLocalDateString(new Date(dateParam))
      nextDayStr = getLocalDateString(new Date(new Date(dateParam).getTime() + 864e5))
    } else {
      dayStr = getLocalDateString()
      nextDayStr = getLocalDateString(new Date(Date.now() + 7 * 864e5))
    }

    const supabase = getSupabaseServerClient()
    const limit = dateParam ? 20 : 10

    const [assignmentsResult, submissionsResult] = await Promise.all([
      supabase
        .from('checkpoint_assignments')
        .select(`
          *,
          checkpoint:checkpoints(
            title,
            module:modules(name)
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gte('assigned_date', dayStr)
        .lt('assigned_date', nextDayStr)
        .order('assigned_date', { ascending: true })
        .limit(limit),
      supabase
        .from('checkpoint_submissions')
        .select(`
          *,
          checkpoint:checkpoints(
            title,
            module:modules(name)
          )
        `)
        .eq('user_id', user.id)
        .gte('submission_date', dayStr)
        .lt('submission_date', nextDayStr)
        .order('submission_date', { ascending: false })
        .limit(dateParam ? 20 : 5),
    ])

    return NextResponse.json({
      success: true,
      data: {
        upcoming: (assignmentsResult.data ?? []).map(a => ({
          id: a.id,
          checkpointTitle: a.checkpoint.title,
          moduleName: a.checkpoint.module.name,
          assignedDate: a.assigned_date,
          dueDate: a.due_date,
        })),
        recent: (submissionsResult.data ?? []).map(s => ({
          id: s.id,
          checkpointTitle: s.checkpoint.title,
          moduleName: s.checkpoint.module.name,
          status: s.status,
          submissionDate: s.submission_date,
        })),
      },
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
