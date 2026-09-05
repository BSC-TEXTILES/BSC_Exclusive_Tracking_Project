import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await getSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const moduleId = searchParams.get('moduleId')

    let query = supabase
      .from('checkpoints')
      .select('id, title, description, score, display_order, is_accuracy_required, is_corrective_action_required, is_photo_required, status, module_id, created_by, created_at, module:modules(id, name, slug)')
      .order('display_order', { ascending: true })

    if (moduleId) {
      query = query.eq('module_id', moduleId)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: checkpoints } = await query

    return NextResponse.json({
      success: true,
      data: {
        checkpoints: (checkpoints ?? []).map((cp: Record<string, unknown>) => {
          const mod = cp.module as Record<string, unknown> | null
          return {
            id: cp.id,
            title: cp.title,
            description: cp.description,
            score: cp.score,
            displayOrder: cp.display_order,
            isAccuracyRequired: cp.is_accuracy_required,
            isCorrectiveActionRequired: cp.is_corrective_action_required,
            isPhotoRequired: cp.is_photo_required,
            status: cp.status,
            moduleId: cp.module_id,
            moduleName: mod?.name,
            moduleSlug: mod?.slug,
            createdById: cp.created_by,
            createdAt: cp.created_at,
          }
        }),
      },
    })
  } catch (error) {
    console.error('Admin checkpoints GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
