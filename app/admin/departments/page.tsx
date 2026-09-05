'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  Plus,
  Search,
  Users,
  Layers,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react'

interface DepartmentItem {
  id: string
  name: string
  code: string
  description: string | null
  status: 'ACTIVE' | 'INACTIVE'
  userCount: number
  moduleCount: number
  createdAt: string
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  })
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/departments')
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
        setDepartments(result.data.departments)
      } else {
        setError(result.message || 'Failed to load departments')
      }
    } catch {
      setError('Network error loading departments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDepartments()
  }, [fetchDepartments])

  const openCreateModal = () => {
    setEditingDept(null)
    setFormData({ name: '', code: '', description: '', status: 'ACTIVE' })
    setModalError('')
    setModalOpen(true)
  }

  const openEditModal = (dept: DepartmentItem) => {
    setEditingDept(dept)
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      status: dept.status,
    })
    setModalError('')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalError('')

    try {
      const url = editingDept
        ? `/api/admin/departments/${editingDept.id}`
        : '/api/admin/departments'
      const method = editingDept ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
        fetchDepartments()
      } else {
        setModalError(result.message || 'Failed to save department')
      }
    } catch {
      setModalError('Failed to save department')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/departments/${id}`, { method: 'DELETE' })
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
        setDeleteConfirmId(null)
        fetchDepartments()
      } else {
        alert(result.message || 'Failed to delete department')
      }
    } catch {
      alert('Network error deleting department')
    } finally {
      setDeleting(false)
    }
  }

  const filteredDepartments = departments.filter(d => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6 max-w-7xl mx-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text">Departments</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage organization units and associate modules with departments.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-surface border border-border mb-4">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search departments..."
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
          <p className="text-sm text-text-secondary mt-2">Loading departments...</p>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="bg-surface border border-border p-12 text-center">
          <Building2 className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <h3 className="text-sm font-medium text-text">No departments found</h3>
          <p className="text-xs text-text-secondary mt-1">
            {search ? 'Try adjusting your search criteria' : 'Create your first department to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-header-bg">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Description</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Users</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Modules</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-white/70 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map(dept => (
                <tr key={dept.id} className="border-b border-border-light last:border-0 hover:bg-surface-alt">
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-text font-medium">{dept.name}</span>
                      <span className="ml-2 text-[11px] text-text-muted font-mono">{dept.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-xs truncate">
                    {dept.description || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-text-secondary">
                      <Users className="w-3.5 h-3.5 text-text-muted" />
                      {dept.userCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-text-secondary">
                      <Layers className="w-3.5 h-3.5 text-text-muted" />
                      {dept.moduleCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        dept.status === 'ACTIVE' ? 'text-success' : 'text-text-secondary'
                      }`}
                    >
                      {dept.status === 'ACTIVE' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {dept.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(dept)}
                        className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-light rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(dept.id)}
                        className="p-1.5 text-text-muted hover:text-danger hover:bg-surface-alt rounded"
                        title="Delete"
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
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-surface rounded-xl shadow-2xl border border-border max-w-sm w-full p-6 z-10 animate-scale-in">
            <h3 className="text-base font-bold text-text mb-2">Delete Department</h3>
            <p className="text-sm text-text-secondary mb-5">
              Are you sure? This action cannot be undone. Departments with active users or modules cannot be deleted.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-3.5 py-1.5 text-xs font-semibold text-text-secondary bg-surface border border-border hover:bg-surface-alt rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-danger hover:opacity-90 rounded-lg inline-flex items-center gap-1.5 transition shadow-xs"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border max-w-md w-full p-6 z-10 animate-scale-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light">
              <h3 className="text-base font-bold text-text">
                {editingDept ? 'Edit Department' : 'Create Department'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface-alt transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="bg-surface-alt border border-border-light text-danger text-xs p-2.5 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label htmlFor="dept-name" className="block text-sm font-medium text-text mb-1">
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  id="dept-name"
                  type="text"
                  required
                  placeholder="e.g. Sales, Human Resources"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="dept-code" className="block text-sm font-medium text-text mb-1">
                  Code <span className="text-danger">*</span>
                </label>
                <input
                  id="dept-code"
                  type="text"
                  required
                  placeholder="e.g. SALES, HR"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm font-mono text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="dept-description" className="block text-sm font-medium text-text mb-1">
                  Description
                </label>
                <textarea
                  id="dept-description"
                  rows={3}
                  placeholder="Brief description of responsibilities..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="dept-status" className="block text-sm font-medium text-text mb-1">
                  Status
                </label>
                <select
                  id="dept-status"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  className="w-full px-3 py-1.5 border border-border rounded text-sm text-text bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-alt rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingDept ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}