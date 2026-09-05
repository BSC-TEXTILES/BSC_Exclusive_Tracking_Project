import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { checkpointSchema } from '@/lib/validations/schemas'

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
    const moduleId = id
    const supabase = getSupabaseServerClient()

    const { data: mod, error: modError } = await supabase
      .from('modules')
      .select('id, name, slug')
      .eq('id', moduleId)
      .single()

    if (modError || !mod) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const { data: checkpoints, error: cpError } = await supabase
      .from('checkpoints')
      .select('*')
      .eq('module_id', moduleId)
      .order('display_order', { ascending: true })

    if (cpError) throw cpError

    return NextResponse.json({
      success: true,
      data: {
        module: { id: mod.id, name: mod.name, slug: mod.slug },
        checkpoints: (checkpoints || []).map(cp => ({
          id: cp.id,
          title: cp.title,
          description: cp.description,
          score: cp.score,
          displayOrder: cp.display_order,
          isAccuracyRequired: cp.is_accuracy_required,
          isCorrectiveActionRequired: cp.is_corrective_action_required,
          isPhotoRequired: cp.is_photo_required,
          status: cp.status,
          createdAt: cp.created_at,
        })),
      },
    })
  } catch (error) {
    console.error('Module checkpoints GET error:', error)
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
    const moduleId = id
    const supabase = getSupabaseServerClient()
    const body = await request.json()

    const { data: mod, error: modError } = await supabase
      .from('modules')
      .select('id, name')
      .eq('id', moduleId)
      .single()

    if (modError || !mod) {
      return NextResponse.json({ success: false, message: 'Module not found' }, { status: 404 })
    }

    const parsed = checkpointSchema.safeParse({ ...body, moduleId })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const { data: checkpoint, error: createError } = await supabase
      .from('checkpoints')
      .insert({
        module_id: moduleId,
        title: data.title,
        description: data.description || null,
        score: data.score,
        is_accuracy_required: data.isAccuracyRequired,
        is_corrective_action_required: data.isCorrectiveActionRequired,
        is_photo_required: data.isPhotoRequired,
        display_order: data.displayOrder,
        status: data.status,
        created_by: admin.id,
      })
      .select()
      .single()

    if (createError) throw createError

    await createAuditLog({
      userId: admin.id,
      action: 'CHECKPOINT_CREATED',
      entityType: 'checkpoint',
      entityId: checkpoint.id,
      newValues: { title: checkpoint.title, moduleId, moduleName: mod.name },
    })

    return NextResponse.json({
      success: true,
      message: 'Checkpoint created successfully',
      data: { id: checkpoint.id, title: checkpoint.title },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Module checkpoints POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to create checkpoint' }, { status: 500 })
  }
}
