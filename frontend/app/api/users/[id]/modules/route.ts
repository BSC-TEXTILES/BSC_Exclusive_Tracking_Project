import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { safeJson } from '@/lib/utils/parse'
import { getLocalDateString } from '@/lib/utils/date'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabaseServerClient()

    const isAdmin = currentUser.role.name === 'ADMIN'
    if (!isAdmin && currentUser.id !== id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', id)
      .single()

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const { data: modules } = await supabase
      .from('modules')
      .select('*, department:departments(*), checkpoints:checkpoints(*, assignments:checkpoint_assignments(*))')
      .eq('status', 'ACTIVE')
      .order('display_order', { ascending: true })

    const allModules = (modules || []).map((m: any) => ({
      ...m,
      checkpoints: (m.checkpoints || []).filter((cp: any) => cp.status === 'ACTIVE'),
    }))

    const assignedModules = allModules
      .filter(m => m.checkpoints.some((cp: any) =>
        (cp.assignments || []).some((a: any) => a.user_id === id)
      ))
      .map(m => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        description: m.description,
        department: m.department?.name,
        checkpointCount: m.checkpoints.length,
        assignedCheckpointCount: m.checkpoints.filter((cp: any) =>
          (cp.assignments || []).some((a: any) => a.user_id === id)
        ).length,
      }))

    const availableModules = allModules
      .filter(m => !m.checkpoints.some((cp: any) =>
        (cp.assignments || []).some((a: any) => a.user_id === id)
      ))
      .map(m => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        description: m.description,
        department: m.department?.name,
        checkpointCount: m.checkpoints.length,
      }))

    return NextResponse.json({
      success: true,
      data: {
        user: { id: user.id, fullName: user.full_name },
        assignedModules,
        availableModules,
      },
    })
  } catch (error) {
    console.error('User modules GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const supabase = getSupabaseServerClient()
    const body = await safeJson(request)
    if (body === null) {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single()

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const { moduleIds } = body as { moduleIds: string[] }

    if (!moduleIds || !Array.isArray(moduleIds) || moduleIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'moduleIds array is required' },
        { status: 400 }
      )
    }

    const todayStr = getLocalDateString()

    let createdCount = 0

    for (const moduleId of moduleIds) {
      const { data: mod } = await supabase
        .from('modules')
        .select('id')
        .eq('id', moduleId)
        .single()

      if (!mod) continue

      const { data: checkpoints } = await supabase
        .from('checkpoints')
        .select('id')
        .eq('module_id', moduleId)
        .eq('status', 'ACTIVE')

      for (const checkpoint of (checkpoints || []) as any[]) {
        const { data: existing } = await supabase
          .from('checkpoint_assignments')
          .select('id')
          .eq('checkpoint_id', checkpoint.id)
          .eq('user_id', id)
          .eq('assigned_date', todayStr)
          .limit(1)

        if (!existing || existing.length === 0) {
          const { error: insertError } = await supabase.from('checkpoint_assignments').insert({
            checkpoint_id: checkpoint.id,
            user_id: id,
            assigned_date: todayStr,
            frequency: 'DAILY',
          })
          if (insertError) {
            console.error('User modules POST insert error:', insertError)
            return NextResponse.json({ success: false, message: 'Failed to assign modules' }, { status: 500 })
          }
          createdCount++
        }
      }
    }

    await createAuditLog({
      userId: admin.id,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'user_module',
      entityId: id,
      newValues: { moduleIds, assignmentsCreated: createdCount },
    })

    return NextResponse.json({
      success: true,
      message: `Created ${createdCount} checkpoint assignments`,
      data: { assignmentsCreated: createdCount },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('User modules POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to assign modules' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const supabase = getSupabaseServerClient()
    const body = await safeJson(request)
    if (body === null) {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single()

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const { moduleIds } = body as { moduleIds: string[] }

    if (!moduleIds || !Array.isArray(moduleIds)) {
      return NextResponse.json(
        { success: false, message: 'moduleIds array is required' },
        { status: 400 }
      )
    }

    const todayStr = getLocalDateString()

    const { data: allCheckpoints } = await supabase
      .from('checkpoints')
      .select('id, module_id')
      .eq('status', 'ACTIVE')

    const checkpointsToRemove = (allCheckpoints || []).filter(cp => !moduleIds.includes(cp.module_id))

    if (checkpointsToRemove.length > 0) {
      await supabase
        .from('checkpoint_assignments')
        .delete()
        .eq('user_id', id)
        .in('checkpoint_id', checkpointsToRemove.map(cp => cp.id))
    }

    let createdCount = 0
    for (const moduleId of moduleIds) {
      const { data: mod } = await supabase
        .from('modules')
        .select('id')
        .eq('id', moduleId)
        .single()

      if (!mod) continue

      const { data: checkpoints } = await supabase
        .from('checkpoints')
        .select('id')
        .eq('module_id', moduleId)
        .eq('status', 'ACTIVE')

      for (const checkpoint of (checkpoints || []) as any[]) {
        const { data: existing } = await supabase
          .from('checkpoint_assignments')
          .select('id')
          .eq('checkpoint_id', checkpoint.id)
          .eq('user_id', id)
          .eq('assigned_date', todayStr)
          .limit(1)

        if (!existing || existing.length === 0) {
          const { error: insertError } = await supabase.from('checkpoint_assignments').insert({
            checkpoint_id: checkpoint.id,
            user_id: id,
            assigned_date: todayStr,
            frequency: 'DAILY',
          })
          if (insertError) {
            console.error('User modules PUT insert error:', insertError)
            return NextResponse.json({ success: false, message: 'Failed to update module assignments' }, { status: 500 })
          }
          createdCount++
        }
      }
    }

    await createAuditLog({
      userId: admin.id,
      action: 'ASSIGNMENT_UPDATED',
      entityType: 'user_module',
      entityId: id,
      newValues: { moduleIds, assignmentsCreated: createdCount, assignmentsRemoved: checkpointsToRemove.length },
    })

    return NextResponse.json({
      success: true,
      message: 'Module assignments updated successfully',
      data: { assignmentsCreated: createdCount, assignmentsRemoved: checkpointsToRemove.length },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('User modules PUT error:', error)
    return NextResponse.json({ success: false, message: 'Failed to update module assignments' }, { status: 500 })
  }
}
