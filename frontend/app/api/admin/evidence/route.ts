import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const supabase = await getSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const moduleId = searchParams.get('moduleId')
    const dateStr = searchParams.get('date')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('evidence_files')
      .select(`id, original_name, mime_type, file_size, storage_path, created_at, uploaded_by:users(id, full_name, employee_code, email), submission:checkpoint_submissions(id, submission_date, status, checkpoint:checkpoints(id, title, score, module:modules(id, name, slug)))`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (userId) query = query.eq('uploaded_by', userId)

    if (moduleId) {
      const { data: cpIds } = await supabase.from('checkpoints').select('id').eq('module_id', moduleId)
      if (cpIds && cpIds.length > 0) {
        const { data: subIds } = await supabase.from('checkpoint_submissions').select('id').in('checkpoint_id', cpIds.map(c => c.id))
        if (subIds && subIds.length > 0) {
          query = query.in('submission_id', subIds.map(s => s.id))
        } else {
          return NextResponse.json({ success: true, data: { evidence: [], total: 0, page, limit, totalSizeBytes: 0, totalCount: 0, users: [], modules: [] } })
        }
      } else {
        return NextResponse.json({ success: true, data: { evidence: [], total: 0, page, limit, totalSizeBytes: 0, totalCount: 0, users: [], modules: [] } })
      }
    }

    if (dateStr) {
      const dateStart = new Date(dateStr).toISOString()
      const dateEnd = new Date(dateStr)
      dateEnd.setDate(dateEnd.getDate() + 1)
      const { data: subIds } = await supabase.from('checkpoint_submissions').select('id').gte('submission_date', dateStart).lt('submission_date', dateEnd.toISOString())
      if (subIds && subIds.length > 0) {
        query = query.in('submission_id', subIds.map(s => s.id))
      } else {
        return NextResponse.json({ success: true, data: { evidence: [], total: 0, page, limit, totalSizeBytes: 0, totalCount: 0, users: [], modules: [] } })
      }
    }

    if (search) {
      const { data: matchedCheckpoints } = await supabase.from('checkpoints').select('id').ilike('title', `%${search}%`)
      const checkpointIds = (matchedCheckpoints ?? []).map((c: Record<string, unknown>) => c.id as string)
      if (checkpointIds.length > 0) {
        const { data: matchedSubs } = await supabase.from('checkpoint_submissions').select('id').in('checkpoint_id', checkpointIds)
        const subIds = (matchedSubs ?? []).map((s: Record<string, unknown>) => s.id as string)
        if (subIds.length > 0) {
          query = query.or(`original_name.ilike.%${search}%,submission_id.in.(${subIds.join(',')})`)
        } else {
          query = query.ilike('original_name', `%${search}%`)
        }
      } else {
        query = query.ilike('original_name', `%${search}%`)
      }
    }

    const [{ data: evidenceFiles, count }, { data: aggregateData }, { data: users }, { data: modules }] = await Promise.all([
      query,
      supabase.from('evidence_files').select('file_size'),
      supabase
        .from('users')
        .select('id, full_name, employee_code')
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true }),
      supabase
        .from('modules')
        .select('id, name, slug, display_order')
        .eq('status', 'ACTIVE')
        .order('display_order', { ascending: true }),
    ])

    const totalSizeBytes = (aggregateData ?? []).reduce((sum: number, f: Record<string, unknown>) => sum + ((f.file_size as number) ?? 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        evidence: (evidenceFiles ?? []).map((e: Record<string, unknown>) => {
          const usr = e.uploaded_by as Record<string, unknown> | null
          const sub = e.submission as Record<string, unknown> | null
          const cp = sub?.checkpoint as Record<string, unknown> | null
          const mod = cp?.module as Record<string, unknown> | null
          return {
            id: e.id,
            originalName: e.original_name,
            mimeType: e.mime_type,
            fileSize: e.file_size,
            storagePath: e.storage_path,
            url: `/api/evidence/${e.id}`,
            createdAt: e.created_at,
            user: usr,
            submission: sub ? {
              id: sub.id,
              status: sub.status,
              date: sub.submission_date?.toString()?.split('T')?.[0],
            } : null,
            checkpoint: cp ? { id: cp.id, title: cp.title, score: cp.score, module: mod } : null,
          }
        }),
        total: count ?? 0,
        page,
        limit,
        totalSizeBytes,
        totalCount: count ?? 0,
        users: (users ?? []).map((u: Record<string, unknown>) => ({ id: u.id, fullName: u.full_name, employeeCode: u.employee_code })),
        modules: (modules ?? []).map((m: Record<string, unknown>) => ({ id: m.id, name: m.name, slug: m.slug })),
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin evidence GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, message: 'Evidence ID required' }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()

    const { data: existing } = await supabase
      .from('evidence_files')
      .select('id, original_name, file_size, storage_path')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Evidence not found' }, { status: 404 })
    }

    try {
      const filePath = path.resolve((existing.storage_path as string).replace(/^\//, ''))
      await unlink(filePath)
    } catch {
      // File may have been removed or moved
    }

    await supabase
      .from('evidence_files')
      .delete()
      .eq('id', id)

    await createAuditLog({
      userId: admin.id,
      action: 'EVIDENCE_DELETED',
      entityType: 'evidence_file',
      entityId: id,
      oldValues: { originalName: existing.original_name, fileSize: existing.file_size },
    })

    return NextResponse.json({ success: true, message: 'Evidence file deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin evidence DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
