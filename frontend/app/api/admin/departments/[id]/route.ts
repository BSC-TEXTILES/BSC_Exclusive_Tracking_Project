import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(2).max(20).toUpperCase().optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const supabase = getSupabaseServerClient()

    const { data: department, error } = await supabase
      .from('departments')
      .select('*, users(id, full_name, email, employee_code, status), modules(id, name, slug, status)')
      .eq('id', id)
      .single()

    if (error || !department) {
      return NextResponse.json({ success: false, message: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { department } })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Department GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const supabase = getSupabaseServerClient()
    const body = await request.json()

    const parsed = updateDepartmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { data: existing, error: fetchError } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, message: 'Department not found' }, { status: 404 })
    }

    const data = parsed.data
    // Check duplicates if name or code is changing
    if (data.name && data.name !== existing.name) {
      const { data: duplicateName } = await supabase
        .from('departments')
        .select('id')
        .eq('name', data.name)
        .neq('id', id)
        .limit(1)
        .single()
      if (duplicateName) {
        return NextResponse.json({ success: false, message: 'Department name already exists' }, { status: 409 })
      }
    }

    if (data.code && data.code !== existing.code) {
      const { data: duplicateCode } = await supabase
        .from('departments')
        .select('id')
        .eq('code', data.code)
        .neq('id', id)
        .limit(1)
        .single()
      if (duplicateCode) {
        return NextResponse.json({ success: false, message: 'Department code already exists' }, { status: 409 })
      }
    }

    const updatePayload: Record<string, unknown> = {}
    if (data.name) updatePayload.name = data.name
    if (data.code) updatePayload.code = data.code
    if (data.description !== undefined) updatePayload.description = data.description
    if (data.status) updatePayload.status = data.status

    const { data: updated, error: updateError } = await supabase
      .from('departments')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    await createAuditLog({
      userId: admin.id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'department',
      entityId: id,
      oldValues: { name: existing.name, code: existing.code, status: existing.status },
      newValues: { name: updated.name, code: updated.code, status: updated.status },
    })

    return NextResponse.json({
      success: true,
      message: 'Department updated successfully',
      data: { department: updated },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Department PATCH error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const supabase = getSupabaseServerClient()

    const { data: existing, error: fetchError } = await supabase
      .from('departments')
      .select('*, users(id), modules(id)')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, message: 'Department not found' }, { status: 404 })
    }

    const userCount = existing.users?.length || 0
    const moduleCount = existing.modules?.length || 0

    if (userCount > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot delete department with ${userCount} assigned user(s)` },
        { status: 400 }
      )
    }

    if (moduleCount > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot delete department with ${moduleCount} associated module(s)` },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('departments')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    await createAuditLog({
      userId: admin.id,
      action: 'DEPARTMENT_DELETED',
      entityType: 'department',
      entityId: id,
      oldValues: { name: existing.name, code: existing.code },
    })

    return NextResponse.json({ success: true, message: 'Department deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Department DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
