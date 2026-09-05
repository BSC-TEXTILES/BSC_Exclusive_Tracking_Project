'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  ClipboardCheck,
  X,
  Loader2,
  Check,
} from 'lucide-react'

interface Checkpoint {
  id: string
  moduleId: string
  moduleName: string
  title: string
  description: string | null
  score: number
  isAccuracyRequired: boolean
  isCorrectiveActionRequired: boolean
  isPhotoRequired: boolean
  status: string
  displayOrder: number
}

interface ModuleOption {
  id: string
  name: string
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-success-light text-success border-success',
    INACTIVE: 'bg-surface-alt text-text-secondary border-border-light',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.INACTIVE}`}>
      {status}
    </span>
  )
}

const BoolBadge = ({ value }: { value: boolean }) => (
  value
    ? <span className="inline-flex items-center gap-1 text-success"><Check className="w-3.5 h-3.5" /> Yes</span>
    : <span className="text-text-muted">No</span>
)

const emptyForm = {
  moduleId: '',
  title: '',
  description: '',
  score: 5,
  isAccuracyRequired: false,
  isCorrectiveActionRequired: false,
  isPhotoRequired: false,
  displayOrder: 0,
  status: 'ACTIVE',
}

export default function CheckpointsPage() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Checkpoint | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchCheckpoints = async (searchVal?: string, moduleFilterVal?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchVal) params.set('search', searchVal)
      if (moduleFilterVal) params.set('moduleId', moduleFilterVal)
      const res = await fetch(`/api/admin/checkpoints?${params}`)
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const data = await res.json()
      if (data.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (data.success) setCheckpoints(data.data.checkpoints || [])
    } catch {
      setError('Failed to load checkpoints')
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
        if (search) params.set('search', search)
        if (moduleFilter) params.set('moduleId', moduleFilter)
        const res = await fetch(`/api/admin/checkpoints?${params}`, { signal: controller.signal })
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const data = await res.json()
        if (data.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (!controller.signal.aborted && data.success) setCheckpoints(data.data.checkpoints || [])
      } catch {
        if (!controller.signal.aborted) setError('Failed to load checkpoints')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [search, moduleFilter])

  useEffect(() => {
    const loadModules = async () => {
      try {
        const res = await fetch('/api/admin/modules')
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        if (res.ok) {
          const data = await res.json()
          if (data.code === 'UNAUTHORIZED') {
            window.location.replace('/login')
            return
          }
          if (data.success) setModules(data.data.modules)
        }
      } catch {}
    }
    loadModules()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCheckpoints()
  }

  const openCreateModal = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  const openEditModal = (cp: Checkpoint) => {
    setEditing(cp)
    setForm({
      moduleId: cp.moduleId,
      title: cp.title,
      description: cp.description || '',
      score: cp.score,
      isAccuracyRequired: cp.isAccuracyRequired,
      isCorrectiveActionRequired: cp.isCorrectiveActionRequired,
      isPhotoRequired: cp.isPhotoRequired,
      displayOrder: cp.displayOrder,
      status: cp.status,
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url = editing ? `/api/admin/checkpoints/${editing.id}` : '/api/admin/checkpoints'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          score: Number(form.score),
          displayOrder: Number(form.displayOrder),
        }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const data = await res.json()
      if (data.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (!res.ok) {
        setError(data.message || 'Failed to save checkpoint')
        return
      }
      setShowModal(false)
      fetchCheckpoints()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (cp: Checkpoint) => {
    const newStatus = cp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const res = await fetch(`/api/admin/checkpoints/${cp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      if (res.ok) fetchCheckpoints()
    } catch {}
  }

  return (
    <div className="min-h-full bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-text">Checkpoints</h1>
            <p className="text-sm text-text-muted mt-0.5">Manage compliance checkpoints</p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary-hover"
          >
            <Plus className="w-4 h-4" />
            Add Checkpoint
          </button>
        </div>

        <div className="bg-surface border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <form onSubmit={handleSearch} className="flex items-center gap-3">
              <select
                id="module-filter"
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value)}
                className="px-3 py-1.5 border border-border-light rounded text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="">All Modules</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="search-input"
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search checkpoints..."
                  className="w-full pl-9 pr-3 py-1.5 border border-border-light rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-surface-alt text-text-secondary text-sm font-medium rounded hover:bg-surface border border-border-light"
              >
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="ml-2 text-sm text-text-muted">Loading...</span>
              </div>
            ) : checkpoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardCheck className="w-8 h-8 text-border-light mb-2" />
                <p className="text-sm font-medium text-text-muted">No checkpoints found</p>
                <p className="text-xs text-text-muted mt-0.5">Create a checkpoint to get started</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-header-bg border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-white/60 text-xs uppercase tracking-wider">Title</th>
                    <th className="px-4 py-2.5 text-left font-medium text-white/60 text-xs uppercase tracking-wider">Module</th>
                    <th className="px-4 py-2.5 text-center font-medium text-white/60 text-xs uppercase tracking-wider">Score</th>
                    <th className="px-4 py-2.5 text-center font-medium text-white/60 text-xs uppercase tracking-wider">Accuracy</th>
                    <th className="px-4 py-2.5 text-center font-medium text-white/60 text-xs uppercase tracking-wider">Corrective</th>
                    <th className="px-4 py-2.5 text-center font-medium text-white/60 text-xs uppercase tracking-wider">Photo</th>
                    <th className="px-4 py-2.5 text-left font-medium text-white/60 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-center font-medium text-white/60 text-xs uppercase tracking-wider">Order</th>
                    <th className="px-4 py-2.5 text-right font-medium text-white/60 text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {checkpoints.map(cp => (
                    <tr key={cp.id} className="hover:bg-surface-alt">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-text">{cp.title}</div>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{cp.moduleName}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-text">{cp.score}</td>
                      <td className="px-4 py-2.5 text-center"><BoolBadge value={cp.isAccuracyRequired} /></td>
                      <td className="px-4 py-2.5 text-center"><BoolBadge value={cp.isCorrectiveActionRequired} /></td>
                      <td className="px-4 py-2.5 text-center"><BoolBadge value={cp.isPhotoRequired} /></td>
                      <td className="px-4 py-2.5">{statusBadge(cp.status)}</td>
                      <td className="px-4 py-2.5 text-center text-text-muted">{cp.displayOrder}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(cp)}
                            title="Edit"
                            className="p-1 text-text-muted hover:text-primary hover:bg-primary-light rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(cp)}
                            title={cp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            className="p-1 text-text-muted hover:text-danger hover:bg-danger-light rounded"
                          >
                            {cp.status === 'ACTIVE' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm modal-backdrop" onClick={() => setShowModal(false)} />
          <div className="relative bg-surface w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border shadow-2xl overflow-hidden z-10 animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-light bg-surface-alt flex-shrink-0">
              <h2 className="text-base font-bold text-text">
                {editing ? 'Edit Checkpoint' : 'New Checkpoint'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-text-muted hover:text-text hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 bg-surface overflow-y-auto flex-1">
              {error && (
                <div className="bg-danger-light border border-danger text-danger px-3 py-2 rounded text-sm">{error}</div>
              )}
              <div>
                <label htmlFor="form-moduleId" className="block text-sm font-medium text-text mb-1">Module *</label>
                <select
                  id="form-moduleId"
                  required
                  value={form.moduleId}
                  onChange={e => setForm(f => ({ ...f, moduleId: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-border-light rounded text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="">Select Module</option>
                  {modules.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="form-title" className="block text-sm font-medium text-text mb-1">Title *</label>
                <input
                  id="form-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-border-light rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="form-description" className="block text-sm font-medium text-text mb-1">Description</label>
                <textarea
                  id="form-description"
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-border-light rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="form-score" className="block text-sm font-medium text-text mb-1">Score *</label>
                  <input
                    id="form-score"
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={form.score}
                    onChange={e => setForm(f => ({ ...f, score: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-border-light rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="form-displayOrder" className="block text-sm font-medium text-text mb-1">Display Order</label>
                  <input
                    id="form-displayOrder"
                    type="number"
                    min={0}
                    value={form.displayOrder}
                    onChange={e => setForm(f => ({ ...f, displayOrder: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-border-light rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <span className="block text-sm font-medium text-text">Required Fields</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="form-isAccuracyRequired"
                    type="checkbox"
                    checked={form.isAccuracyRequired}
                    onChange={e => setForm(f => ({ ...f, isAccuracyRequired: e.target.checked }))}
                    className="w-4 h-4 rounded border-border-light text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text">Accuracy Required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="form-isCorrectiveActionRequired"
                    type="checkbox"
                    checked={form.isCorrectiveActionRequired}
                    onChange={e => setForm(f => ({ ...f, isCorrectiveActionRequired: e.target.checked }))}
                    className="w-4 h-4 rounded border-border-light text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text">Corrective Action Required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="form-isPhotoRequired"
                    type="checkbox"
                    checked={form.isPhotoRequired}
                    onChange={e => setForm(f => ({ ...f, isPhotoRequired: e.target.checked }))}
                    className="w-4 h-4 rounded border-border-light text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text">Photo Required</span>
                </label>
              </div>
              <div>
                <label htmlFor="form-status" className="block text-sm font-medium text-text mb-1">Status</label>
                <select
                  id="form-status"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-border-light rounded text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-alt rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
