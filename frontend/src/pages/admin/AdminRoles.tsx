import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ShieldCheck,
  Loader2,
  Save,
  Users,
  Plus,
  Search,
  CheckCircle2,
  UserCheck,
  User,
  Trash2,
  KeyRound,
  FileText,
  Building,
} from 'lucide-react'
import { get, post, put, del } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { fmtDateTime } from '../../lib/format'

interface RoleUser {
  id: string
  full_name: string
  username: string
  employee_code: string
  email: string
  phone: string | null
  status: string
  department_name: string | null
  last_login_at: string | null
  created_at: string
}

interface Role {
  id: string
  name: string
  description: string | null
  created_at: string
  user_count: number
  permission_count: number
  permission_ids: string[] | null
  users?: RoleUser[]
}

interface Permission {
  id: string
  name: string
  description: string | null
  category: string
}

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([])
  const [grouped, setGrouped] = useState<Record<string, Permission[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Permissions Modal
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [roleDescription, setRoleDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // View Assigned Users Modal
  const [viewingUsersRole, setViewingUsersRole] = useState<Role | null>(null)

  // Create Role Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [newRolePerms, setNewRolePerms] = useState<Set<string>>(new Set())
  const [createError, setCreateError] = useState('')
  const [createBusy, setCreateBusy] = useState(false)

  // User Directory Search & Pagination
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([
      get<{ roles: Role[] }>('/api/admin/roles'),
      get<{ grouped: Record<string, Permission[]> }>('/api/admin/roles/permissions'),
    ])
      .then(([r, p]) => {
        setRoles(r.roles)
        setGrouped(p.grouped)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void load()
  }, [])

  const openRole = (role: Role) => {
    setSelectedRole(role)
    setRoleDescription(role.description || '')
    setMsg('')
    setChecked(new Set(role.permission_ids || []))
  }

  const togglePermission = (id: string) => {
    const next = new Set(checked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChecked(next)
  }

  const toggleNewRolePermission = (id: string) => {
    const next = new Set(newRolePerms)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setNewRolePerms(next)
  }

  const savePermissions = async () => {
    if (!selectedRole) return
    setBusy(true)
    setMsg('')
    try {
      await put(`/api/admin/roles/${selectedRole.id}`, {
        permissionIds: Array.from(checked),
        description: roleDescription,
      })
      setMsg('Role & permissions saved successfully')
      await load()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) {
      setCreateError('Role name is required')
      return
    }
    setCreateBusy(true)
    setCreateError('')
    try {
      await post('/api/admin/roles', {
        name: newRoleName.trim(),
        description: newRoleDesc.trim() || null,
        permissionIds: Array.from(newRolePerms),
      })
      setCreateModalOpen(false)
      setNewRoleName('')
      setNewRoleDesc('')
      setNewRolePerms(new Set())
      await load()
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setCreateBusy(false)
    }
  }

  const handleDeleteRole = async (role: Role) => {
    if (!window.confirm(`Delete custom role "${role.name}"? This cannot be undone.`)) return
    try {
      await del(`/api/admin/roles/${role.id}`)
      await load()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  // Flatten all users across all roles for Directory
  const allUsersWithRoles = useMemo(() => {
    const list: Array<RoleUser & { role_name: string; role_id: string }> = []
    for (const r of roles) {
      if (r.users && r.users.length > 0) {
        for (const u of r.users) {
          list.push({ ...u, role_name: r.name, role_id: r.id })
        }
      }
    }
    return list
  }, [roles])

  // Filter Directory users
  const filteredUsers = useMemo(() => {
    return allUsersWithRoles.filter((u) => {
      const matchesRole = !roleFilter || u.role_name === roleFilter
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.employee_code.toLowerCase().includes(q) ||
        (u.department_name && u.department_name.toLowerCase().includes(q))
      return matchesRole && matchesSearch
    })
  }, [allUsersWithRoles, search, roleFilter])

  const totalAssignedUsers = useMemo(() => {
    return roles.reduce((sum, r) => sum + (r.user_count || 0), 0)
  }, [roles])

  const allPermissions = useMemo(() => {
    return Object.values(grouped).flat()
  }, [grouped])

  if (loading) return <Spinner text="Loading roles and users..." />
  if (error) return <ErrorState message={error} onRetry={load} />

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Roles & Assigned Users"
        subtitle="Manage all created roles, customize access permissions, and view all assigned user names"
        actions={
          <button
            onClick={() => {
              setNewRoleName('')
              setNewRoleDesc('')
              setNewRolePerms(new Set())
              setCreateError('')
              setCreateModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Create New Role
          </button>
        }
      />

      {/* Top Stat Cards: Role & User Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/15 text-brand-primary flex items-center justify-center font-bold text-lg shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Total Roles Created
            </p>
            <p className="text-2xl font-extrabold text-text-primary mt-0.5">{roles.length}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-lg shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Assigned Users
            </p>
            <p className="text-2xl font-extrabold text-text-primary mt-0.5">{totalAssignedUsers}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center font-bold text-lg shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              System Permissions
            </p>
            <p className="text-2xl font-extrabold text-text-primary mt-0.5">{allPermissions.length}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-lg shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Active Directory
            </p>
            <p className="text-2xl font-extrabold text-text-primary mt-0.5">{filteredUsers.length}</p>
          </div>
        </div>
      </div>

      {/* Role Cards with Assigned User Names */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            All Roles ({roles.length}) & Assigned Users
          </h2>
          <span className="text-xs text-text-muted">Click any role to configure permissions or view assigned users</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((r) => {
            const isSystemDefault = ['ADMIN', 'SUPERVISOR', 'FIELD_EXECUTIVE', 'MANAGER', 'CLIENT'].includes(
              r.name
            )
            const roleUsers = r.users || []

            return (
              <div
                key={r.id}
                className="card p-5 hover:border-brand-primary/60 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-brand-primary/15 text-brand-primary flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                          {r.name}
                          {isSystemDefault && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-surface-elevated border border-border-default text-text-muted">
                              Default
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] text-text-muted font-medium">
                          {r.permission_count} permissions
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setViewingUsersRole(r)}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 transition-colors"
                    >
                      {r.user_count} user{r.user_count === 1 ? '' : 's'}
                    </button>
                  </div>

                  <p className="text-xs text-text-secondary mt-3 min-h-[2rem] line-clamp-2">
                    {r.description || 'No description provided.'}
                  </p>

                  {/* Assigned User Names Preview */}
                  <div className="mt-3.5 pt-3 border-t border-border-default">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                      Assigned Users ({roleUsers.length})
                    </p>
                    {roleUsers.length === 0 ? (
                      <p className="text-xs text-text-muted italic">No users assigned to this role.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {roleUsers.slice(0, 3).map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface-base border border-border-default/70"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                {u.full_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-text-primary truncate">
                                {u.full_name}
                              </span>
                              <span className="text-[10px] text-text-muted truncate">@{u.username}</span>
                            </div>
                            <span className="font-mono text-[10px] text-text-muted shrink-0 ml-1">
                              {u.employee_code}
                            </span>
                          </div>
                        ))}

                        {roleUsers.length > 3 && (
                          <button
                            onClick={() => setViewingUsersRole(r)}
                            className="w-full text-center text-xs font-semibold text-brand-primary hover:underline pt-1"
                          >
                            + {roleUsers.length - 3} more assigned user names...
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default gap-2">
                  <button
                    className="btn btn-outline btn-sm text-xs flex-1"
                    onClick={() => void openRole(r)}
                  >
                    {r.name === 'ADMIN' ? 'View Permissions' : 'Edit Permissions'}
                  </button>

                  <button
                    className="btn btn-ghost btn-sm text-xs text-brand-primary"
                    onClick={() => setViewingUsersRole(r)}
                    title="View user list"
                  >
                    <Users className="w-3.5 h-3.5" />
                  </button>

                  {!isSystemDefault && r.user_count === 0 && (
                    <button
                      className="btn btn-ghost btn-sm text-xs text-danger"
                      onClick={() => void handleDeleteRole(r)}
                      title="Delete role"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Directory of All Roles & Each User Name */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            All Roles & Assigned Users Directory
          </h2>
          <span className="text-xs text-text-muted">
            Displaying all {filteredUsers.length} user names and their assigned roles
          </span>
        </div>

        {/* Filters */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9 text-xs"
              placeholder="Search user name, username, email, employee code or department..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <select
            className="input w-44 text-xs"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Roles ({roles.length})</option>
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name} ({r.user_count})
              </option>
            ))}
          </select>
        </div>

        {/* Paginated Table of Users & Roles */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>User Full Name</th>
                  <th>Username</th>
                  <th>Employee Code</th>
                  <th>Assigned Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-text-muted">
                      No users match the selected role or search filter.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => (
                    <tr key={`${u.role_id}-${u.id}`}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-text-primary text-xs">{u.full_name}</p>
                            <p className="text-[11px] text-text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-text-secondary">@{u.username}</td>
                      <td className="font-mono text-xs text-text-primary font-semibold">
                        {u.employee_code}
                      </td>
                      <td>
                        <span className="px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-bold">
                          {u.role_name}
                        </span>
                      </td>
                      <td className="text-xs text-text-secondary">{u.department_name || '—'}</td>
                      <td>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-success-bg text-success'
                              : 'bg-danger-bg text-danger'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="text-xs text-text-muted">{fmtDateTime(u.last_login_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz)
              setPage(1)
            }}
            itemLabel="users"
          />
        </div>
      </div>

      {/* Modal: View Assigned Users for Role */}
      <Modal
        open={!!viewingUsersRole}
        onClose={() => setViewingUsersRole(null)}
        title={`Users Assigned to Role: ${viewingUsersRole?.name || ''}`}
        wide
      >
        {viewingUsersRole && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-base rounded-xl border border-border-default flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-text-primary text-sm">{viewingUsersRole.name}</p>
                <p className="text-text-muted">{viewingUsersRole.description || 'No description'}</p>
              </div>
              <div className="text-right font-bold text-brand-primary text-sm">
                {viewingUsersRole.user_count} Total Assigned User(s)
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {!viewingUsersRole.users || viewingUsersRole.users.length === 0 ? (
                <p className="text-center py-8 text-text-muted text-xs">No users assigned to this role yet.</p>
              ) : (
                viewingUsersRole.users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated border border-border-default hover:border-brand-primary/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-text-primary">{u.full_name}</p>
                        <p className="text-[11px] text-text-muted">
                          @{u.username} · {u.email} · {u.phone || 'No phone'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-text-primary">{u.employee_code}</p>
                      <p className="text-[10px] text-text-muted">
                        {u.department_name || 'No Dept'} ·{' '}
                        <span
                          className={u.status === 'ACTIVE' ? 'text-emerald-500 font-bold' : 'text-danger font-bold'}
                        >
                          {u.status}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Create New Role */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Role"
        wide
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          {createError && <p className="text-xs text-danger font-semibold">{createError}</p>}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Role Name *</label>
              <input
                className="input uppercase"
                placeholder="e.g. QUALITY_ANALYST, AUDITOR"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
              />
              <p className="text-[10px] text-text-muted mt-1">
                Will be formatted in uppercase with underscores.
              </p>
            </div>

            <div>
              <label className="label">Description</label>
              <input
                className="input"
                placeholder="Brief description of this role's purpose..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Select Permissions</label>
              <button
                type="button"
                className="text-xs text-brand-primary font-semibold hover:underline"
                onClick={() => setNewRolePerms(new Set(allPermissions.map((p) => p.id)))}
              >
                Select All
              </button>
            </div>

            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1 border border-border-default rounded-xl p-3 bg-surface-base">
              {Object.entries(grouped).map(([category, perms]) => (
                <div key={category}>
                  <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
                    {category}
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {perms.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-start gap-2 px-2 py-1.5 rounded-lg border border-border-default hover:border-brand-primary cursor-pointer transition-colors bg-surface-elevated text-xs"
                      >
                        <input
                          type="checkbox"
                          className="accent-sky-500 mt-0.5"
                          checked={newRolePerms.has(p.id)}
                          onChange={() => toggleNewRolePermission(p.id)}
                        />
                        <span className="truncate">
                          <span className="block font-semibold text-text-primary">{p.name}</span>
                          {p.description && (
                            <span className="block text-[10px] text-text-muted truncate">
                              {p.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-default">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={createBusy}>
              {createBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Role
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Permissions */}
      <Modal
        open={!!selectedRole}
        onClose={() => setSelectedRole(null)}
        title={`Configure Permissions — ${selectedRole?.name || ''}`}
        wide
      >
        {selectedRole && (
          <div className="space-y-4">
            {msg && (
              <p
                className={`text-xs font-semibold p-2.5 rounded-lg ${
                  msg.includes('successfully')
                    ? 'bg-success-bg text-success'
                    : 'bg-danger-bg text-danger'
                }`}
              >
                {msg}
              </p>
            )}

            <div>
              <label className="label">Role Description</label>
              <input
                className="input text-xs"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Description of role responsibilities..."
              />
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {Object.entries(grouped).map(([category, perms]) => (
                <div key={category}>
                  <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">
                    {category}
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {perms.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-border-default hover:border-brand-primary cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="accent-sky-500 mt-0.5"
                          checked={checked.has(p.id)}
                          onChange={() => togglePermission(p.id)}
                          disabled={selectedRole.name === 'ADMIN'}
                        />
                        <span>
                          <span className="block text-xs font-semibold text-text-primary">
                            {p.name}
                          </span>
                          {p.description && (
                            <span className="block text-[10px] text-text-muted">
                              {p.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setChecked(new Set(allPermissions.map((p) => p.id)))}
                disabled={selectedRole.name === 'ADMIN'}
              >
                Select all
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void savePermissions()}
                disabled={busy || selectedRole.name === 'ADMIN'}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save role changes
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
