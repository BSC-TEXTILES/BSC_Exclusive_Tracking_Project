import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'

function parseDateParam(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function monthRange(value: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null
  const [y, m] = value.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  return { start, end }
}

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isCompleted(status: string, complianceStatus: string | null | undefined): boolean {
  if (status !== 'SUBMITTED' && status !== 'APPROVED') return false
  return complianceStatus === 'FULLY_FOLLOWED'
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const monthParam = searchParams.get('month')

    // ----- Single-day details -----
    if (dateParam) {
      const day = parseDateParam(dateParam)
      if (!day) {
        return NextResponse.json(
          { success: false, message: 'Invalid date parameter (expected YYYY-MM-DD)', code: 'VALIDATION_ERROR' },
          { status: 400 }
        )
      }
      day.setHours(0, 0, 0, 0)
      const dayStr = dayKey(day)
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      const nextStr = dayKey(next)

      const [assignmentsRes, submissionsRes] = await Promise.all([
        supabase
          .from('checkpoint_assignments')
          .select('*, checkpoint:checkpoints(title, display_order, module:modules(id, name, slug))')
          .eq('user_id', user.id)
          .gte('assigned_date', dayStr)
          .lt('assigned_date', nextStr)
          .eq('status', 'ACTIVE'),
        supabase
          .from('checkpoint_submissions')
          .select('*, checkpoint:checkpoints(title, display_order, module:modules(id, name, slug)), answer:submission_answers(*), reviewedBy:users!reviewed_by(id, full_name), evidence:evidence_files(id, original_name, mime_type, file_size)')
          .eq('user_id', user.id)
          .gte('submission_date', dayStr)
          .lt('submission_date', nextStr),
      ])

      const assignments = assignmentsRes.data || []
      const submissions = submissionsRes.data || []

      const completed = submissions.filter((s: any) => isCompleted(s.status, s.answer?.compliance_status)).length
      const approved = submissions.filter((s: any) => s.status === 'APPROVED').length
      const submitted = submissions.filter((s: any) => s.status === 'SUBMITTED').length
      const rejected = submissions.filter((s: any) => s.status === 'REJECTED').length
      const draft = submissions.filter((s: any) => s.status === 'DRAFT').length
      const total = assignments.length

      const byCheckpoint = new Map<string, any>()

      for (const a of assignments) {
        byCheckpoint.set(a.checkpoint_id, {
          assignmentId: a.id,
          checkpointId: a.checkpoint_id,
          checkpointTitle: a.checkpoint?.title,
          moduleName: a.checkpoint?.module?.name,
          moduleSlug: a.checkpoint?.module?.slug,
          status: 'PENDING',
          submittedAt: null,
          approvedAt: null,
          rejectedAt: null,
          reviewedBy: null,
          reviewComment: null,
          complianceStatus: null,
          accuracyStatus: null,
          comments: null,
          correctiveAction: null,
          evidenceCount: 0,
          evidenceFiles: [],
        })
      }

      for (const s of submissions) {
        byCheckpoint.set(s.checkpoint_id, {
          assignmentId: s.assignment_id || '',
          checkpointId: s.checkpoint_id,
          checkpointTitle: s.checkpoint?.title,
          moduleName: s.checkpoint?.module?.name,
          moduleSlug: s.checkpoint?.module?.slug,
          status: s.status,
          submittedAt: s.submitted_at || null,
          approvedAt: s.approved_at || null,
          rejectedAt: s.rejected_at || null,
          reviewedBy: s.reviewedBy?.full_name || null,
          reviewComment: s.review_comment,
          complianceStatus: s.answer?.compliance_status || null,
          accuracyStatus: s.answer?.accuracy_status || null,
          comments: s.answer?.comments || null,
          correctiveAction: s.answer?.corrective_action || null,
          evidenceCount: s.evidence?.length || 0,
          evidenceFiles: (s.evidence || []).map((e: any) => ({
            id: e.id,
            originalName: e.original_name,
            mimeType: e.mime_type,
            fileSize: e.file_size,
          })),
        })
      }

      const items = Array.from(byCheckpoint.values()).sort((a: any, b: any) =>
        (a.moduleName || '').localeCompare(b.moduleName || '') ||
        (a.checkpointTitle || '').localeCompare(b.checkpointTitle || '')
      )

      return NextResponse.json({
        success: true,
        data: {
          date: dayStr,
          counts: { total, completed, approved, submitted, rejected, draft, pending: total - submissions.length },
          items,
        },
      })
    }

    // ----- Month summary -----
    if (!monthParam) {
      return NextResponse.json(
        { success: false, message: 'Either ?date=YYYY-MM-DD or ?month=YYYY-MM is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    const range = monthRange(monthParam)
    if (!range) {
      return NextResponse.json(
        { success: false, message: 'Invalid month parameter (expected YYYY-MM)', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const rangeStartStr = dayKey(range.start)
    const rangeEndStr = dayKey(range.end)

    const [assignmentsRes, submissionsRes] = await Promise.all([
      supabase
        .from('checkpoint_assignments')
        .select('assigned_date, checkpoint_id')
        .eq('user_id', user.id)
        .gte('assigned_date', rangeStartStr)
        .lt('assigned_date', rangeEndStr)
        .eq('status', 'ACTIVE'),
      supabase
        .from('checkpoint_submissions')
        .select('submission_date, checkpoint_id, status, answer:submission_answers(compliance_status)')
        .eq('user_id', user.id)
        .gte('submission_date', rangeStartStr)
        .lt('submission_date', rangeEndStr),
    ])

    const assignments = assignmentsRes.data || []
    const submissions = submissionsRes.data || []

    const buckets = new Map<string, { total: number; completed: number; pending: number; draft: number }>()

    for (const a of assignments) {
      const key = dayKey(new Date(a.assigned_date))
      const bucket = buckets.get(key) || { total: 0, completed: 0, pending: 0, draft: 0 }
      bucket.total++
      buckets.set(key, bucket)
    }

    const draftByKeyCheckpoint = new Set<string>()
    const completedByKeyCheckpoint = new Set<string>()
    const submittedByKeyCheckpoint = new Set<string>()

    for (const s of submissions) {
      const key = dayKey(new Date(s.submission_date))
      const bucket = buckets.get(key) || { total: 0, completed: 0, pending: 0, draft: 0 }
      const ck = `${key}|${s.checkpoint_id}`

      if (s.status === 'DRAFT') {
        if (!submittedByKeyCheckpoint.has(ck)) {
          draftByKeyCheckpoint.add(ck)
          bucket.draft++
        }
      } else if (isCompleted(s.status, (s.answer as any)?.compliance_status)) {
        if (!completedByKeyCheckpoint.has(ck)) {
          completedByKeyCheckpoint.add(ck)
          bucket.completed++
        }
        submittedByKeyCheckpoint.add(ck)
      } else {
        submittedByKeyCheckpoint.add(ck)
      }
      buckets.set(key, bucket)
    }

    for (const [, bucket] of buckets) {
      bucket.pending = Math.max(0, bucket.total - bucket.completed - bucket.draft)
    }

    const days = Array.from(buckets.entries())
      .map(([date, b]) => ({ date, ...b }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      success: true,
      data: {
        month: monthParam,
        days,
      },
    })
  } catch (error) {
    console.error('Calendar API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
