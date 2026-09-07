import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Search, Plus, Pencil, Trash2, KeyRound, UserCheck, UserX, Loader2,
  Eye, EyeOff, ShieldAlert, ShieldCheck, Sparkles, CheckCircle2, AlertTriangle, X,
  Smartphone, Monitor, Globe,
} from 'lucide-react'
import { get, post, put, del } from '../../lib/api'
import { Spinner, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { fmtDateTime } from '../../lib/format'

interface AdminUser {
  id: string
  employee_code: string
  full_name: string
  email: string
  phone: string | null
  username: string
  status: string
  account_type?: string
  customer_code?: string
  banned_until?: string | null
  restriction_reason?: string | null
  restricted_at?: string | null
  role_name: string
  department_name: string | null
  last_login_at: string | null
  last_login_ip?: string | null
  last_login_device?: string | null
  last_login_device_type?: string | null
  created_at: string
}

interface Option { id: string; name: string }
interface RoleOption extends Option { }

const emptyForm = {
  employeeCode: '', fullName: '', email: '', phone: '', username: '', password: '',
  roleId: '', departmentId: '', reportingManagerId: '', accountType: 'BSC_USER', customerCode: '',
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [departments, setDepartments] = useState<Option[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [modal, setModal] = useState<'create' | 'edit' | 'password' | 'restrict' | null>(null)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Password reset state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(true)

  // Restriction state
  const [restrictTimeframe, setRestrictTimeframe] = useState<'24_HOURS' | '48_HOURS' | '7_DAYS' | '30_DAYS' | 'PERMANENT'>('24_HOURS')
  const [restrictReason, setRestrictReason] = useState('')

  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    if (roleFilter) q.set('role', roleFilter)
    if (statusFilter) q.set('status', statusFilter)
    get<{ users: AdminUser[] }>(`/api/admin/users?${q.toString()}`)
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setPage(1)
    void load()
    get<{ roles: RoleOption[] }>('/api/admin/roles').then((d) => setRoles(d.roles)).catch(() => undefined)
    get<{ departments: Option[] }>('/api/admin/departments').then((d) => setDepartments(d.departments)).catch(() => undefined)
  }, [search, roleFilter, statusFilter])

  const generateRandomPassword = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
    const numbers = '23456789'
    const symbols = '!@#$%^&*'
    let pwd = ''
    for (let i = 0; i < 6; i++) pwd += letters.charAt(Math.floor(Math.random() * letters.length))
    for (let i = 0; i < 3; i++) pwd += numbers.charAt(Math.floor(Math.random() * numbers.length))
    for (let i = 0; i < 2; i++) pwd += symbols.charAt(Math.floor(Math.random() * symbols.length))
    return pwd.split('').sort(() => 0.5 - Math.random()).join('')
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setShowPassword(false)
    setModal('create')
  }

  const openEdit = (u: AdminUser) => {
    setEditing(u)
    setForm({
      employeeCode: u.employee_code, fullName: u.full_name, email: u.email, phone: u.phone || '',
      username: u.username, password: '', roleId: '', departmentId: '', reportingManagerId: '',
      accountType: u.account_type || 'BSC_USER', customerCode: u.customer_code || '',
    })
    setFormError('')
    setModal('edit')
  }

  const openPassword = (u: AdminUser) => {
    setEditing(u)
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setMustChangePassword(true)
    setFormError('')
    setModal('password')
  }

  const openRestrict = (u: AdminUser) => {
    setEditing(u)
    setRestrictTimeframe('24_HOURS')
    setRestrictReason('')
    setFormError('')
    setModal('restrict')
  }

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      setFormError('Please enter a valid email address')
      setBusy(false)
      return
    }

    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      setFormError('Phone number must be exactly 10 digits')
      setBusy(false)
      return
    }

    // Password validation: minimum 8 characters with at least 1 letter and 1 number (special chars allowed)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
    if (!passwordRegex.test(form.password)) {
      setFormError('Password must be at least 8 characters and contain both letters and numbers')
      setBusy(false)
      return
    }

    try {
      await post('/api/admin/users', {
        employeeCode: form.employeeCode,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || null,
        username: form.username,
        password: form.password,
        roleId: form.roleId,
        departmentId: form.departmentId || null,
        accountType: form.accountType,
        customerCode: form.customerCode || null,
      })
      setModal(null)
      setSuccessBanner(`User account for "${form.fullName}" created successfully!`)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setFormError('')
    try {
      await put(`/api/admin/users/${editing.id}`, {
        fullName: form.fullName, email: form.email, phone: form.phone || null,
        roleId: form.roleId || undefined, departmentId: form.departmentId || null,
      })
      setModal(null)
      setSuccessBanner(`User "${editing.full_name}" updated successfully!`)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setFormError('')

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please verify both fields.')
      setBusy(false)
      return
    }

    // Password validation: min 8 characters, at least 1 letter and 1 number (special chars permitted)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
    if (!passwordRegex.test(newPassword)) {
      setFormError('Password must be at least 8 characters and contain both letters and numbers')
      setBusy(false)
      return
    }

    try {
      const res = await post<{ updated: boolean; message?: string }>(`/api/admin/users/${editing.id}/reset-password`, {
        newPassword,
        mustChangePassword,
      })
      setModal(null)
      setSuccessBanner(res.message || `Password for "${editing.full_name}" was successfully updated and existing sessions were revoked.`)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitRestrict = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setFormError('')

    try {
      const res = await post<{ success: boolean; message: string }>(`/api/admin/users/${editing.id}/restrict`, {
        timeframe: restrictTimeframe,
        reason: restrictReason || undefined,
      })
      setModal(null)
      setSuccessBanner(res.message || `Account for "${editing.full_name}" has been restricted.`)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const unlockUser = async (u: AdminUser) => {
    if (!window.confirm(`Restore active access for "${u.full_name}" and lift all restrictions?`)) return
    try {
      const res = await post<{ success: boolean; message: string }>(`/api/admin/users/${u.id}/unlock`, {})
      setSuccessBanner(res.message || `User "${u.full_name}" has been unlocked successfully.`)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const toggleStatus = async (u: AdminUser) => {
    try {
      await put(`/api/admin/users/${u.id}`, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
      setSuccessBanner(`User "${u.full_name}" status changed to ${u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}.`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const removeUser = async (u: AdminUser) => {
    if (!window.confirm(`Delete user "${u.full_name}"? This action cannot be undone.`)) return
    try {
      await del(`/api/admin/users/${u.id}`)
      setSuccessBanner(`User "${u.full_name}" deleted.`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage credentials, account permissions, and access restrictions"
        actions={
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-brand-navy hover:bg-brand-navy/90 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors">
            <Plus className="w-3.5 h-3.5" /> New user
          </button>
        }
      />

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-800 text-xs font-medium animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-rose-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search name, email, username or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-40" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option>
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type & Code</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Account Status</th>
                  <th>Last Login & Device IP</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-text-muted">No users found matching filters.</td></tr>
                ) : (
                  users.slice((page - 1) * pageSize, page * pageSize).map((u) => {
                    const isRestricted = u.status === 'SUSPENDED' || (u.banned_until && new Date(u.banned_until) > new Date())
                    const isCustomer = u.account_type === 'CUSTOMER'

                    return (
                      <tr key={u.id} className={isRestricted ? 'bg-amber-50/30' : ''}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isCustomer ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                              {u.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-text">{u.full_name}</p>
                              <p className="text-[11px] text-text-muted">{u.email} {u.phone ? `• ${u.phone}` : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${isCustomer ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700'}`}>
                            {isCustomer ? 'Customer' : 'BSC User'}
                          </span>
                          <p className="font-mono text-xs text-text-secondary mt-0.5">{u.customer_code || u.employee_code}</p>
                        </td>
                        <td><span className="px-2 py-0.5 rounded-full bg-primary-light text-primary-deep text-[10px] font-bold">{u.role_name}</span></td>
                        <td>{u.department_name || '—'}</td>
                        <td>
                          {isRestricted ? (
                            <div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" /> Restricted
                              </span>
                              {u.banned_until && (
                                <p className="text-[10px] text-amber-700 mt-0.5 max-w-[150px] truncate" title={`Until ${fmtDateTime(u.banned_until)}: ${u.restriction_reason || 'Administrative restriction'}`}>
                                  Until {fmtDateTime(u.banned_until)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'ACTIVE' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
                              {u.status}
                            </span>
                          )}
                        </td>
                        <td>
                          <div>
                            <p className="text-xs text-text font-medium">{fmtDateTime(u.last_login_at)}</p>
                            {u.last_login_ip ? (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  u.last_login_device_type === 'Mobile'
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                }`}>
                                  {u.last_login_device_type === 'Mobile' ? (
                                    <Smartphone className="w-2.5 h-2.5" />
                                  ) : (
                                    <Monitor className="w-2.5 h-2.5" />
                                  )}
                                  <span className="font-mono">{u.last_login_ip}</span>
                                </span>
                                {u.last_login_device && (
                                  <span className="text-[10px] text-text-muted truncate max-w-[130px]" title={u.last_login_device}>
                                    {u.last_login_device}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-text-muted">No device recorded</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button className="btn btn-ghost btn-sm" title="Edit details" onClick={() => openEdit(u)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button className="btn btn-ghost btn-sm text-primary" title="Reset password" onClick={() => openPassword(u)}>
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            {isRestricted ? (
                              <button className="btn btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50" title="Unlock / Lift restriction" onClick={() => void unlockUser(u)}>
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button className="btn btn-ghost btn-sm text-amber-600 hover:bg-amber-50" title="Restrict account access" onClick={() => openRestrict(u)}>
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} onClick={() => void toggleStatus(u)}>
                              {u.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                            <button className="btn btn-ghost btn-sm text-danger" title="Delete account" onClick={() => void removeUser(u)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(users.length / pageSize))}
            totalItems={users.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            itemLabel="users"
          />
        </div>
      )}

      {/* Create User Modal */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Create New User / Customer">
        <form onSubmit={submitCreate} className="space-y-3">
          {formError && <p className="text-xs text-danger font-semibold bg-rose-50 p-2 rounded">{formError}</p>}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Account Type *</label>
              <select className="input" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                <option value="BSC_USER">BSC Team User</option>
                <option value="CUSTOMER">Customer Account</option>
              </select>
            </div>
            <div>
              <label className="label">{form.accountType === 'CUSTOMER' ? 'Customer / Ref Code *' : 'Employee code *'}</label>
              <input className="input font-mono" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value, customerCode: e.target.value })} required placeholder={form.accountType === 'CUSTOMER' ? 'CUST-1001' : 'BSC-001'} />
            </div>

            <div><label className="label">Full name *</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required placeholder="e.g. John Doe" /></div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="user@example.com" />
            </div>

            <div>
              <label className="label">Phone (10 digits)</label>
              <input className="input font-mono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="9876543210" maxLength={10} />
            </div>
            <div><label className="label">Username *</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="login_username" /></div>

            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Initial Password *</label>
                <button
                  type="button"
                  onClick={() => {
                    const pass = generateRandomPassword()
                    setForm({ ...form, password: pass })
                    setShowPassword(true)
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"
                >
                  <Sparkles className="w-3 h-3" /> Generate strong password
                </button>
              </div>
              <div className="relative">
                <input
                  className="input pr-10 font-mono"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="Min 8 chars, letters + numbers (symbols permitted)"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Must contain both letters and numbers, minimum 8 characters (symbols allowed)</p>
            </div>

            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} required>
                <option value="">Select role...</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">None / Unassigned</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary w-full mt-4" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User Account'}</button>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={`Edit ${editing?.full_name || 'user'}`}>
        <form onSubmit={submitEdit} className="space-y-3">
          {formError && <p className="text-xs text-danger font-semibold bg-rose-50 p-2 rounded">{formError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Full name</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                <option value="">Keep current</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Department</label>
              <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">None</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}</button>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={modal === 'password'} onClose={() => setModal(null)} title={`Reset Password — ${editing?.full_name || ''}`}>
        <form onSubmit={submitPassword} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">New Password *</label>
              <button
                type="button"
                onClick={() => {
                  const pass = generateRandomPassword()
                  setNewPassword(pass)
                  setConfirmPassword(pass)
                  setShowPassword(true)
                  setShowConfirmPassword(true)
                }}
                className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"
              >
                <Sparkles className="w-3 h-3" /> Generate strong password
              </button>
            </div>
            <div className="relative">
              <input
                className="input pr-10 font-mono"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min 8 chars, letters + numbers"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Must contain both letters and numbers, minimum 8 characters (symbols allowed)</p>
          </div>

          <div>
            <label className="label">Confirm New Password *</label>
            <div className="relative">
              <input
                className="input pr-10 font-mono"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Re-enter new password"
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[10px] text-rose-500 font-semibold mt-1">Passwords do not match</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mustChangePassword}
              onChange={(e) => setMustChangePassword(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>Require user to change password at next login</span>
          </label>

          <p className="text-[11px] text-text-muted bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong>Security Notice:</strong> Submitting will immediately hash and update the password. All active user sessions will be invalidated for security compliance.
          </p>

          <button className="btn btn-primary w-full" disabled={busy || !newPassword || !confirmPassword}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Reset Password'}
          </button>
        </form>
      </Modal>

      {/* Restrict User Account Modal */}
      <Modal open={modal === 'restrict'} onClose={() => setModal(null)} title={`Restrict Account — ${editing?.full_name || ''}`}>
        <form onSubmit={submitRestrict} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="label">Restriction Timeframe *</label>
            <select
              className="input font-semibold"
              value={restrictTimeframe}
              onChange={(e) => setRestrictTimeframe(e.target.value as any)}
            >
              <option value="24_HOURS">24 Hours (1 Day)</option>
              <option value="48_HOURS">48 Hours (2 Days)</option>
              <option value="7_DAYS">7 Days (1 Week)</option>
              <option value="30_DAYS">30 Days (1 Month)</option>
              <option value="PERMANENT">Permanent Suspension</option>
            </select>
            <p className="text-[10px] text-text-muted mt-1">
              {restrictTimeframe === 'PERMANENT'
                ? 'User account will remain locked until manually unlocked by an administrator.'
                : 'Account will automatically reopen and restore active status after this duration expires.'}
            </p>
          </div>

          <div>
            <label className="label">Restriction Reason</label>
            <textarea
              className="input min-h-[80px]"
              value={restrictReason}
              onChange={(e) => setRestrictReason(e.target.value)}
              placeholder="e.g. Policy compliance review, repeated rate limit trigger, supervisor inquiry..."
            />
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" /> Immediate Effect
            </p>
            <p className="text-[11px] leading-relaxed">
              Applying this restriction will instantly terminate all active sessions for <strong>{editing?.full_name}</strong> and prevent login until the restriction expires or is lifted.
            </p>
          </div>

          <button className="btn bg-amber-600 hover:bg-amber-700 text-white w-full font-semibold" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Account Restriction'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
