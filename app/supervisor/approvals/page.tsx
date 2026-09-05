'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface ApprovalItem {
  id: string
  user: { id: string; fullName: string; employeeCode: string }
  module: { id: string; name: string }
  checkpoint: { id: string; title: string; score: number }
  submissionDate: string
  status: string
  submittedAt: string | null
  answer: {
    complianceStatus: string | null
    accuracyStatus: string | null
    comments: string | null
    correctiveAction: string | null
  } | null
}

interface UserOption {
  id: string
  fullName: string
  employeeCode: string
}

interface ModuleOption {
  id: string
  name: string
}

export default function ApprovalsPage() {
  const [submissions, setSubmissions] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [userFilter, setUserFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [users, setUsers] = useState<UserOption[]>([])
  const [modules, setModules] = useState<ModuleOption[]>([])

  // Detail modal
  const [showDetail, setShowDetail] = useState<ApprovalItem | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (userFilter) params.set('userId', userFilter)
      if (moduleFilter) params.set('moduleId', moduleFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/supervisor/approvals?${params.toString()}`)
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const result = await res.json()
      if (result.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (result.success) {
        setSubmissions(result.data.submissions)
      } else {
        setError(result.message || 'Failed to load approvals')
      }
    } catch {
      setError('Network error loading approvals')
    } finally {
      setLoading(false)
    }
  }, [userFilter, moduleFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [usersRes, modulesRes] = await Promise.all([
          fetch('/api/supervisor/employees'),
          fetch('/api/supervisor/projects'),
        ])
        if (usersRes.status === 401 || modulesRes.status === 401) {
          window.location.replace('/login')
          return
        }
        const usersData = await usersRes.json()
        if (usersData.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (usersData.success) setUsers(usersData.data.employees || [])
        const modulesData = await modulesRes.json()
        if (modulesData.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (modulesData.success) setModules(modulesData.data.projects || [])
      } catch {}
    }
    loadMeta()
  }, [])

  const handleReview = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/supervisor/approvals/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, reviewComment }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      if (res.ok) {
        setShowDetail(null)
        setReviewComment('')
        setSelectedIds(prev => prev.filter(i => i !== id))
        fetchSubmissions()
      }
    } catch {}
    setActionLoading(false)
  }

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/supervisor/approvals/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status: 'APPROVED' }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      if (res.ok) {
        setSelectedIds([])
        fetchSubmissions()
      }
    } catch {}
    setActionLoading(false)
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    const pendingIds = submissions
      .filter(s => s.status === 'SUBMITTED')
      .map(s => s.id)
    if (selectedIds.length === pendingIds.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(pendingIds)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      SUBMITTED: 'bg-primary-light text-primary border-primary/20',
      APPROVED: 'bg-success/10 text-success border-success/20',
      REJECTED: 'bg-danger/10 text-danger border-danger/20',
      PENDING: 'bg-warning/10 text-warning border-warning/20',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.PENDING}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  const complianceBadge = (val: string | null) => {
    if (!val) return <span className="text-text-muted">-</span>
    const styles: Record<string, string> = {
      FULLY_FOLLOWED: 'bg-success/10 text-success',
      PARTIALLY_FOLLOWED: 'bg-warning/10 text-warning',
      NOT_FOLLOWED: 'bg-danger/10 text-danger',
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[val] || 'bg-surface-alt text-text-muted'}`}>
        {val.replace(/_/g, ' ')}
      </span>
    )
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const pendingCount = submissions.filter(s => s.status === 'SUBMITTED').length

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-text flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-text-muted" />
              Approvals
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Review and approve submissions from your team.
              {pendingCount > 0 && (
                <span className="ml-2 text-warning font-medium">({pendingCount} pending)</span>
              )}
            </p>
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 bg-success text-white px-4 py-2 rounded text-sm font-medium hover:bg-success/90 disabled:opacity-60"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve Selected ({selectedIds.length})
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="bg-surface border border-border-light rounded-md mb-4">
          <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employee or checkpoint..."
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-border rounded text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted font-medium">Module</label>
              <select
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-surface"
              >
                <option value="">All</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted font-medium">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-surface"
              >
                <option value="">All</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted font-medium">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted font-medium">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            {(userFilter || moduleFilter || statusFilter || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setUserFilter('')
                  setModuleFilter('')
                  setStatusFilter('')
                  setDateFrom('')
                  setDateTo('')
                }}
                className="text-xs text-text-muted hover:text-text font-medium ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 mb-4 flex items-center gap-2 rounded-md">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Table */}
        <div className="bg-surface border border-border-light rounded-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-text-muted animate-spin mr-2" />
              <span className="text-sm text-text-muted">Loading approvals...</span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardCheck className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm font-medium text-text">No submissions found</p>
              <p className="text-xs text-text-muted mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light bg-header-bg">
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5 w-10">
                      <input
                        type="checkbox"
                        checked={submissions.filter(s => s.status === 'SUBMITTED').length > 0 && selectedIds.length === submissions.filter(s => s.status === 'SUBMITTED').length}
                        onChange={toggleSelectAll}
                        className="rounded border-border"
                      />
                    </th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Employee</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5 hidden md:table-cell">Module</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Checkpoint</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Date</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Status</th>
                    <th className="text-right text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {submissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-surface-alt">
                      <td className="px-4 py-2.5">
                        {sub.status === 'SUBMITTED' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(sub.id)}
                            onChange={() => toggleSelection(sub.id)}
                            className="rounded border-border"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-text">{sub.user.fullName}</div>
                        <div className="text-xs text-text-secondary font-mono">{sub.user.employeeCode}</div>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary hidden md:table-cell">{sub.module.name}</td>
                      <td className="px-4 py-2.5 max-w-[200px]">
                        <span className="text-text truncate block">{sub.checkpoint.title}</span>
                        <span className="text-xs text-text-muted">Score: {sub.checkpoint.score}</span>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary text-xs font-mono">{sub.submissionDate}</td>
                      <td className="px-4 py-2.5">{statusBadge(sub.status)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {sub.status === 'SUBMITTED' && (
                            <>
                              <button
                                onClick={() => handleReview(sub.id, 'APPROVED')}
                                title="Approve"
                                disabled={actionLoading}
                                className="p-1 text-success hover:bg-success/10 rounded disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setShowDetail(sub); setReviewComment('') }}
                                title="Reject"
                                disabled={actionLoading}
                                className="p-1 text-danger hover:bg-danger/10 rounded disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setShowDetail(sub); setReviewComment('') }}
                            title="View Details"
                            className="p-1 text-text-muted hover:text-text hover:bg-surface-alt rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {submissions.length > 0 && (
            <div className="border-t border-border-light px-4 py-2.5 text-xs text-text-muted">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm modal-backdrop" onClick={() => setShowDetail(null)} />
          <div className="relative bg-surface w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border shadow-2xl z-10 animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-light bg-surface-alt">
              <h2 className="text-base font-bold text-text">Submission Detail</h2>
              <button
                onClick={() => setShowDetail(null)}
                className="p-1.5 text-text-muted hover:text-text hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs font-medium text-text-muted">Employee</label>
                  <p className="mt-0.5 text-text">{showDetail.user.fullName}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Employee ID</label>
                  <p className="mt-0.5 font-mono text-text">{showDetail.user.employeeCode}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Module</label>
                  <p className="mt-0.5 text-text">{showDetail.module.name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Checkpoint</label>
                  <p className="mt-0.5 text-text">{showDetail.checkpoint.title}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Date</label>
                  <p className="mt-0.5 text-text">{formatDate(showDetail.submissionDate)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Status</label>
                  <div className="mt-0.5">{statusBadge(showDetail.status)}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Compliance</label>
                  <div className="mt-0.5">{complianceBadge(showDetail.answer?.complianceStatus || null)}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Score</label>
                  <p className="mt-0.5 text-text font-semibold">{showDetail.checkpoint.score ?? '-'}</p>
                </div>
              </div>

              {showDetail.answer?.comments && (
                <div className="mt-4">
                  <label className="text-xs font-medium text-text-muted">Employee Comments</label>
                  <p className="mt-0.5 text-sm text-text bg-surface-alt p-3 rounded">{showDetail.answer.comments}</p>
                </div>
              )}

              {showDetail.answer?.correctiveAction && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-text-muted">Corrective Action</label>
                  <p className="mt-0.5 text-sm text-text bg-surface-alt p-3 rounded">{showDetail.answer.correctiveAction}</p>
                </div>
              )}

              {showDetail.status === 'SUBMITTED' && (
                <div className="mt-6 pt-4 border-t border-border-light">
                  <label htmlFor="review-comment" className="block text-sm font-medium text-text-secondary mb-1">Review Comment</label>
                  <textarea
                    id="review-comment"
                    rows={3}
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="Add a comment for rejection..."
                    className="w-full px-3 py-2 border border-border rounded text-sm text-text bg-surface focus:outline-none focus:border-primary resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                      onClick={() => handleReview(showDetail.id, 'APPROVED')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-success text-white text-sm font-medium rounded hover:bg-success/90 disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(showDetail.id, 'REJECTED')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-sm font-medium rounded hover:bg-danger/90 disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
