import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  try {
    await requireAdmin()

    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    const grouped: Record<string, Array<{ id: string; key: string; value: string; type: string }>> = {}
    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = []
      }
      grouped[setting.category].push({
        id: setting.id,
        key: setting.key,
        value: setting.value,
        type: setting.type,
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
    const body = await request.json()

    const { settings } = body as { settings: Array<{ key: string; value: string }> }

    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return NextResponse.json(
        { success: false, message: 'settings array is required' },
        { status: 400 }
      )
    }

    const oldSettings: Record<string, string> = {}
    const keys = settings.map(s => s.key)

    const existing = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    })
    for (const s of existing) {
      oldSettings[s.key] = s.value
    }

    const updates = settings.map(s =>
      prisma.systemSetting.upsert({
        where: { key: s.key },
        update: { value: s.value },
        create: { key: s.key, value: s.value },
      })
    )

    await Promise.all(updates)

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
