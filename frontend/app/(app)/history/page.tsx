'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  FileText,
  Camera,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  X,
} from 'lucide-react'
import { LiveDateTime } from '@/components/ui/live-date-time'

interface HistorySubmission {
  id: string
  date: string
  module: string
  moduleSlug: string
  checkpoint: string
  compliance: string | null
  accuracy: string | null
  correctiveAction: string | null
  score: number
  status: string
  evidenceCount: number
  submittedAt: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface HistoryData {
  submissions: HistorySubmission[]
  pagination: Pagination
}

interface ModuleOption {
  name: string
  slug: string
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  PENDING: { icon: Clock, bg: 'bg-warning/10', text: 'text-warning', label: 'Pending' },
  DRAFT: { icon: FileText, bg: 'bg-info/10', text: 'text-info', label: 'Draft' },
  SUBMITTED: { icon: CheckCircle2, bg: 'bg-primary/10', text: 'text-primary', label: 'Submitted' },
  APPROVED: { icon: CheckCircle2, bg: 'bg-success/10', text: 'text-success', label: 'Approved' },
  REJECTED: { icon: XCircle, bg: 'bg-danger/10', text: 'text-danger', label: 'Rejected' },
}

const COMPLIANCE_CONFIG: Record<string, string> = {
  FULLY_FOLLOWED: 'Fully Followed',
  PARTIALLY_FOLLOWED: 'Partially Followed',
  NOT_FOLLOWED: 'Not Followed',
  NO_TRANSACTION: 'No Transaction',
  YET_TO_IMPLEMENT: 'Yet to Implement',
}

const ACCURACY_CONFIG: Record<string, string> = {
  FULLY_ACCURATE: 'Fully Accurate',
  PARTLY_ACCURATE: 'Partly Accurate',
  INACCURATE: 'Inaccurate',
  NA: 'N/A',
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border-light">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
        <td key={i} className="px-4 py-2.5">
          <div className="h-3 bg-surface-alt w-full" />
        </td>
      ))}
    </tr>
  )
}

function statusBadge(status: string) {
  switch (status) {
    case 'PENDING': return 'bg-warning/10 text-warning border border-warning/20'
    case 'DRAFT': return 'bg-info/10 text-info border border-info/20'
    case 'SUBMITTED': return 'bg-primary/10 text-primary border border-primary/20'
    case 'APPROVED': return 'bg-success/10 text-success border border-success/20'
    case 'REJECTED': return 'bg-danger/10 text-danger border border-danger/20'
    default: return 'bg-background text-text border border-border'
  }
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modules, setModules] = useState<ModuleOption[]>([])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [moduleSlug, setModuleSlug] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetch('/api/modules')
      .then(res => {
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        return res.json()
      })
      .then(result => {
        if (!result) return
        if (result.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (result.success) {
          setModules(result.data.modules || [])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '10')
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (moduleSlug) params.set('module', moduleSlug)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    fetch(`/api/history?${params.toString()}`)
      .then(res => {
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        return res.json()
      })
      .then(result => {
        if (!result) return
        if (result.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.message || 'Failed to load history')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to connect to server')
        setLoading(false)
      })
  }, [page, search, status, moduleSlug, dateFrom, dateTo])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setSearch('')
    setStatus('')
    setModuleSlug('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }, [])

  const hasFilters = search || status || moduleSlug || dateFrom || dateTo

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  }

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-4">
          <div className="h-6 bg-surface-alt w-48" />
          <div className="h-3 bg-surface-alt w-64" />
          <div className="bg-surface border border-border p-4">
            <div className="flex gap-3 mb-4">
              <div className="h-9 bg-surface-alt flex-1" />
              <div className="h-9 bg-surface-alt w-28" />
              <div className="h-9 bg-surface-alt w-28" />
            </div>
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 bg-surface-alt" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-base sm:text-lg font-semibold text-text mb-4">Submission History</h1>
        <div className="bg-surface border border-border p-5 text-center">
          <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
          <p className="text-danger text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-slide-up">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base sm:text-lg font-semibold text-text">Submission History</h1>
          <p className="text-xs text-text-muted mt-0.5">View and track all your checkpoint submissions</p>
        </div>
        <LiveDateTime
          showSeconds={false}
          dateFormat="compact"
          timeFormat="12h"
          dateClassName="text-sm font-medium text-text"
          timeClassName="text-xs text-text-muted font-mono"
        />
      </div>

      <div className="bg-surface border border-border p-4 mb-5">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <label htmlFor="history-search" className="sr-only">Search submissions</label>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              id="history-search"
              type="text"
              placeholder="Search checkpoints..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-border text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium ${
              showFilters || hasFilters
                ? 'bg-primary-light border-primary text-primary'
                : 'border-border text-text-secondary hover:bg-surface-alt'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {hasFilters && (
              <span className="w-1.5 h-1.5 bg-primary" />
            )}
          </button>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-medium"
          >
            Search
          </button>
        </form>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="filter-module" className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Module</label>
                <select
                  id="filter-module"
                  value={moduleSlug}
                  onChange={e => { setModuleSlug(e.target.value); setPage(1) }}
                  className="w-full px-2.5 py-1.5 border border-border text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Modules</option>
                  {modules.map(mod => (
                    <option key={mod.slug} value={mod.slug}>{mod.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-status" className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Status</label>
                <select
                  id="filter-status"
                  value={status}
                  onChange={e => { setStatus(e.target.value); setPage(1) }}
                  className="w-full px-2.5 py-1.5 border border-border text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div>
                <label htmlFor="filter-date-from" className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">From Date</label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                  className="w-full px-2.5 py-1.5 border border-border text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="filter-date-to" className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">To Date</label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1) }}
                  className="w-full px-2.5 py-1.5 border border-border text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {hasFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-surface border border-border overflow-hidden relative">
        {loading && data && (
          <div className="absolute inset-0 bg-surface/60 z-10 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-primary" />
          </div>
        )}

        <div className="sm:hidden divide-y divide-border-light">
          {data?.submissions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-muted text-sm">No submissions found.</p>
            </div>
          ) : (
            data?.submissions.map(sub => {
              const statusConfig = STATUS_CONFIG[sub.status] || STATUS_CONFIG.PENDING
              return (
                <div key={sub.id} className="p-4 animate-fade-in">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text text-sm truncate">{sub.checkpoint}</p>
                      <p className="text-xs text-text-muted">{sub.module}</p>
                    </div>
                    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 ml-2 flex-shrink-0 ${statusBadge(sub.status)}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(sub.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      {sub.evidenceCount} files
                    </span>
                    <span className="font-medium text-primary">{sub.score} pts</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto relative">
          <table className="w-full">
            <thead>
              <tr className="bg-header-bg border-b border-border">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Module</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Checkpoint</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Compliance</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Accuracy</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Corrective Action</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}
              {!loading && data?.submissions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-text-muted text-sm">No submissions found.</p>
                  </td>
                </tr>
              )}
              {!loading && data?.submissions.map(sub => {
                const statusConfig = STATUS_CONFIG[sub.status] || STATUS_CONFIG.PENDING
                return (
                  <tr key={sub.id} className="hover:bg-surface-alt animate-fade-in">
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {sub.module}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text max-w-[200px] truncate">
                      {sub.checkpoint}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 ${statusBadge(sub.status)}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text whitespace-nowrap">
                      {formatDate(sub.date)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {sub.compliance ? COMPLIANCE_CONFIG[sub.compliance] || sub.compliance : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {sub.accuracy ? ACCURACY_CONFIG[sub.accuracy] || sub.accuracy : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary max-w-[150px] truncate">
                      {sub.correctiveAction || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium text-primary">
                      {sub.score}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        {sub.evidenceCount}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
              {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
              {data.pagination.total} results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs font-medium text-text-secondary hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(data!.pagination.totalPages, p + 1))}
                disabled={page === data?.pagination.totalPages}
                aria-label="Next page"
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs font-medium text-text-secondary hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
