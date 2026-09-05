import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'

export async function GET() {
  try {
    const supabase = getSupabaseServerClient()

    const { data: modules } = await supabase
      .from('modules')
      .select('id, name, description, display_order')
      .eq('status', 'ACTIVE')
      .order('display_order', { ascending: true })

    const modulesWithCounts = await Promise.all(
      (modules || []).map(async (mod: any) => {
        const { count } = await supabase
          .from('checkpoints')
          .select('*', { count: 'exact', head: true })
          .eq('module_id', mod.id)
          .eq('status', 'ACTIVE')

        return {
          id: mod.id,
          name: mod.name,
          description: mod.description,
          checkpointCount: count || 0,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: modulesWithCounts,
    })
  } catch (error) {
    console.error('Public modules GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
