import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    let query = supabase
      .from('modules')
      .select('*, department:departments(*), checkpoints:checkpoints(id)')
      .eq('status', 'ACTIVE')
      .order('display_order', { ascending: true })

    if (user.departmentId) {
      query = query.eq('department_id', user.departmentId)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: modules, error } = await query

    if (error) {
      console.error('Supervisor projects GET error:', error)
      return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        modules: (modules || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
          description: m.description,
          department: m.department?.name,
          departmentId: m.department_id,
          displayOrder: m.display_order,
          status: m.status,
          checkpointCount: m.checkpoints?.length || 0,
          createdAt: m.created_at,
        })),
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
    console.error('Supervisor projects GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supervisor = await requireAuth()

    if (supervisor.role.name !== 'SUPERVISOR' && supervisor.role.name !== 'ADMIN' && supervisor.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const supabase = getSupabaseServerClient()
    const body = await request.json()
    const { moduleId, departmentId } = body as {
      moduleId?: string
      departmentId?: string
    }

    if (!moduleId) {
      return NextResponse.json(
        { success: false, message: 'Module ID is required' },
        { status: 400 }
      )
    }

    const { data: mod } = await supabase
      .from('modules')
      .select('*, department:departments(*)')
      .eq('id', moduleId)
      .single()

    if (!mod) {
      return NextResponse.json(
        { success: false, message: 'Module not found' },
        { status: 404 }
      )
    }

    const targetDeptId = departmentId || supervisor.departmentId

    if (targetDeptId && mod.department_id !== targetDeptId) {
      return NextResponse.json(
        { success: false, message: 'Module does not belong to the assigned department' },
        { status: 400 }
      )
    }

    await createAuditLog({
      userId: supervisor.id,
      action: 'MODULE_UPDATED',
      entityType: 'module',
      entityId: moduleId,
      newValues: { assignedTo: supervisor.fullName, moduleName: mod.name, departmentName: mod.department?.name },
    })

    return NextResponse.json({
      success: true,
      message: 'Module assigned successfully',
      data: {
        id: mod.id,
        name: mod.name,
        slug: mod.slug,
        department: mod.department?.name,
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
    console.error('Supervisor projects POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to assign module' },
      { status: 500 }
    )
  }
}
