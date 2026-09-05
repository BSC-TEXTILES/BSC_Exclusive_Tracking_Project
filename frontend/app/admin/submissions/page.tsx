'use client'

import { useState, useEffect } from 'react'
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Loader2,
  Download,
} from 'lucide-react'

interface Submission {
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
  createdAt: string
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

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    SUBMITTED: 'bg-primary-light text-primary border-primary/20',
    APPROVED: 'bg-success/10 text-success border-success/20',
    REJECTED: 'bg-danger/10 text-danger border-danger/20',
    PENDING: 'bg-warning/10 text-warning border-warning/20',
    NOT_APPLICABLE: 'bg-surface-alt text-text-muted border-border',
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
    NO_TRANSACTION: 'bg-surface-alt text-text-muted',
    YET_TO_IMPLEMENT: 'bg-primary-light text-primary',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[val] || 'bg-surface-alt text-text-muted'}`}>
      {val.replace(/_/g, ' ')}
    </span>
  )
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserOption[]>([])
  const [modules, setModules] = useState<ModuleOption[]>([])

  const [userFilter, setUserFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [showDetail, setShowDetail] = useState<Submission | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (userFilter) params.set('userId', userFilter)
      if (moduleFilter) params.set('moduleId', moduleFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/admin/submissions?${params}`)
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const data = await res.json()
      if (data.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
        if (data.success) setSubmissions(data.data.submissions)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (userFilter) params.set('userId', userFilter)
        if (moduleFilter) params.set('moduleId', moduleFilter)
        if (statusFilter) params.set('status', statusFilter)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        const res = await fetch(`/api/admin/submissions?${params}`, { signal: controller.signal })
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const data = await res.json()
        if (data.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (!controller.signal.aborted && data.success) setSubmissions(data.data.submissions)
      } catch {
        // silent
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [userFilter, moduleFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [usersRes, modulesRes] = await Promise.all([
          fetch('/api/admin/users?limit=500'),
          fetch('/api/admin/modules'),
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
        if (usersData.success) setUsers(usersData.data.users)
        const modulesData = await modulesRes.json()
        if (modulesData.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (modulesData.success) setModules(modulesData.data.modules)
      } catch {}
    }
    loadMeta()
  }, [])

  const handleReview = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/submissions/${id}/review`, {
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
        fetchSubmissions()
      }
    } catch {}
    setActionLoading(false)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const exportCSV = () => {
    const headers = ['User', 'Employee ID', 'Module', 'Checkpoint', 'Date', 'Compliance', 'Accuracy', 'Score', 'Status', 'Submitted At']
    const rows = submissions.map(s => [
      s.user.fullName, s.user.employeeCode, s.module.name, s.checkpoint.title, s.submissionDate,
      s.answer?.complianceStatus || '', s.answer?.accuracyStatus || '', s.checkpoint.score?.toString() || '',
      s.status, s.submittedAt || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-text">Submissions</h1>
            <p className="text-sm text-text-secondary mt-0.5">Review and manage checkpoint submissions</p>
          </div>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary bg-surface border border-border rounded hover:bg-surface-alt"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="bg-surface border border-border-light rounded-lg">
          <div className="p-4 border-b border-border-light">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label htmlFor="filter-user" className="block text-xs font-medium text-text-muted mb-1">User</label>
                <select
                  id="filter-user"
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text bg-surface focus:outline-none focus:border-primary"
                >
                  <option value="">All Users</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.employeeCode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-module" className="block text-xs font-medium text-text-muted mb-1">Module</label>
                <select
                  id="filter-module"
                  value={moduleFilter}
                  onChange={e => setModuleFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text bg-surface focus:outline-none focus:border-primary"
                >
                  <option value="">All Modules</option>
                  {modules.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-status" className="block text-xs font-medium text-text-muted mb-1">Status</label>
                <select
                  id="filter-status"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text bg-surface focus:outline-none focus:border-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-date-from" className="block text-xs font-medium text-text-muted mb-1">Date From</label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="filter-date-to" className="block text-xs font-medium text-text-muted mb-1">Date To</label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={fetchSubmissions}
                className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded bg-primary-hover"
              >
                Apply Filters
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                <span className="ml-2 text-sm text-text-secondary">Loading submissions...</span>
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <FileCheck className="w-8 h-8 text-text-muted mb-2" />
                <p className="text-sm font-medium text-text-secondary">No submissions found</p>
                <p className="text-xs text-text-muted mt-0.5">Try adjusting your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-header-bg border-b border-border-light">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-white/60 uppercase tracking-wider">User</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-white/60 uppercase tracking-wider hidden md:table-cell">Module</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Checkpoint</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-white/60 uppercase tracking-wider hidden sm:table-cell">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-white/60 uppercase tracking-wider hidden lg:table-cell">Score</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {submissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-surface-alt">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-text text-sm">{sub.user.fullName}</div>
                        <div className="text-xs text-text-secondary font-mono">{sub.user.employeeCode}</div>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary hidden md:table-cell">{sub.module.name}</td>
                      <td className="px-4 py-2.5 text-text">{sub.checkpoint.title}</td>
                      <td className="px-4 py-2.5">{statusBadge(sub.status)}</td>
                      <td className="px-4 py-2.5 text-text-secondary text-xs hidden sm:table-cell">{formatDate(sub.submissionDate)}</td>
                      <td className="px-4 py-2.5 font-medium text-text hidden lg:table-cell">{sub.checkpoint.score ?? '-'}</td>
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
            )}
          </div>
        </div>
      </div>

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
                  <label className="text-xs font-medium text-text-muted">User</label>
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
