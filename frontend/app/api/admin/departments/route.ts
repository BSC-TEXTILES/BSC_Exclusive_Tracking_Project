import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { departmentSchema } from '@/lib/validations/schemas'

export async function GET() {
  try {
    await requireAdmin()
    const supabase = getSupabaseServerClient()

    const { data: departments, error } = await supabase
      .from('departments')
      .select('*, users(id), modules(id)')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        departments: (departments || []).map(d => ({
          id: d.id,
          name: d.name,
          code: d.code,
          description: d.description,
          status: d.status,
          userCount: d.users?.length || 0,
          moduleCount: d.modules?.length || 0,
          createdAt: d.created_at,
        })),
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Departments GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const supabase = getSupabaseServerClient()
    const body = await request.json()

    const parsed = departmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const { data: existing } = await supabase
      .from('departments')
      .select('id, name, code')
      .or(`name.eq.${data.name},code.eq.${data.code}`)
      .limit(1)
      .single()

    if (existing) {
      const field = existing.name === data.name ? 'Name' : 'Code'
      return NextResponse.json({ success: false, message: `${field} already exists` }, { status: 409 })
    }

    const { data: department, error: createError } = await supabase
      .from('departments')
      .insert({
        name: data.name,
        code: data.code,
        description: data.description || null,
        status: data.status,
      })
      .select()
      .single()

    if (createError) throw createError

    await createAuditLog({
      userId: admin.id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'department',
      entityId: department.id,
      newValues: { name: department.name, code: department.code },
    })

    return NextResponse.json({
      success: true,
      message: 'Department created successfully',
      data: { id: department.id, name: department.name, code: department.code },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Departments POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to create department' }, { status: 500 })
  }
}
