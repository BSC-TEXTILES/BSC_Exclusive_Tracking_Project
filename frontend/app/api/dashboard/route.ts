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

    const todayStr = getLocalDateString()

    // Get today's assignments for this user
    let { data: assignments } = await supabase
      .from('checkpoint_assignments')
      .select(`
        *,
        checkpoint:checkpoints(
          *,
          module:modules(id, name, slug, display_order)
        )
      `)
      .eq('user_id', user.id)
      .eq('assigned_date', todayStr)
      .eq('status', 'ACTIVE')

    // If no assignments exist for today, auto-assign active checkpoints
    if (!assignments || assignments.length === 0) {
      const { data: activeCheckpoints } = await supabase
        .from('checkpoints')
        .select('*, module:modules(id, name, slug, display_order)')
        .eq('status', 'ACTIVE')
        .order('display_order', { ascending: true })

      if (activeCheckpoints && activeCheckpoints.length > 0) {
        // Fetch existing assignments for today to avoid duplicates
        const { data: existing } = await supabase
          .from('checkpoint_assignments')
          .select('checkpoint_id')
          .eq('user_id', user.id)
          .eq('assigned_date', todayStr)

        const existingIds = new Set(existing?.map(e => e.checkpoint_id) ?? [])

        const newAssignments = activeCheckpoints
          .filter(cp => !existingIds.has(cp.id))
          .map(cp => ({
            checkpoint_id: cp.id,
            user_id: user.id,
            assigned_date: todayStr,
            frequency: 'DAILY',
            status: 'ACTIVE',
          }))

        if (newAssignments.length > 0) {
          await supabase.from('checkpoint_assignments').insert(newAssignments)
        }

        // Re-fetch assignments
        const { data: refreshed } = await supabase
          .from('checkpoint_assignments')
          .select(`
            *,
            checkpoint:checkpoints(
              *,
              module:modules(id, name, slug, display_order)
            )
          `)
          .eq('user_id', user.id)
          .eq('assigned_date', todayStr)
          .eq('status', 'ACTIVE')

        assignments = refreshed
      }
    }

    // Get today's submissions for this user
    const { data: submissions } = await supabase
      .from('checkpoint_submissions')
      .select('checkpoint_id')
      .eq('user_id', user.id)
      .eq('submission_date', todayStr)
      .in('status', ['SUBMITTED', 'APPROVED'])

    const submittedCheckpointIds = new Set(submissions?.map(s => s.checkpoint_id) ?? [])

    // Get all drafts
    const { data: drafts } = await supabase
      .from('checkpoint_submissions')
      .select('checkpoint_id')
      .eq('user_id', user.id)
      .eq('submission_date', todayStr)
      .eq('status', 'DRAFT')

    const draftCheckpointIds = new Set(drafts?.map(d => d.checkpoint_id) ?? [])

    // Calculate module stats
    const moduleMap = new Map<string, {
      id: string
      name: string
      slug: string
      displayOrder: number
      total: number
      submitted: number
      pending: number
      draft: number
    }>()

    for (const assignment of assignments ?? []) {
      const mod = assignment.checkpoint.module
      if (!moduleMap.has(mod.id)) {
        moduleMap.set(mod.id, {
          id: mod.id,
          name: mod.name,
          slug: mod.slug,
          displayOrder: mod.display_order ?? 0,
          total: 0,
          submitted: 0,
          pending: 0,
          draft: 0,
        })
      }

      const stats = moduleMap.get(mod.id)!
      stats.total++

      if (submittedCheckpointIds.has(assignment.checkpoint_id)) {
        stats.submitted++
      } else {
        stats.pending++
        if (draftCheckpointIds.has(assignment.checkpoint_id)) {
          stats.draft++
        }
      }
    }

    const modules = Array.from(moduleMap.values()).sort((a, b) => {
      return a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)
    })

    const totalCheckpoints = (assignments ?? []).length
    const submittedToday = (submissions ?? []).length

    const names = user.full_name.trim().split(/\s+/)
    const initials = names.length > 1
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : (names[0]?.substring(0, 2) || 'U').toUpperCase()

    return NextResponse.json({
      success: true,
      data: {
        user: {
          fullName: user.full_name,
          firstName: names[0] || user.full_name,
          initials,
          role: user.role.name,
        },
        totalCheckpoints,
        submittedToday,
        modules,
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
