import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const createAssignmentSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Select at least one user'),
  checkpointIds: z.array(z.string()).min(1, 'Select at least one checkpoint'),
  assignedDate: z.string(),
  dueDate: z.string().optional().nullable(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME']).default('DAILY'),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    const userId = searchParams.get('userId')
    const moduleId = searchParams.get('moduleId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const page = parseInt(searchParams.get('page') || '1')

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('checkpoint_assignments')
      .select(`id, assigned_date, due_date, frequency, status, user:users(id, full_name, employee_code, email), checkpoint:checkpoints(id, title, score, module:modules(id, name, slug))`, { count: 'exact' })
      .order('assigned_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (dateStr) {
      const dateStart = new Date(dateStr).toISOString().split('T')[0]
      query = query.eq('assigned_date', dateStart)
    }
    if (userId) query = query.eq('user_id', userId)
    if (status) query = query.eq('status', status)
    if (moduleId) {
      const { data: cpIds } = await supabase.from('checkpoints').select('id').eq('module_id', moduleId)
      if (cpIds && cpIds.length > 0) {
        query = query.in('checkpoint_id', cpIds.map(c => c.id))
      } else {
        return NextResponse.json({ success: true, data: { assignments: [], total: 0, page, limit, users: [], modules: [] } })
      }
    }

    const [{ data: assignments, count }, { data: users }, { data: modules }] = await Promise.all([
      query,
      supabase
        .from('users')
        .select('id, full_name, employee_code, department:departments(name)')
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true }),
      supabase
        .from('modules')
        .select('id, name, slug, display_order, checkpoints(id, title, score, display_order, status)')
        .eq('status', 'ACTIVE')
        .order('display_order', { ascending: true }),
    ])

    const activeModules = (modules ?? [])
      .filter((m: Record<string, unknown>) => {
        const cps = (m.checkpoints as Array<Record<string, unknown>> | null) ?? []
        return cps.some(c => c.status === 'ACTIVE')
      })
      .map((m: Record<string, unknown>) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        checkpoints: ((m.checkpoints as Array<Record<string, unknown>>) ?? [])
          .filter(c => c.status === 'ACTIVE')
          .sort((a, b) => (a.display_order as number) - (b.display_order as number))
          .map(c => ({ id: c.id, title: c.title, score: c.score })),
      }))

    return NextResponse.json({
      success: true,
      data: {
        assignments: (assignments ?? []).map((a: Record<string, unknown>) => {
          const usr = a.user as Record<string, unknown> | null
          const cp = a.checkpoint as Record<string, unknown> | null
          const mod = cp?.module as Record<string, unknown> | null
          return {
            id: a.id,
            assignedDate: a.assigned_date,
            dueDate: a.due_date,
            frequency: a.frequency,
            status: a.status,
            user: usr ? { id: usr.id, fullName: usr.full_name, employeeCode: usr.employee_code, email: usr.email } : null,
            checkpoint: cp ? { id: cp.id, title: cp.title, score: cp.score, module: mod } : null,
          }
        }),
        total: count ?? 0,
        page,
        limit,
        users: (users ?? []).map((u: Record<string, unknown>) => {
          const dept = u.department as Record<string, unknown> | null
          return { id: u.id, fullName: u.full_name, employeeCode: u.employee_code, department: dept }
        }),
        modules: activeModules,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Assignments GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()

    const parsed = createAssignmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { userIds, checkpointIds, assignedDate, dueDate, frequency } = parsed.data

    const supabase = await getSupabaseServerClient()

    let createdCount = 0

    for (const userId of userIds) {
      for (const checkpointId of checkpointIds) {
        const { data: existing } = await supabase
          .from('checkpoint_assignments')
          .select('id')
          .eq('user_id', userId)
          .eq('checkpoint_id', checkpointId)
          .eq('assigned_date', assignedDate)
          .limit(1)
          .single()

        if (existing) {
          await supabase
            .from('checkpoint_assignments')
            .update({
              frequency,
              status: 'ACTIVE',
              ...(dueDate && { due_date: dueDate }),
            })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('checkpoint_assignments')
            .insert({
              user_id: userId,
              checkpoint_id: checkpointId,
              assigned_date: assignedDate,
              due_date: dueDate || null,
              frequency,
              status: 'ACTIVE',
            })
        }
        createdCount++
      }
    }

    await createAuditLog({
      userId: admin.id,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'checkpoint_assignment',
      entityId: userIds[0],
      newValues: { userCount: userIds.length, checkpointCount: checkpointIds.length, assignedDate },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${createdCount} checkpoint assignment(s)`,
      data: { createdCount },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Assignments POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to assign checkpoints' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, message: 'Assignment ID required' }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()

    const { data: existing } = await supabase
      .from('checkpoint_assignments')
      .select('id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Assignment not found' }, { status: 404 })
    }

    await supabase
      .from('checkpoint_assignments')
      .delete()
      .eq('id', id)

    await createAuditLog({
      userId: admin.id,
      action: 'ASSIGNMENT_DELETED',
      entityType: 'checkpoint_assignment',
      entityId: id,
    })

    return NextResponse.json({ success: true, message: 'Assignment deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Assignments DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
