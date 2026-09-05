import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'

export async function GET() {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const [{ data: roles }, { data: permissions }] = await Promise.all([
      supabase
        .from('roles')
        .select('id, name, description, created_at, role_permissions:role_permissions(permission:permissions(id, name))')
        .order('name', { ascending: true }),
      supabase
        .from('permissions')
        .select('id, name, description, category')
        .order('category', { ascending: true }),
    ])

    const { data: userCounts } = await supabase
      .from('users')
      .select('role_id')

    const countsByRole: Record<string, number> = {}
    if (userCounts) {
      for (const u of userCounts) {
        const rid = u.role_id as string
        countsByRole[rid] = (countsByRole[rid] ?? 0) + 1
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        roles: (roles ?? []).map((r: Record<string, unknown>) => {
          const rps = (r.role_permissions as Array<Record<string, unknown>> | null) ?? []
          return {
            id: r.id,
            name: r.name,
            description: r.description,
            userCount: countsByRole[r.id as string] ?? 0,
            createdAt: r.created_at,
            permissions: rps.map((rp: Record<string, unknown>) => {
              const perm = rp.permission as Record<string, unknown> | null
              return (perm?.name as string) ?? ''
            }),
          }
        }),
        permissions: (permissions ?? []).map((p: Record<string, unknown>) => ({
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
