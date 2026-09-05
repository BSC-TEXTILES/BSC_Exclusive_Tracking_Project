'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Layers,
  X,
  Loader2,
} from 'lucide-react'

interface Module {
  id: string
  name: string
  slug: string
  description: string | null
  department: string
  departmentId: string
  checkpointCount: number
  status: string
  displayOrder: number
}

interface Department {
  id: string
  name: string
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-success/10 text-success border-success/20',
    INACTIVE: 'bg-text-muted/10 text-text-muted border-text-muted/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.INACTIVE}`}>
      {status}
    </span>
  )
}

const emptyForm = {
  departmentId: '',
  name: '',
  slug: '',
  description: '',
  displayOrder: 0,
  status: 'ACTIVE',
}

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])

  const fetchModules = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/modules?${params}`)
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const data = await res.json()
      if (data.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
        if (data.success) setModules(data.data.modules)
    } catch {
      setError('Failed to load modules')
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
      const res = await fetch(`/api/admin/modules?${params}`, { signal: controller.signal })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const data = await res.json()
      if (data.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (!controller.signal.aborted && data.success) setModules(data.data.modules)
      } catch {
        if (!controller.signal.aborted) setError('Failed to load modules')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [search])

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch('/api/admin/departments')
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
          if (data.success) setDepartments(data.data.departments)
        }
      } catch {}
    }
    loadDepartments()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchModules()
  }

  const openCreateModal = () => {
    setEditingModule(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  const openEditModal = (mod: Module) => {
    setEditingModule(mod)
    setForm({
      departmentId: mod.departmentId,
      name: mod.name,
      slug: mod.slug,
      description: mod.description || '',
      displayOrder: mod.displayOrder,
      status: mod.status,
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url = editingModule ? `/api/admin/modules/${editingModule.id}` : '/api/admin/modules'
      const method = editingModule ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
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
        setError(data.message || 'Failed to save module')
        return
      }
      setShowModal(false)
      fetchModules()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (mod: Module) => {
    const newStatus = mod.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const res = await fetch(`/api/admin/modules/${mod.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      if (res.ok) fetchModules()
    } catch {}
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  return (
    <div className="min-h-full bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-text">Modules</h1>
            <p className="text-sm text-text-secondary mt-1">Manage checkpoints and their organization</p>
          </div>
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primary-hover">
            <Plus className="w-4 h-4" />
            Add Module
          </button>
        </div>

        <div className="bg-surface border border-border">
          <div className="p-4 border-b border-border-light">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search modules..."
                  className="w-full pl-10 pr-4 py-2 border border-border rounded text-sm text-text bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-surface-alt text-text-secondary text-sm font-medium rounded hover:bg-surface hover:text-text border border-border-light">
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="ml-2 text-sm text-text-muted">Loading modules...</span>
              </div>
            ) : modules.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Layers className="w-8 h-8 text-text-muted/30 mb-3" />
                <p className="text-text-muted font-medium">No modules found</p>
                <p className="text-sm text-text-muted/60 mt-1">Create your first module to get started</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-header-bg border-b border-border-light">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-white/70">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-white/70 hidden md:table-cell">Department</th>
                    <th className="px-4 py-2 text-center font-medium text-white/70">Checkpoints</th>
                    <th className="px-4 py-2 text-left font-medium text-white/70">Status</th>
                    <th className="px-4 py-2 text-center font-medium text-white/70">Order</th>
                    <th className="px-4 py-2 text-right font-medium text-white/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {modules.map(mod => (
                    <tr key={mod.id} className="hover:bg-surface-alt transition-colors">
                      <td className="px-4 py-2">
                        <div className="font-medium text-text">{mod.name}</div>
                        <div className="text-xs text-text-muted font-mono">{mod.slug}</div>
                      </td>
                      <td className="px-4 py-2 text-text-secondary hidden md:table-cell">{mod.department}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-medium">
                          {mod.checkpointCount}
                        </span>
                      </td>
                      <td className="px-4 py-2">{statusBadge(mod.status)}</td>
                      <td className="px-4 py-2 text-center text-text-muted">{mod.displayOrder}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(mod)} title="Edit" className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleToggleStatus(mod)} title={mod.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors">
                            {mod.status === 'ACTIVE' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
          <div className="relative bg-surface w-full max-w-lg max-h-[90vh] flex flex-col border border-border rounded-xl shadow-2xl overflow-hidden z-10 animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-border-light bg-surface-alt flex-shrink-0">
              <h2 className="text-base font-bold text-text">{editingModule ? 'Edit Module' : 'Create Module'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-text-muted hover:text-text hover:bg-surface-alt rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger px-3 py-2 rounded text-sm">{error}</div>
              )}
              <div>
                <label htmlFor="departmentId" className="block text-sm font-medium text-text-secondary mb-1">Department *</label>
                <select
                  id="departmentId"
                  required
                  value={form.departmentId}
                  onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded text-sm text-text bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">Module Name *</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value
                    setForm(f => ({ ...f, name, slug: editingModule ? f.slug : generateSlug(name) }))
                  }}
                  className="w-full px-3 py-2 border border-border rounded text-sm text-text bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-text-secondary mb-1">Slug *</label>
                <input
                  id="slug"
                  type="text"
                  required
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  pattern="^[a-z0-9-]+$"
                  className="w-full px-3 py-2 border border-border rounded text-sm text-text bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
                <p className="text-xs text-text-muted mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1">Description</label>
                <textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded text-sm text-text bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="displayOrder" className="block text-sm font-medium text-text-secondary mb-1">Display Order</label>
                  <input
                    id="displayOrder"
                    type="number"
                    min={0}
                    value={form.displayOrder}
                    onChange={e => setForm(f => ({ ...f, displayOrder: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-border rounded text-sm text-text bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-text-secondary mb-1">Status</label>
                  <select
                    id="status"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded text-sm text-text bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-light">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-alt rounded transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingModule ? 'Update Module' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
