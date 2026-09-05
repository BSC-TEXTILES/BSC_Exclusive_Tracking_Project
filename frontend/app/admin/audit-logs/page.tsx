'use client'

import { useState, useEffect } from 'react'
import {
  ScrollText,
  X,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface AuditLog {
  id: string
  createdAt: string
  user: { id: string; fullName: string; employeeCode: string } | null
  action: string
  entityType: string
  entityId: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  ipAddress: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const actionBadge = (action: string) => {
  if (action.includes('CREATED')) return 'bg-success/10 text-success border-success/20'
  if (action.includes('UPDATED') || action.includes('REVIEWED')) return 'bg-primary-light text-primary border-primary/20'
  if (action.includes('DELETED') || action.includes('REJECTED')) return 'bg-danger/10 text-danger border-danger/20'
  if (action.includes('LOGIN')) return 'bg-warning/10 text-warning border-warning/20'
  return 'bg-surface-alt text-text-secondary border-border-light'
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [showDetail, setShowDetail] = useState<AuditLog | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: '1', limit: '50' })
        if (userFilter) params.set('userId', userFilter)
        if (actionFilter) params.set('action', actionFilter)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        const res = await fetch(`/api/admin/audit-logs?${params}`, { signal: controller.signal })
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const data = await res.json()
        if (data.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (data.success) {
          setLogs(data.data.logs)
          setPagination(data.data.pagination)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [userFilter, actionFilter, dateFrom, dateTo])

  const fetchLogs = async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (userFilter) params.set('userId', userFilter)
      if (actionFilter) params.set('action', actionFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/admin/audit-logs?${params}`)
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const data = await res.json()
      if (data.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (data.success) {
        setLogs(data.data.logs)
        setPagination(data.data.pagination)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  const formatDetails = (log: AuditLog) => {
    const parts: string[] = []
    if (log.newValues && typeof log.newValues === 'object') {
      const entries = Object.entries(log.newValues).filter(([, v]) => v !== null && v !== undefined)
      if (entries.length > 0) parts.push(entries.map(([k, v]) => `${k}: ${v}`).join(', '))
    }
    if (log.oldValues && typeof log.oldValues === 'object') {
      const entries = Object.entries(log.oldValues).filter(([, v]) => v !== null && v !== undefined)
      if (entries.length > 0) parts.push(`was: ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }
    return parts.join(' | ') || '-'
  }

  const exportCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Details', 'IP Address']
    const rows = logs.map(l => [
      l.createdAt, l.user?.fullName || '', l.action, l.entityType, l.entityId || '', formatDetails(l), l.ipAddress || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text">Audit Logs</h1>
            <p className="text-sm text-text-secondary mt-0.5">Track all system activity and changes</p>
          </div>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-md shadow-sm hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="bg-surface border border-border rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="filter-user" className="block text-xs font-medium text-text-muted mb-1">
                  User
                </label>
                <input
                  id="filter-user"
                  type="text"
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  placeholder="Filter by user..."
                  className="w-full px-3 py-2 border border-border rounded-md text-sm shadow-sm bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="filter-action" className="block text-xs font-medium text-text-muted mb-1">
                  Action Type
                </label>
                <select
                  id="filter-action"
                  value={actionFilter}
                  onChange={e => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm shadow-sm bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="">All Actions</option>
                  <option value="LOGIN">Login</option>
                  <option value="USER_CREATED">User Created</option>
                  <option value="USER_UPDATED">User Updated</option>
                  <option value="SUBMISSION_CREATED">Submission Created</option>
                  <option value="SUBMISSION_REVIEWED">Submission Reviewed</option>
                  <option value="SUBMISSION_REJECTED">Submission Rejected</option>
                  <option value="MODULE_CREATED">Module Created</option>
                  <option value="MODULE_UPDATED">Module Updated</option>
                  <option value="CHECKPOINT_CREATED">Checkpoint Created</option>
                  <option value="CHECKPOINT_UPDATED">Checkpoint Updated</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-date-from" className="block text-xs font-medium text-text-muted mb-1">
                  Date From
                </label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm shadow-sm bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="filter-date-to" className="block text-xs font-medium text-text-muted mb-1">
                  Date To
                </label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm shadow-sm bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => fetchLogs(1)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Apply Filters
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="ml-2 text-sm text-text-muted">Loading audit logs...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ScrollText className="w-10 h-10 text-text-muted/40 mb-2" />
                <p className="text-sm font-medium text-text">No audit logs found</p>
                <p className="text-xs text-text-muted mt-0.5">Try adjusting your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm divide-y divide-border-light">
                <thead className="bg-header-bg">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Timestamp</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/60 uppercase tracking-wider hidden md:table-cell">User</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/60 uppercase tracking-wider hidden md:table-cell">Entity</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/60 uppercase tracking-wider hidden lg:table-cell">Details</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/60 uppercase tracking-wider hidden lg:table-cell">IP</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-white/60 uppercase tracking-wider">View</th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border-light">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-surface-alt">
                      <td className="px-4 py-2.5 text-text-secondary text-xs whitespace-nowrap">{formatTimestamp(log.createdAt)}</td>
                      <td className="px-4 py-2.5 font-medium text-text hidden md:table-cell">{log.user?.fullName || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${actionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary hidden md:table-cell">{log.entityType}</td>
                      <td className="px-4 py-2.5 text-text-muted text-xs max-w-[200px] truncate hidden lg:table-cell">{formatDetails(log)}</td>
                      <td className="px-4 py-2.5 text-text-muted text-xs font-mono hidden lg:table-cell">{log.ipAddress || '-'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setShowDetail(log)} className="text-xs text-primary hover:text-primary-hover font-medium">
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-alt rounded-b-lg">
              <p className="text-sm text-text-secondary">
                Page <span className="font-medium">{pagination.page}</span> of <span className="font-medium">{pagination.totalPages}</span>{' '}
                <span className="text-text-muted">({pagination.total} entries)</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchLogs(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-text-secondary bg-surface border border-border rounded-md hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <button
                  onClick={() => fetchLogs(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-text-secondary bg-surface border border-border rounded-md hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm modal-backdrop" onClick={() => setShowDetail(null)} />
          <div className="relative bg-surface w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border border-border z-10 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-light bg-surface-alt flex-shrink-0">
              <h2 className="text-base font-bold text-text">Audit Log Details</h2>
              <button onClick={() => setShowDetail(null)} className="p-1.5 text-text-muted hover:text-text hover:bg-surface-alt rounded-lg transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">Timestamp</p>
                  <p className="text-text">{formatTimestamp(showDetail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">User</p>
                  <p className="text-text">{showDetail.user?.fullName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">Action</p>
                  <p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${actionBadge(showDetail.action)}`}>
                      {showDetail.action}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">Entity</p>
                  <p className="text-text">{showDetail.entityType}{showDetail.entityId ? ` / ${showDetail.entityId}` : ''}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-medium text-text-muted mb-1">Details</p>
                  <p className="text-text">{formatDetails(showDetail)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">IP Address</p>
                  <p className="text-text font-mono text-xs">{showDetail.ipAddress || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
