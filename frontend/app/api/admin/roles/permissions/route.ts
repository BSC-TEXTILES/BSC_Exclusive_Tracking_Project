import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { safeJson } from '@/lib/utils/parse'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = (await safeJson(request)) as { roleId?: string; permissionName?: string; enabled?: boolean } | null
    if (body === null) {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }
    const { roleId, permissionName, enabled } = body

    if (!roleId || !permissionName || typeof enabled !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()

    const { data: role } = await supabase
      .from('roles')
      .select('id, name')
      .eq('id', roleId)
      .single()

    if (!role) {
      return NextResponse.json({ success: false, message: 'Role not found' }, { status: 404 })
    }

    if (role.name === 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Cannot modify ADMIN permissions' }, { status: 403 })
    }

    const { data: permission } = await supabase
      .from('permissions')
      .select('id')
      .eq('name', permissionName)
      .single()

    if (!permission) {
      return NextResponse.json({ success: false, message: 'Permission not found' }, { status: 404 })
    }

    if (enabled) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('role_permissions')
        .select('role_id')
        .eq('role_id', roleId)
        .eq('permission_id', permission.id)
        .limit(1)
        .single()

      if (!existing) {
        await supabase
          .from('role_permissions')
          .insert({ role_id: roleId, permission_id: permission.id })
      }
    } else {
      await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_id', permission.id)
    }

    await createAuditLog({
      userId: admin.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'role',
      entityId: role.id,
      newValues: {
        roleName: role.name,
        permission: permissionName,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Permissions updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin roles permissions POST error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
