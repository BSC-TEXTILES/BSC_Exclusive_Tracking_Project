'use client'

import { useState, useEffect } from 'react'
import {
  FolderOpen,
  Plus,
  Search,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  Check,
} from 'lucide-react'

interface ProjectItem {
  id: string
  name: string
  department: string | null
  checkpointCount: number
  status: 'ACTIVE' | 'INACTIVE'
  description: string | null
}

interface AvailableModule {
  id: string
  name: string
  department: string | null
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  // Assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [availableModules, setAvailableModules] = useState<AvailableModule[]>([])
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/supervisor/projects', { signal: controller.signal })
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
            setProjects(result.data.projects)
          } else {
            setError(result.message || 'Failed to load projects')
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!cancelled) setError('Network error loading projects')
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
    setSelectedModuleIds([])
    setAssignError('')
    try {
      const res = await fetch('/api/supervisor/projects/available')
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
        setAvailableModules(result.data.modules)
      }
    } catch {
      setAssignError('Failed to load available modules')
    }
    setAssignModalOpen(true)
  }

  const handleAssign = async () => {
    if (selectedModuleIds.length === 0) {
      setAssignError('Please select at least one module')
      return
    }
    setAssigning(true)
    setAssignError('')
    try {
      const res = await fetch('/api/supervisor/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleIds: selectedModuleIds }),
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
        setAssignError(result.message || 'Failed to assign modules')
      }
    } catch {
      setAssignError('Network error assigning modules')
    } finally {
      setAssigning(false)
    }
  }

  const toggleModuleSelection = (moduleId: string) => {
    setSelectedModuleIds(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    )
  }

  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.department && p.department.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6 max-w-7xl mx-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-text-muted" />
            Projects
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage modules assigned to your supervision.
          </p>
        </div>
        <button
          onClick={openAssignModal}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Assign Module
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-surface border border-border mb-4">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects..."
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
          <p className="text-sm text-text-secondary mt-2">Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-surface border border-border p-12 text-center">
          <FolderOpen className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <h3 className="text-sm font-medium text-text">No projects found</h3>
          <p className="text-xs text-text-secondary mt-1">
            {search ? 'Try adjusting your search criteria' : 'Assign modules to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-header-bg">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Module Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Department</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Checkpoints</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(project => (
                  <tr key={project.id} className="border-b border-border-light last:border-0 hover:bg-surface-alt">
                    <td className="px-4 py-3">
                      <span className="text-text font-medium">{project.name}</span>
                      {project.description && (
                        <p className="text-xs text-text-muted mt-0.5 truncate max-w-xs">{project.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{project.department || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-text-secondary">
                        <ClipboardCheck className="w-3.5 h-3.5 text-text-muted" />
                        {project.checkpointCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          project.status === 'ACTIVE' ? 'text-success' : 'text-text-secondary'
                        }`}
                      >
                        {project.status === 'ACTIVE' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {project.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-border text-xs text-text-muted">
            {filteredProjects.length} module{filteredProjects.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Assign Module Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-md w-full p-6 z-10 animate-scale-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light">
              <h3 className="text-base font-bold text-text">Assign Module</h3>
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
                <span className="text-xs text-text-muted">Available Modules</span>
                <span className="text-xs text-text-muted">{selectedModuleIds.length} selected</span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-border-light rounded divide-y divide-border-light">
                {availableModules.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-text-muted">No available modules to assign</div>
                ) : (
                  availableModules.map(mod => {
                    const isSelected = selectedModuleIds.includes(mod.id)
                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleModuleSelection(mod.id)}
                        className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                          isSelected ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-surface-alt'
                        }`}
                      >
                        <span>
                          {mod.name}
                          {mod.department && <span className="text-text-muted text-xs ml-1.5">({mod.department})</span>}
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
    </div>
  )
}
