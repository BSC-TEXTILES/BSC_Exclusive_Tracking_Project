import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { moduleSchema } from '@/lib/validations/schemas'
import { safeJson } from '@/lib/utils/parse'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabaseServerClient()

    const { data: mod, error } = await supabase
      .from('modules')
      .select('*, department:departments(id, name), checkpoints(*)')
      .eq('id', id)
      .single()

    if (error || !mod) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const checkpoints = (mod.checkpoints || [])
      .sort((a: any, b: any) => a.display_order - b.display_order)

    return NextResponse.json({
      success: true,
      data: {
        id: mod.id,
        name: mod.name,
        slug: mod.slug,
        description: mod.description,
        department: mod.department?.name,
        departmentId: mod.department_id,
        displayOrder: mod.display_order,
        status: mod.status,
        checkpoints: checkpoints.map((cp: any) => ({
          id: cp.id,
          title: cp.title,
          description: cp.description,
          score: cp.score,
          displayOrder: cp.display_order,
          isAccuracyRequired: cp.is_accuracy_required,
          isCorrectiveActionRequired: cp.is_corrective_action_required,
          isPhotoRequired: cp.is_photo_required,
          status: cp.status,
        })),
        createdAt: mod.created_at,
      },
    })
  } catch (error) {
    console.error('Module GET error:', error)
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
    const body = await safeJson(request)
    if (body === null) {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('modules')
      .select('*, department:departments(id, name)')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const parsed = moduleSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    if (data.slug && data.slug !== existing.slug) {
      const { data: dup } = await supabase
        .from('modules')
        .select('id')
        .eq('slug', data.slug)
        .neq('id', id)
        .limit(1)
        .single()
      if (dup) {
        return NextResponse.json({ success: false, message: 'Slug already exists' }, { status: 409 })
      }
    }

    const updatePayload: Record<string, unknown> = {}
    if (data.departmentId !== undefined) updatePayload.department_id = data.departmentId
    if (data.name !== undefined) updatePayload.name = data.name
    if (data.slug !== undefined) updatePayload.slug = data.slug
    if (data.description !== undefined) updatePayload.description = data.description || null
    if (data.displayOrder !== undefined) updatePayload.display_order = data.displayOrder
    if (data.status !== undefined) updatePayload.status = data.status

    const { data: mod, error: updateError } = await supabase
      .from('modules')
      .update(updatePayload)
      .eq('id', id)
      .select('*, department:departments(id, name)')
      .single()

    if (updateError) throw updateError

    await createAuditLog({
      userId: admin.id,
      action: 'MODULE_UPDATED',
      entityType: 'module',
      entityId: id,
      oldValues: { name: existing.name, slug: existing.slug },
      newValues: { name: mod.name, slug: mod.slug },
    })

    return NextResponse.json({
      success: true,
      message: 'Module updated successfully',
      data: { id: mod.id, name: mod.name, slug: mod.slug },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Module PATCH error:', error)
    return NextResponse.json({ success: false, message: 'Failed to update module' }, { status: 500 })
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
      .from('modules')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('modules')
      .update({ status: 'INACTIVE' })
      .eq('id', id)

    if (updateError) throw updateError

    await createAuditLog({
      userId: admin.id,
      action: 'MODULE_UPDATED',
      entityType: 'module',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: 'INACTIVE' },
    })

    return NextResponse.json({
      success: true,
      message: 'Module deactivated successfully',
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Module DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Failed to delete module' }, { status: 500 })
  }
}
