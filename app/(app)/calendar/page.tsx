'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  X,
  Inbox,
} from 'lucide-react'

interface DayBucket {
  date: string
  total: number
  completed: number
  pending: number
  draft: number
}

interface CalendarItem {
  assignmentId: string
  checkpointId: string
  checkpointTitle: string
  moduleName: string
  moduleSlug: string
  status: string
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  reviewedBy: string | null
  reviewComment: string | null
  complianceStatus: string | null
  accuracyStatus: string | null
  comments: string | null
  correctiveAction: string | null
  evidenceCount: number
  evidenceFiles: { id: string; originalName: string; mimeType: string; fileSize: number }[]
}

interface DayDetails {
  date: string
  counts: {
    total: number
    completed: number
    approved: number
    submitted: number
    rejected: number
    draft: number
    pending: number
  }
  items: CalendarItem[]
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function statusClasses(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-success/10 text-success border border-success/20'
    case 'SUBMITTED':
      return 'bg-primary/10 text-primary border border-primary/20'
    case 'REJECTED':
      return 'bg-danger/10 text-danger border border-danger/20'
    case 'DRAFT':
      return 'bg-warning/10 text-warning border border-warning/20'
    case 'PENDING':
    default:
      return 'bg-surface-alt text-text-secondary border border-border'
  }
}

function statusLabel(status: string) {
  if (!status || status === 'PENDING') return 'Pending'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

function complianceLabel(value: string | null) {
  if (!value) return '—'
  switch (value) {
    case 'FULLY_FOLLOWED': return 'Fully followed'
    case 'PARTIALLY_FOLLOWED': return 'Partially followed'
    case 'NOT_FOLLOWED': return 'Not followed'
    case 'NO_TRANSACTION': return 'No transaction'
    case 'YET_TO_IMPLEMENT': return 'Yet to implement'
    default: return value
  }
}

function accuracyLabel(value: string | null) {
  if (!value) return '—'
  switch (value) {
    case 'FULLY_ACCURATE': return 'Fully accurate'
    case 'PARTLY_ACCURATE': return 'Partly accurate'
    case 'INACCURATE': return 'Inaccurate'
    case 'NA': return 'N/A'
    default: return value
  }
}

function formatTime(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function CalendarPage() {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [viewMonth, setViewMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  })
  const [buckets, setBuckets] = useState<Record<string, DayBucket>>({})
  const [loadingMonth, setLoadingMonth] = useState(true)
  const [monthError, setMonthError] = useState('')

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [details, setDetails] = useState<DayDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  const monthParam = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`

  useEffect(() => {
    let cancelled = false
    const fetchMonth = async () => {
      setLoadingMonth(true)
      setMonthError('')
      try {
        const res = await fetch(`/api/calendar?month=${monthParam}`)
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const data = await res.json()
        if (cancelled) return
        if (!data.success) {
          setMonthError(data.message || 'Failed to load calendar')
          setBuckets({})
        } else {
          const map: Record<string, DayBucket> = {}
          for (const d of data.data.days as DayBucket[]) {
            map[d.date] = d
          }
          setBuckets(map)
        }
      } catch {
        if (!cancelled) setMonthError('Failed to load calendar')
      } finally {
        if (!cancelled) setLoadingMonth(false)
      }
    }
    fetchMonth()
    return () => { cancelled = true }
  }, [monthParam])

  useEffect(() => {
    if (!selectedDate) return
    let cancelled = false
    const fetchDetails = async () => {
      setLoadingDetails(true)
      setDetailsError('')
      try {
        const res = await fetch(`/api/calendar?date=${selectedDate}`)
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const data = await res.json()
        if (cancelled) return
        if (!data.success) {
          setDetailsError(data.message || 'Failed to load day details')
          setDetails(null)
        } else {
          setDetails(data.data as DayDetails)
        }
      } catch {
        if (!cancelled) setDetailsError('Failed to load day details')
      } finally {
        if (!cancelled) setLoadingDetails(false)
      }
    }
    fetchDetails()
    return () => { cancelled = true }
  }, [selectedDate])

  const goPrev = useCallback(() => {
    setViewMonth(prev => {
      const d = new Date(prev.year, prev.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
    setSelectedDate(null)
  }, [])

  const goNext = useCallback(() => {
    setViewMonth(prev => {
      const d = new Date(prev.year, prev.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
    setSelectedDate(null)
  }, [])

  const goToday = useCallback(() => {
    setViewMonth({ year: today.getFullYear(), month: today.getMonth() })
    setSelectedDate(null)
  }, [today])

  const grid = useMemo(() => {
    const first = new Date(viewMonth.year, viewMonth.month, 1)
    const firstDay = first.getDay()
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate()
    const cells: ({ day: number; dateKey: string } | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, dateKey: key })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewMonth])

  const monthStats = useMemo(() => {
    let total = 0, completed = 0, pending = 0, draft = 0, daysWithWork = 0
    for (const b of Object.values(buckets)) {
      total += b.total
      completed += b.completed
      pending += b.pending
      draft += b.draft
      if (b.total > 0) daysWithWork++
    }
    return { total, completed, pending, draft, daysWithWork }
  }, [buckets])

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 animate-slide-up">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold text-text">Calendar</h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Click a day to see all tasks, their status, evidence, and review history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="text-xs border border-border bg-surface hover:bg-surface-alt text-text-secondary hover:text-text px-3 py-1.5 font-medium transition"
            >
              Today
            </button>
            <div className="flex items-center bg-surface border border-border">
              <button
                onClick={goPrev}
                className="p-1.5 hover:bg-surface-alt text-text-secondary hover:text-text transition"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-sm font-semibold text-text min-w-[140px] text-center">
                {MONTH_NAMES[viewMonth.month]} {viewMonth.year}
              </span>
              <button
                onClick={goNext}
                className="p-1.5 hover:bg-surface-alt text-text-secondary hover:text-text transition"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Month summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-surface border border-border p-3.5">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">Total tasks</p>
            <p className="text-xl font-bold text-text mt-1">{monthStats.total}</p>
          </div>
          <div className="bg-surface border border-border p-3.5">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">Completed</p>
            <p className="text-xl font-bold text-success mt-1">{monthStats.completed}</p>
          </div>
          <div className="bg-surface border border-border p-3.5">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">Pending</p>
            <p className="text-xl font-bold text-warning mt-1">{monthStats.pending}</p>
          </div>
          <div className="bg-surface border border-border p-3.5">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">Active days</p>
            <p className="text-xl font-bold text-primary mt-1">{monthStats.daysWithWork}</p>
          </div>
        </div>

        {monthError && (
          <div className="bg-danger-bg border border-danger-border text-danger p-3 mb-5 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {monthError}
          </div>
        )}

        {/* Calendar grid + detail panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar grid */}
          <div className={`bg-surface border border-border ${selectedDate ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-[10px] font-semibold uppercase tracking-wider text-white/60 bg-header-bg text-center py-2.5 border-r border-border last:border-r-0">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7">
              {grid.map((cell, i) => {
                if (!cell) {
                  return <div key={`empty-${i}`} className="h-24 border-r border-b border-border bg-surface-alt/30" />
                }
                const bucket = buckets[cell.dateKey]
                const isToday = cell.dateKey === todayKey
                const isSelected = cell.dateKey === selectedDate
                const total = bucket?.total || 0
                const completed = bucket?.completed || 0
                const draft = bucket?.draft || 0
                const hasWork = total > 0
                const allDone = hasWork && completed === total
                const someDone = hasWork && completed > 0 && completed < total

                return (
                  <button
                    key={cell.dateKey}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedDate(null)
                        setDetails(null)
                        setDetailsError('')
                      } else {
                        setSelectedDate(cell.dateKey)
                      }
                    }}
                    className={`h-24 border-r border-b border-border last:border-r-0 p-1.5 text-left flex flex-col justify-between transition-colors relative ${
                      isSelected
                        ? 'bg-primary-light ring-2 ring-primary ring-inset'
                        : isToday
                          ? 'bg-primary-light/40 hover:bg-primary-light'
                          : 'bg-surface hover:bg-surface-alt'
                    }`}
                    aria-label={`${cell.dateKey}${hasWork ? `, ${completed} of ${total} completed` : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className={`text-xs font-semibold ${
                        isToday ? 'bg-primary text-white w-5 h-5 flex items-center justify-center' : 'text-text'
                      }`}>
                        {cell.day}
                      </span>
                      {hasWork && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 leading-none ${
                          allDone
                            ? 'bg-success/10 text-success border border-success/20'
                            : someDone
                              ? 'bg-warning/10 text-warning border border-warning/20'
                              : 'bg-danger/10 text-danger border border-danger/20'
                        }`}>
                          {completed}/{total}
                        </span>
                      )}
                    </div>
                    {hasWork && (
                      <div className="flex items-center gap-1 mt-auto">
                        {allDone ? (
                          <CheckCircle2 className="w-3 h-3 text-success" />
                        ) : someDone ? (
                          <Clock className="w-3 h-3 text-warning" />
                        ) : (
                          <XCircle className="w-3 h-3 text-danger" />
                        )}
                        <span className="text-[9px] text-text-muted truncate">
                          {allDone
                            ? 'All done'
                            : someDone
                              ? `${completed} done, ${total - completed} left`
                              : draft > 0
                                ? `${draft} draft${draft === 1 ? '' : 's'}`
                                : `${total} pending`}
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {loadingMonth && (
              <div className="p-3 text-center text-xs text-text-muted border-t border-border">
                Loading calendar...
              </div>
            )}
            {!loadingMonth && Object.keys(buckets).length === 0 && (
              <div className="p-6 text-center text-xs text-text-muted border-t border-border">
                <Inbox className="w-6 h-6 mx-auto mb-2 text-text-muted" />
                No tasks assigned in this month.
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedDate && (
            <div className="bg-surface border border-border lg:col-span-1 flex flex-col max-h-[640px]">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-text">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                  {details && (
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {details.counts.completed} of {details.counts.total} completed
                      {details.counts.draft > 0 ? ` · ${details.counts.draft} draft` : ''}
                      {details.counts.rejected > 0 ? ` · ${details.counts.rejected} rejected` : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 text-text-muted hover:text-text hover:bg-surface-alt transition"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingDetails ? (
                  <div className="p-4 text-xs text-text-muted text-center">Loading...</div>
                ) : detailsError ? (
                  <div className="p-4 text-xs text-danger flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {detailsError}
                  </div>
                ) : !details || details.items.length === 0 ? (
                  <div className="p-6 text-center">
                    <Inbox className="w-8 h-8 mx-auto text-text-muted mb-2" />
                    <p className="text-xs text-text-muted">No tasks on this day.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {details.items.map(item => {
                      const time = formatTime(item.submittedAt)
                      return (
                        <li key={item.checkpointId} className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-text truncate">
                                {item.checkpointTitle}
                              </p>
                              <p className="text-[10px] text-text-muted">{item.moduleName}</p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap ${statusClasses(item.status)}`}>
                              {statusLabel(item.status)}
                            </span>
                          </div>

                          {time && (
                            <div className="flex items-center gap-1 text-[10px] text-text-secondary mb-1">
                              <Clock className="w-3 h-3" />
                              <span>Submitted {time}</span>
                            </div>
                          )}

                          {(item.complianceStatus || item.accuracyStatus) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] mt-1">
                              {item.complianceStatus && (
                                <span className="text-text-secondary">
                                  <span className="text-text-muted">Compliance:</span>{' '}
                                  <span className="font-medium text-text">{complianceLabel(item.complianceStatus)}</span>
                                </span>
                              )}
                              {item.accuracyStatus && (
                                <span className="text-text-secondary">
                                  <span className="text-text-muted">Accuracy:</span>{' '}
                                  <span className="font-medium text-text">{accuracyLabel(item.accuracyStatus)}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {item.comments && (
                            <p className="text-[11px] text-text-secondary mt-1.5 bg-surface-alt px-2 py-1">
                              <span className="text-text-muted">Note: </span>{item.comments}
                            </p>
                          )}

                          {item.correctiveAction && (
                            <p className="text-[11px] text-text-secondary mt-1 bg-warning/10 border border-warning/20 px-2 py-1">
                              <span className="text-warning font-semibold">Corrective action: </span>{item.correctiveAction}
                            </p>
                          )}

                          {item.reviewedBy && (
                            <div className="mt-1.5 text-[10px] text-text-muted">
                              Reviewed by <span className="text-text font-medium">{item.reviewedBy}</span>
                              {item.approvedAt && ` · approved ${formatTime(item.approvedAt)}`}
                              {item.rejectedAt && ` · rejected ${formatTime(item.rejectedAt)}`}
                            </div>
                          )}

                          {item.reviewComment && (
                            <p className="text-[11px] text-text-secondary mt-1 italic">
                              &ldquo;{item.reviewComment}&rdquo;
                            </p>
                          )}

                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1 text-text-muted">
                              {item.evidenceCount > 0 ? (
                                <>
                                  <ImageIcon className="w-3 h-3" />
                                  <span>{item.evidenceCount} evidence file{item.evidenceCount === 1 ? '' : 's'}</span>
                                </>
                              ) : (
                                <span>No evidence</span>
                              )}
                            </div>
                            <Link
                              href={`/checkpoints/${item.checkpointId}`}
                              className="text-primary hover:underline font-medium"
                            >
                              Open
                            </Link>
                          </div>

                          {item.evidenceFiles.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {item.evidenceFiles.map(f => (
                                <li key={f.id} className="flex items-center justify-between text-[10px] text-text-muted">
                                  <span className="flex items-center gap-1 truncate">
                                    <FileText className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{f.originalName}</span>
                                  </span>
                                  <span>{fileSize(f.fileSize)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
