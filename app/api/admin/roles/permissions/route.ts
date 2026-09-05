import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

// Update permissions for a role
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    const { roleId, permissionName, enabled } = body

    if (!roleId || !permissionName || typeof enabled !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 })
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role) {
      return NextResponse.json({ success: false, message: 'Role not found' }, { status: 404 })
    }

    if (role.name === 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Cannot modify ADMIN permissions' }, { status: 403 })
    }

    const permission = await prisma.permission.findUnique({ where: { name: permissionName } })
    if (!permission) {
      return NextResponse.json({ success: false, message: 'Permission not found' }, { status: 404 })
    }

    if (enabled) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: permission.id,
          }
        },
        update: {},
        create: {
          roleId,
          permissionId: permission.id,
        },
      })
    } else {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId: permission.id,
        }
      })
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
