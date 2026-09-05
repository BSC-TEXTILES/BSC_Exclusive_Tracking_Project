import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    let dayStart: Date
    let dayEnd: Date

    if (dateParam) {
      dayStart = new Date(dateParam)
      dayStart.setHours(0, 0, 0, 0)
      dayEnd = new Date(dateParam)
      dayEnd.setHours(23, 59, 59, 999)
    } else {
      dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      dayEnd = new Date()
      dayEnd.setDate(dayEnd.getDate() + 7)
      dayEnd.setHours(23, 59, 59, 999)
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
        .gte('assigned_date', dayStart.toISOString())
        .lte('assigned_date', dayEnd.toISOString())
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
        .gte('submission_date', dayStart.toISOString())
        .lte('submission_date', dayEnd.toISOString())
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
