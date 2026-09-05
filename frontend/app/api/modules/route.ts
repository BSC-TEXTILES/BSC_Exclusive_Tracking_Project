import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'

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

    const { data: modules } = await supabase
      .from('modules')
      .select('*, checkpoints:checkpoints(id)')
      .eq('status', 'ACTIVE')
      .order('display_order', { ascending: true })

    return NextResponse.json({
      success: true,
      data: (modules || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        description: m.description,
        checkpointCount: m.checkpoints?.length || 0,
      })),
    })
  } catch (error) {
    console.error('Modules list API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
