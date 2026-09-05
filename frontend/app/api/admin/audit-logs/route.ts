import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const action = searchParams.get('action') || ''
    const entityType = searchParams.get('entityType') || ''
    const userId = searchParams.get('userId') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, old_values, new_values, ip_address, created_at, user:users(id, full_name, employee_code)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (action) query = query.eq('action', action)
    if (entityType) query = query.eq('entity_type', entityType)
    if (userId) query = query.eq('user_id', userId)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59.999Z')

    const { data: logs, count } = await query

    return NextResponse.json({
      success: true,
      data: {
        logs: (logs ?? []).map((log: Record<string, unknown>) => {
          const usr = log.user as Record<string, unknown> | null
          return {
            id: log.id,
            action: log.action,
            entityType: log.entity_type,
            entityId: log.entity_id,
            oldValues: log.old_values,
            newValues: log.new_values,
            ipAddress: log.ip_address,
            user: usr ? {
              id: usr.id,
              fullName: usr.full_name,
              employeeCode: usr.employee_code,
            } : null,
            createdAt: log.created_at,
          }
        }),
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit),
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Audit logs GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
