'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Search,
  Trash2,
  AlertCircle,
  Loader2,
  X,
  Check,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface TeamMember {
  id: string
  fullName: string
  employeeCode: string
  email: string
  department: string | null
  status: string
  assignedDate: string
  submissionCount: number
}

interface UnassignedUser {
  id: string
  fullName: string
  employeeCode: string
  department: string | null
}

interface SubmissionHistory {
  id: string
  checkpointTitle: string
  moduleName: string
  submissionDate: string
  status: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  // Assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [unassignedUsers, setUnassignedUsers] = useState<UnassignedUser[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  // Remove confirmation
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  // Detail view
  const [detailEmployee, setDetailEmployee] = useState<TeamMember | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionHistory[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/supervisor/employees', { signal: controller.signal })
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const result = await res.json()
        if (result.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (!cancelled) {
          if (result.success) {
            setEmployees(result.data.employees)
          } else {
            setError(result.message || 'Failed to load team members')
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!cancelled) setError('Network error loading team members')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [refreshKey])

  const openAssignModal = async () => {
    setSelectedUserIds([])
    setAssignError('')
    try {
      const res = await fetch('/api/supervisor/employees/unassigned')
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
        setUnassignedUsers(result.data.users)
      }
    } catch {
      setAssignError('Failed to load available users')
    }
    setAssignModalOpen(true)
  }

  const handleAssign = async () => {
    if (selectedUserIds.length === 0) {
      setAssignError('Please select at least one user')
      return
    }
    setAssigning(true)
    setAssignError('')
    try {
      const res = await fetch('/api/supervisor/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
      })
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
        setAssignModalOpen(false)
        setRefreshKey(k => k + 1)
      } else {
        setAssignError(result.message || 'Failed to assign employees')
      }
    } catch {
      setAssignError('Network error assigning employees')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemove = async (id: string) => {
    setRemoving(true)
    try {
      const res = await fetch(`/api/supervisor/employees/${id}`, { method: 'DELETE' })
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
        setRemoveConfirmId(null)
        setRefreshKey(k => k + 1)
      } else {
        alert(result.message || 'Failed to remove employee')
      }
    } catch {
      alert('Network error removing employee')
    } finally {
      setRemoving(false)
    }
  }

  const openDetail = async (emp: TeamMember) => {
    setDetailEmployee(emp)
    setLoadingSubmissions(true)
    try {
      const res = await fetch(`/api/supervisor/employees/${emp.id}/submissions`)
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
      }
    } catch {
      // silent
    } finally {
      setLoadingSubmissions(false)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const filteredEmployees = employees.filter(e => {
    const matchesSearch =
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
      (e.department && e.department.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusBadgeStyle = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-success-bg text-success border border-success-border'
      case 'SUBMITTED':
        return 'bg-info-bg text-info border border-info-border'
      case 'REJECTED':
        return 'bg-danger-bg text-danger border border-danger-border'
      default:
        return 'bg-surface-alt text-text-muted border border-border-light'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text flex items-center gap-2">
            <Users className="w-5 h-5 text-text-muted" />
            My Team
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage employees assigned to your supervision.
          </p>
        </div>
        <button
          onClick={openAssignModal}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Assign Employee
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-surface border border-border mb-4">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-border rounded text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-text-secondary mr-1">Status:</span>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded ${
                  statusFilter === s
                    ? 'bg-primary-light text-text'
                    : 'text-text-secondary hover:bg-surface-alt'
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-surface-alt border border-border-light p-3 mb-4 flex items-center gap-2 text-danger text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-surface border border-border p-12 text-center">
          <Loader2 className="w-5 h-5 text-text-muted mx-auto animate-spin" />
          <p className="text-sm text-text-secondary mt-2">Loading team members...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-surface border border-border p-12 text-center">
          <Users className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <h3 className="text-sm font-medium text-text">No team members found</h3>
          <p className="text-xs text-text-secondary mt-1">
            {search ? 'Try adjusting your search criteria' : 'Assign employees to your team to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-header-bg">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Employee Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Department</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Submissions</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Assigned</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="border-b border-border-light last:border-0 hover:bg-surface-alt">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-light text-primary border border-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                          {emp.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-text font-medium">{emp.fullName}</span>
                          <p className="text-xs text-text-muted">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">{emp.employeeCode}</td>
                    <td className="px-4 py-3 text-text-secondary">{emp.department || '—'}</td>
                    <td className="px-4 py-3 text-center text-text-secondary">{emp.submissionCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          emp.status === 'ACTIVE' ? 'text-success' : 'text-text-secondary'
                        }`}
                      >
                        {emp.status === 'ACTIVE' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">{emp.assignedDate}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openDetail(emp)}
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-light rounded"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRemoveConfirmId(emp.id)}
                          className="p-1.5 text-text-muted hover:text-danger hover:bg-surface-alt rounded"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-border text-xs text-text-muted">
            {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-surface rounded-xl shadow-2xl border border-border max-w-sm w-full p-6 z-10 animate-scale-in">
            <h3 className="text-base font-bold text-text mb-2">Remove Employee</h3>
            <p className="text-sm text-text-secondary mb-5">
              Are you sure you want to remove this employee from your team? They will need to be reassigned later.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRemoveConfirmId(null)}
                disabled={removing}
                className="px-3.5 py-1.5 text-xs font-semibold text-text-secondary bg-surface border border-border hover:bg-surface-alt rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(removeConfirmId)}
                disabled={removing}
                className="px-4 py-1.5 text-xs font-bold text-white bg-danger hover:opacity-90 rounded-lg inline-flex items-center gap-1.5 transition shadow-xs"
              >
                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Employee Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-md w-full p-6 z-10 animate-scale-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light">
              <h3 className="text-base font-bold text-text">Assign Employee to Team</h3>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface-alt transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignError && (
              <div className="bg-surface-alt border border-border-light text-danger text-xs p-2.5 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-muted">Available Users</span>
                <span className="text-xs text-text-muted">{selectedUserIds.length} selected</span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-border-light rounded divide-y divide-border-light">
                {unassignedUsers.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-text-muted">No unassigned users available</div>
                ) : (
                  unassignedUsers.map(user => {
                    const isSelected = selectedUserIds.includes(user.id)
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                          isSelected ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-surface-alt'
                        }`}
                      >
                        <span>
                          {user.fullName}
                          <span className="text-text-muted text-xs ml-1.5">({user.employeeCode})</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setAssignModalOpen(false)}
                disabled={assigning}
                className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-alt rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded inline-flex items-center gap-1.5"
              >
                {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailEmployee && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-lg w-full max-h-[90vh] flex flex-col z-10 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light bg-surface-alt">
              <h3 className="text-base font-bold text-text">{detailEmployee.fullName}</h3>
              <button
                onClick={() => setDetailEmployee(null)}
                className="p-1 text-text-muted hover:text-text rounded-lg hover:bg-surface-alt transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs font-medium text-text-muted">Employee Code</label>
                  <p className="mt-0.5 font-mono text-text">{detailEmployee.employeeCode}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Email</label>
                  <p className="mt-0.5 text-text">{detailEmployee.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Department</label>
                  <p className="mt-0.5 text-text">{detailEmployee.department || '—'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Status</label>
                  <p className="mt-0.5 text-text">{detailEmployee.status}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-text mb-2">Submission History</h4>
                {loadingSubmissions ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                  </div>
                ) : submissions.length === 0 ? (
                  <p className="text-xs text-text-muted py-4 text-center">No submissions yet</p>
                ) : (
                  <div className="divide-y divide-border-light border border-border-light rounded max-h-48 overflow-y-auto">
                    {submissions.map(sub => (
                      <div key={sub.id} className="px-3 py-2 flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <p className="text-text font-medium truncate">{sub.checkpointTitle}</p>
                          <p className="text-text-muted">{sub.moduleName} · {sub.submissionDate}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${statusBadgeStyle(sub.status)}`}>
                          {sub.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
