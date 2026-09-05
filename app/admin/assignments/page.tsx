'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarCheck,
  Plus,
  Search,
  Trash2,
  AlertCircle,
  Loader2,
  X,
  Check,
} from 'lucide-react'

interface AssignmentItem {
  id: string
  assignedDate: string
  dueDate: string | null
  frequency: string
  status: string
  user: {
    id: string
    fullName: string
    employeeCode: string
    email: string
  }
  checkpoint: {
    id: string
    title: string
    score: number
    module: {
      id: string
      name: string
      slug: string
    }
  }
}

interface UserOption {
  id: string
  fullName: string
  employeeCode: string
  department?: { name: string } | null
}

interface ModuleOption {
  id: string
  name: string
  slug: string
  checkpoints: Array<{
    id: string
    title: string
    score: number
  }>
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedModule, setSelectedModule] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [search, setSearch] = useState('')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [assignUserIds, setAssignUserIds] = useState<string[]>([])
  const [assignModuleId, setAssignModuleId] = useState('')
  const [assignCheckpointIds, setAssignCheckpointIds] = useState<string[]>([])
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0])
  const [assignFrequency, setAssignFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONE_TIME'>('DAILY')
  const [assigning, setAssigning] = useState(false)
  const [modalError, setModalError] = useState('')

  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedUser) params.append('userId', selectedUser)
      if (selectedModule) params.append('moduleId', selectedModule)
      if (selectedDate) params.append('date', selectedDate)

      const res = await fetch(`/api/admin/assignments?${params.toString()}`)
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
        setAssignments(result.data.assignments)
        setUsers(result.data.users)
        setModules(result.data.modules)
      } else {
        setError(result.message || 'Failed to load assignments')
      }
    } catch {
      setError('Network error loading assignments')
    } finally {
      setLoading(false)
    }
  }, [selectedUser, selectedModule, selectedDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssignments()
  }, [fetchAssignments])

  const openAssignModal = () => {
    setAssignUserIds([])
    setAssignModuleId(modules[0]?.id || '')
    setAssignCheckpointIds(modules[0]?.checkpoints.map(cp => cp.id) || [])
    setAssignDate(new Date().toISOString().split('T')[0])
    setAssignFrequency('DAILY')
    setModalError('')
    setModalOpen(true)
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (assignUserIds.length === 0) {
      setModalError('Please select at least one user')
      return
    }
    if (assignCheckpointIds.length === 0) {
      setModalError('Please select at least one checkpoint')
      return
    }

    setAssigning(true)
    setModalError('')

    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: assignUserIds,
          checkpointIds: assignCheckpointIds,
          assignedDate: assignDate,
          frequency: assignFrequency,
        }),
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
        setModalOpen(false)
        fetchAssignments()
      } else {
        setModalError(result.message || 'Failed to assign checkpoints')
      }
    } catch {
      setModalError('Network error assigning checkpoints')
    } finally {
      setAssigning(false)
    }
  }

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/assignments?id=${id}`, { method: 'DELETE' })
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
        setAssignments(prev => prev.filter(a => a.id !== id))
      } else {
        alert(result.message || 'Failed to delete assignment')
      }
    } catch {
      alert('Error deleting assignment')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setAssignUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const toggleCheckpointSelection = (cpId: string) => {
    setAssignCheckpointIds(prev =>
      prev.includes(cpId) ? prev.filter(id => id !== cpId) : [...prev, cpId]
    )
  }

  const filteredAssignments = assignments.filter(a => {
    const matchesSearch =
      a.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.user.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
      a.checkpoint.title.toLowerCase().includes(search.toLowerCase()) ||
      a.checkpoint.module.name.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-success bg-success/10'
      case 'IN_PROGRESS':
      case 'IN PROGRESS':
        return 'text-warning bg-warning/10'
      case 'PENDING':
        return 'text-text-muted bg-surface-alt'
      case 'OVERDUE':
        return 'text-danger bg-danger/10'
      default:
        return 'text-text-muted bg-surface-alt'
    }
  }

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-text flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-text-muted" />
              Checkpoint Assignments
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Assign checkpoints to employees and manage schedules.
            </p>
          </div>
          <button
            onClick={openAssignModal}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Assign Checkpoints
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-surface border border-border-light rounded-md mb-4">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search"
                type="text"
                placeholder="Search user, checkpoint..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-border rounded text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filterUser" className="text-xs text-text-muted font-medium">User</label>
              <select
                id="filterUser"
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="px-2.5 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-surface"
              >
                <option value="">All</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filterModule" className="text-xs text-text-muted font-medium">Module</label>
              <select
                id="filterModule"
                value={selectedModule}
                onChange={e => setSelectedModule(e.target.value)}
                className="px-2.5 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-surface"
              >
                <option value="">All</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filterDate" className="text-xs text-text-muted font-medium">Date</label>
              <input
                id="filterDate"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            {(selectedUser || selectedModule || selectedDate || search) && (
              <button
                onClick={() => {
                  setSelectedUser('')
                  setSelectedModule('')
                  setSelectedDate('')
                  setSearch('')
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
              <span className="text-sm text-text-muted">Loading assignments...</span>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-16">
              <CalendarCheck className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm font-medium text-text">No assignments found</p>
              <p className="text-xs text-text-muted mt-1">Try adjusting your filters or create a new assignment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light bg-header-bg">
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">User</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Module</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Checkpoint</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Assigned</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Due</th>
                    <th className="text-left text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Status</th>
                    <th className="text-right text-xs font-semibold text-white/60 uppercase tracking-wide px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {filteredAssignments.map(a => (
                    <tr key={a.id} className="hover:bg-surface-alt">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-text">{a.user.fullName}</div>
                        <div className="text-xs text-text-muted">{a.user.employeeCode}</div>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{a.checkpoint.module.name}</td>
                      <td className="px-4 py-2.5 max-w-[200px]">
                        <span className="text-text truncate block">{a.checkpoint.title}</span>
                        <span className="text-xs text-text-muted">Score: {a.checkpoint.score}</span>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary text-xs font-mono">{a.assignedDate}</td>
                      <td className="px-4 py-2.5 text-text-secondary text-xs font-mono">{a.dueDate || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${getStatusStyle(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteAssignment(a.id)}
                          disabled={deletingId === a.id}
                          className="p-1 text-text-muted hover:text-danger"
                          title="Remove"
                        >
                          {deletingId === a.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-danger" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredAssignments.length > 0 && (
            <div className="border-t border-border-light px-4 py-2.5 text-xs text-text-muted">
              {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Bulk Assignment Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop">
            <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col z-10 overflow-hidden animate-scale-in">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light bg-surface-alt">
                <h3 className="text-base font-bold text-text">Assign Checkpoints</h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 text-text-muted hover:text-text rounded-lg hover:bg-surface-alt transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalError && (
                <div className="mx-5 mt-4 bg-danger/10 border border-danger/30 text-danger text-xs px-3 py-2 rounded flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleCreateAssignment} className="flex flex-col flex-1 overflow-hidden">
                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">

                  {/* Select Users */}
                  <div>
                    <label htmlFor="modalUsers" className="block text-sm font-medium text-text-secondary mb-1">
                      Users <span className="text-danger">*</span>
                    </label>
                    <div className="flex items-center gap-2 mb-1.5">
                      <button
                        type="button"
                        onClick={() => setAssignUserIds(users.map(u => u.id))}
                        className="text-xs text-primary hover:text-primary-hover font-medium"
                      >
                        Select all
                      </button>
                      <span className="text-border-light">|</span>
                      <button
                        type="button"
                        onClick={() => setAssignUserIds([])}
                        className="text-xs text-text-muted hover:text-text"
                      >
                        Clear
                      </button>
                      <span className="text-xs text-text-muted ml-auto">{assignUserIds.length} selected</span>
                    </div>
                    <div
                      id="modalUsers"
                      className="max-h-32 overflow-y-auto border border-border-light rounded divide-y divide-border-light"
                    >
                      {users.map(user => {
                        const isSelected = assignUserIds.includes(user.id)
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
                      })}
                    </div>
                  </div>

                  {/* Select Module & Checkpoints */}
                  <div>
                    <label htmlFor="modalModule" className="block text-sm font-medium text-text-secondary mb-1">
                      Module <span className="text-danger">*</span>
                    </label>
                    <select
                      id="modalModule"
                      value={assignModuleId}
                      onChange={e => {
                        const newModId = e.target.value
                        setAssignModuleId(newModId)
                        const mod = modules.find(m => m.id === newModId)
                        if (mod) setAssignCheckpointIds(mod.checkpoints.map(cp => cp.id))
                      }}
                      className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-surface"
                    >
                      {modules.map(mod => (
                        <option key={mod.id} value={mod.id}>
                          {mod.name} ({mod.checkpoints.length} checkpoints)
                        </option>
                      ))}
                    </select>

                    {assignModuleId && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-muted">
                            Checkpoints ({assignCheckpointIds.length} selected)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const mod = modules.find(m => m.id === assignModuleId)
                                if (mod) setAssignCheckpointIds(mod.checkpoints.map(cp => cp.id))
                              }}
                              className="text-xs text-primary hover:text-primary-hover font-medium"
                            >
                              Select all
                            </button>
                            <span className="text-border-light">|</span>
                            <button
                              type="button"
                              onClick={() => setAssignCheckpointIds([])}
                              className="text-xs text-text-muted hover:text-text"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div
                          id="modalCheckpoints"
                          className="max-h-32 overflow-y-auto border border-border-light rounded divide-y divide-border-light"
                        >
                          {modules
                            .find(m => m.id === assignModuleId)
                            ?.checkpoints.map(cp => {
                              const isSelected = assignCheckpointIds.includes(cp.id)
                              return (
                                <div
                                  key={cp.id}
                                  onClick={() => toggleCheckpointSelection(cp.id)}
                                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                                    isSelected ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-surface-alt'
                                  }`}
                                >
                                  <span className="truncate pr-2">{cp.title}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Date & Frequency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="modalDate" className="block text-sm font-medium text-text-secondary mb-1">
                        Assignment Date <span className="text-danger">*</span>
                      </label>
                      <input
                        id="modalDate"
                        type="date"
                        required
                        value={assignDate}
                        onChange={e => setAssignDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="modalFrequency" className="block text-sm font-medium text-text-secondary mb-1">
                        Frequency
                      </label>
                      <select
                        id="modalFrequency"
                        value={assignFrequency}
                        onChange={e => setAssignFrequency(e.target.value as typeof assignFrequency)}
                        className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-surface"
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="ONE_TIME">One Time</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border-light">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={assigning}
                    className="px-3.5 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-alt rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigning}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded inline-flex items-center gap-1.5"
                  >
                    {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Assign Checkpoints
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
