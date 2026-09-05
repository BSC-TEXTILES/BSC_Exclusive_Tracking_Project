'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  Pencil,
  ShieldOff,
  ShieldCheck,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Users as UsersIcon,
} from 'lucide-react'

interface User {
  id: string
  employeeCode: string
  fullName: string
  email: string
  phone: string | null
  username: string
  role: string
  roleId: string
  department: string | null
  departmentId: string | null
  status: string
  lastLoginAt: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Role {
  id: string
  name: string
}

interface Department {
  id: string
  name: string
}

const emptyForm = {
  fullName: '',
  employeeCode: '',
  email: '',
  phone: '',
  departmentId: '',
  roleId: '',
  username: '',
  password: '',
  status: 'ACTIVE',
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  const fetchUsers = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/users?${params}`)
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
        setUsers(data.data.users)
        setPagination(data.data.pagination)
      }
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const rolesRes = await fetch('/api/admin/roles')
        if (rolesRes.status === 401) {
          window.location.replace('/login')
          return
        }
        const rolesData = await rolesRes.json()
        if (rolesData.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (rolesData.success) setRoles(rolesData.data.roles)
      } catch {}
    }
    loadMeta()
  }, [])

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
    fetchUsers(1)
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setForm({
      fullName: user.fullName,
      employeeCode: user.employeeCode,
      email: user.email,
      phone: user.phone || '',
      departmentId: user.departmentId || '',
      roleId: user.roleId,
      username: user.username,
      password: '',
      status: user.status,
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users'
      const method = editingUser ? 'PATCH' : 'POST'
      const body = { ...form }
      if (editingUser && !body.password) delete (body as Record<string, unknown>).password
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        setError(data.message || 'Failed to save user')
        return
      }
      setShowModal(false)
      fetchUsers(pagination.page)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      if (res.ok) fetchUsers(pagination.page)
    } catch {}
  }

  const handleResetPassword = async (user: User) => {
    const confirmed = window.confirm(`Reset password for ${user.fullName}? They will need to set a new password on next login.`)
    if (!confirmed) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mustChangePassword: true }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      if (res.ok) alert('Password reset flag set. User will be prompted to change password on next login.')
    } catch {
      alert('Failed to reset password')
    }
  }

  return (
    <div className="min-h-full bg-surface-alt">
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-text">User Management</h1>
              <p className="text-xs text-text-muted mt-0.5">Manage employee accounts, roles, and system permissions</p>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-surface text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-border bg-surface-alt/50">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  id="search-users"
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email, or employee code..."
                  className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-surface text-text placeholder:text-text-muted"
                />
              </div>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-surface text-text"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-surface text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                <span className="ml-2 text-xs text-text-muted">Loading users...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <UsersIcon className="w-10 h-10 text-border mb-2" />
                <p className="text-sm text-text-secondary font-semibold">No users found</p>
                <p className="text-xs text-text-muted mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-alt text-text-secondary">
                    <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Email</th>
                    <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Employee Code</th>
                    <th className="px-4 py-2.5 text-left font-semibold hidden lg:table-cell">Department</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Role</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-alt">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-surface-alt/70 transition">
                      <td className="px-4 py-2.5 font-bold text-text">{user.fullName}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{user.email}</td>
                      <td className="px-4 py-2.5 text-text-muted font-mono hidden md:table-cell">{user.employeeCode}</td>
                      <td className="px-4 py-2.5 text-text-muted hidden lg:table-cell">{user.department || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-light text-primary border border-primary/20">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ${
                          user.status === 'ACTIVE'
                            ? 'bg-success/10 text-success border border-success/20'
                            : user.status === 'SUSPENDED'
                              ? 'bg-danger/10 text-danger border border-danger/20'
                              : 'bg-surface-alt text-text-muted border border-border-light'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            title="Edit user"
                            className="p-1.5 text-text-muted hover:text-text hover:bg-surface-alt rounded transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            title={user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            className="p-1.5 text-text-muted hover:text-text hover:bg-surface-alt rounded transition"
                          >
                            {user.status === 'ACTIVE' ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleResetPassword(user)}
                            title="Reset password"
                            className="p-1.5 text-text-muted hover:text-text hover:bg-surface-alt rounded transition"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-alt/50">
              <p className="text-xs text-text-muted">
                Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fetchUsers(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-surface border border-border rounded-lg hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <span className="px-3 py-1.5 text-xs font-semibold text-text-secondary border border-border bg-surface rounded-lg shadow-2xs">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchUsers(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-surface border border-border rounded-lg hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Create / Edit Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Dark blurred backdrop to separate foreground dialog from background table */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity modal-backdrop"
            onClick={() => setShowModal(false)}
          />

          {/* Opaque, solid white modal container with strong shadow and z-index */}
          <div className="relative bg-surface w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border shadow-2xl overflow-hidden z-10 transition-all animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-alt bg-surface-alt/80 flex-shrink-0">
              <h2 className="text-base font-bold text-text">
                {editingUser ? 'Edit User' : 'Create User'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-alt transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 bg-surface overflow-y-auto flex-1">
              {error && (
                <div className="bg-danger-bg border border-danger-border text-danger px-3 py-2 rounded-lg text-xs font-medium">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="form-fullName" className="block text-xs font-semibold text-text-secondary mb-1">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  id="form-fullName"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div>
                <label htmlFor="form-employeeCode" className="block text-xs font-semibold text-text-secondary mb-1">
                  Employee Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-employeeCode"
                  type="text"
                  required
                  value={form.employeeCode}
                  onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                  placeholder="e.g. EMP001"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-email" className="block text-xs font-semibold text-text-secondary mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="form-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                    placeholder="user@bscexclusive.com"
                  />
                </div>
                <div>
                  <label htmlFor="form-phone" className="block text-xs font-semibold text-text-secondary mb-1">
                    Phone
                  </label>
                  <input
                    id="form-phone"
                    type="text"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-departmentId" className="block text-xs font-semibold text-text-secondary mb-1">
                    Department
                  </label>
                  <select
                    id="form-departmentId"
                    value={form.departmentId}
                    onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                  >
                    <option value="">None</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="form-roleId" className="block text-xs font-semibold text-text-secondary mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="form-roleId"
                    required
                    value={form.roleId}
                    onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                  >
                    <option value="">Select role</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-username" className="block text-xs font-semibold text-text-secondary mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="form-username"
                    type="text"
                    required
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                    placeholder="e.g. rahul"
                  />
                </div>
                <div>
                  <label htmlFor="form-password" className="block text-xs font-semibold text-text-secondary mb-1">
                    {editingUser ? 'New Password (blank to keep)' : 'Password *'}
                  </label>
                  <input
                    id="form-password"
                    type="password"
                    required={!editingUser}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="form-status" className="block text-xs font-semibold text-text-secondary mb-1">
                  Status
                </label>
                <select
                  id="form-status"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-alt">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-secondary bg-surface border border-border rounded-lg hover:bg-surface-alt transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-surface text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUser ? 'Update User' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
