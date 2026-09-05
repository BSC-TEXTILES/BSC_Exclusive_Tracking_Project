import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        include: {
          _count: { select: { users: true } },
          rolePermissions: {
            include: { permission: true }
          }
        },
        orderBy: { name: 'asc' },
      }),
      prisma.permission.findMany({
        orderBy: { category: 'asc' },
      })
    ])

    return NextResponse.json({
      success: true,
      data: {
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          userCount: r._count.users,
          createdAt: r.createdAt,
          permissions: r.rolePermissions.map(rp => rp.permission.name),
        })),
        permissions: permissions.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
        })),
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Roles GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
