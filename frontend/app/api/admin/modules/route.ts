import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { moduleSchema } from '@/lib/validations/schemas'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()
    const isAdmin = user.role.name === 'ADMIN'

    let query = supabase
      .from('modules')
      .select('*, department:departments(id, name), checkpoints(id)')

    if (!isAdmin) {
      query = query.eq('status', 'ACTIVE')
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const search = searchParams.get('search')

    if (departmentId) query = query.eq('department_id', departmentId)
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: modules, error } = await query.order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        modules: (modules || []).map(m => ({
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
    console.error('Modules GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const supabase = getSupabaseServerClient()
    const body = await request.json()

    const parsed = moduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const { data: existing } = await supabase
      .from('modules')
      .select('id, slug, name')
      .or(`slug.eq.${data.slug},name.eq.${data.name}`)
      .limit(1)
      .single()

    if (existing) {
      const field = existing.slug === data.slug ? 'Slug' : 'Name'
      return NextResponse.json({ success: false, message: `${field} already exists` }, { status: 409 })
    }

    const { data: mod, error: createError } = await supabase
      .from('modules')
      .insert({
        department_id: data.departmentId,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        display_order: data.displayOrder,
        status: data.status,
      })
      .select('*, department:departments(id, name)')
      .single()

    if (createError) throw createError

    await createAuditLog({
      userId: admin.id,
      action: 'MODULE_CREATED',
      entityType: 'module',
      entityId: mod.id,
      newValues: { name: mod.name, slug: mod.slug, department: mod.department?.name },
    })

    return NextResponse.json({
      success: true,
      message: 'Module created successfully',
      data: { id: mod.id, name: mod.name, slug: mod.slug },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Modules POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to create module' }, { status: 500 })
  }
}
