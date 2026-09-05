import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { safeJson } from '@/lib/utils/parse'

export async function GET() {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const { data: settings } = await supabase
      .from('system_settings')
      .select('id, key, value, type, category')
      .order('category', { ascending: true })
      .order('key', { ascending: true })

    const grouped: Record<string, Array<{ id: string; key: string; value: string; type: string }>> = {}
    for (const setting of settings ?? []) {
      const s = setting as Record<string, unknown>
      const cat = s.category as string
      if (!grouped[cat]) {
        grouped[cat] = []
      }
      grouped[cat].push({
        id: s.id as string,
        key: s.key as string,
        value: s.value as string,
        type: s.type as string,
      })
    }

    return NextResponse.json({
      success: true,
      data: { settings: grouped },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Settings GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await safeJson(request)
    if (body === null) {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const { settings } = body as { settings: Array<{ key: string; value: string }> }

    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return NextResponse.json(
        { success: false, message: 'settings array is required' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServerClient()

    const keys = settings.map(s => s.key)

    const { data: existing } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', keys)

    const oldSettings: Record<string, string> = {}
    for (const s of existing ?? []) {
      oldSettings[(s as Record<string, unknown>).key as string] = (s as Record<string, unknown>).value as string
    }

    for (const s of settings) {
      const { data: existingSetting } = await supabase
        .from('system_settings')
        .select('key')
        .eq('key', s.key)
        .limit(1)
        .single()

      if (existingSetting) {
        await supabase
          .from('system_settings')
          .update({ value: s.value })
          .eq('key', s.key)
      } else {
        await supabase
          .from('system_settings')
          .insert({ key: s.key, value: s.value })
      }
    }

    await createAuditLog({
      userId: admin.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'system_setting',
      newValues: {
        updatedKeys: keys,
        changes: settings.map(s => ({
          key: s.key,
          oldValue: oldSettings[s.key] || '(new)',
          newValue: s.value,
        })),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Settings PUT error:', error)
    return NextResponse.json({ success: false, message: 'Failed to update settings' }, { status: 500 })
  }
}
