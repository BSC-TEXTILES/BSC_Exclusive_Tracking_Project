import { useEffect, useState, useMemo } from 'react'
import type { FormEvent } from 'react'
import {
  Search, Plus, Pencil, Trash2, Copy, Layers, BarChart3, Eye,
  ChevronDown, ChevronUp, Loader2, ToggleLeft, ToggleRight,
  Download, Filter, X, CheckSquare, Square, ArrowUpDown,
} from 'lucide-react'
import { get, post, put, del } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import { fmtDateTime } from '../../lib/format'

interface ModuleItem {
  id: string
  name: string
  slug: string
  description: string | null
  display_order: number
  status: string
  department_id: string
  department_name: string | null
  checkpoint_count: number
  submission_count: number
  created_at: string
  completion_rate?: number
  avg_score?: number
  assigned_users?: number
}

interface Dept { id: string; name: string }

const emptyForm = {
  departmentId: '', name: '', slug: '', description: '', displayOrder: 0, status: 'ACTIVE',
}

export default function AdminModules() {
  const [items, setItems] = useState<ModuleItem[]>([])
  const [depts, setDepts] = useState<Dept[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'checkpoints' | 'submissions' | 'order'>('order')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | 'preview' | 'stats' | null>(null)
  const [editing, setEditing] = useState<ModuleItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [checkpoints, setCheckpoints] = useState<any[]>([])
  const [previewModule, setPreviewModule] = useState<ModuleItem | null>(null)
  const [statsModule, setStatsModule] = useState<ModuleItem | null>(null)

  const load = () => {
    setLoading(true)
    setError('')
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    get<{ modules: ModuleItem[] }>(`/api/admin/modules?${q.toString()}`)
      .then((d) => setItems(d.modules))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void load()
    get<{ departments: Dept[] }>('/api/admin/departments').then((d) => setDepts(d.departments)).catch(() => undefined)
  }, [search])

  const filtered = useMemo(() => {
    let list = [...items]
    if (statusFilter) list = list.filter((m) => m.status === statusFilter)
    if (deptFilter) list = list.filter((m) => m.department_id === deptFilter)
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir
      if (sortBy === 'checkpoints') return ((a.checkpoint_count || 0) - (b.checkpoint_count || 0)) * dir
      if (sortBy === 'submissions') return ((a.submission_count || 0) - (b.submission_count || 0)) * dir
      return ((a.display_order || 0) - (b.display_order || 0)) * dir
    })
    return list
  }, [items, statusFilter, deptFilter, sortBy, sortDir])

  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id))
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map((m) => m.id)))
  }
  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(''); setModal('create') }
  const openEdit = (m: ModuleItem) => {
    setEditing(m)
    setForm({ departmentId: m.department_id, name: m.name, slug: m.slug, description: m.description || '', displayOrder: m.display_order, status: m.status })
    setFormError('')
    setModal('edit')
  }

  const openPreview = async (m: ModuleItem) => {
    setPreviewModule(m)
    try {
      const d = await get<{ checkpoints: any[] }>(`/api/modules/${m.slug}`)
      setCheckpoints(d.checkpoints || [])
    } catch { setCheckpoints([]) }
    setModal('preview')
  }

  const openStats = (m: ModuleItem) => { setStatsModule(m); setModal('stats') }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      const payload = { ...form, departmentId: form.departmentId || null, description: form.description || null }
      if (editing) {
        await put(`/api/admin/modules/${editing.id}`, payload)
      } else {
        await post('/api/admin/modules', payload)
      }
      setModal(null)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m: ModuleItem) => {
    if (!window.confirm(`Delete module "${m.name}"? This will also remove all checkpoints.`)) return
    try {
      await del(`/api/admin/modules/${m.id}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  const cloneModule = async (m: ModuleItem) => {
    if (!window.confirm(`Clone module "${m.name}" with all its checkpoints?`)) return
    setBusy(true)
    try {
      await post(`/api/admin/modules/${m.id}/clone`)
      await load()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  const toggleStatus = async (m: ModuleItem) => {
    try {
      await put(`/api/admin/modules/${m.id}`, { status: m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  const bulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selected.size === 0) return
    const msg = action === 'delete'
      ? `Delete ${selected.size} modules? This cannot be undone.`
      : `${action === 'activate' ? 'Activate' : 'Deactivate'} ${selected.size} modules?`
    if (!window.confirm(msg)) return
    setBulkBusy(true)
    try {
      if (action === 'delete') {
        await Promise.all(Array.from(selected).map((id) => del(`/api/admin/modules/${id}`)))
      } else {
        await Promise.all(Array.from(selected).map((id) =>
          put(`/api/admin/modules/${id}`, { status: action === 'activate' ? 'ACTIVE' : 'INACTIVE' })
        ))
      }
      setSelected(new Set())
      await load()
    } catch (e) { setError((e as Error).message) }
    finally { setBulkBusy(false) }
  }

  const exportModules = () => {
    const data = filtered.map((m) => ({
      name: m.name, slug: m.slug, department: m.department_name, description: m.description,
      checkpoints: m.checkpoint_count, submissions: m.submission_count, status: m.status, order: m.display_order,
    }))
    const csv = [Object.keys(data[0] || {}).join(','), ...data.map((r) => Object.values(r).map((v) => `"${v ?? ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'modules.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const SortHeader = ({ field, label }: { field: typeof sortBy; label: string }) => (
    <th className="cursor-pointer select-none hover:text-sky-600 transition-colors" onClick={() => { setSortBy(field); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }}>
      <span className="flex items-center gap-1">
        {label}
        {sortBy === field ? <ArrowUpDown className="w-3 h-3" /> : null}
      </span>
    </th>
  )

  return (
    <div>
      <PageHeader
        title="Module Management"
        subtitle="Create and manage compliance modules with checkpoints"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={exportModules} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              <Plus className="w-3.5 h-3.5" /> New module
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="input pl-9" placeholder="Search modules..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select className="input pl-9 w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All status</option>
              <option>ACTIVE</option><option>INACTIVE</option>
            </select>
          </div>
          <select className="input w-40" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-sky-600 font-semibold">{selected.size} selected</span>
              <button onClick={() => bulkAction('activate')} disabled={bulkBusy} className="btn btn-sm bg-emerald-500 text-white hover:bg-emerald-600">
                <ToggleRight className="w-3.5 h-3.5" /> Activate
              </button>
              <button onClick={() => bulkAction('deactivate')} disabled={bulkBusy} className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600">
                <ToggleLeft className="w-3.5 h-3.5" /> Deactivate
              </button>
              <button onClick={() => bulkAction('delete')} disabled={bulkBusy} className="btn btn-sm bg-red-500 text-white hover:bg-red-600">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-danger mb-3 font-semibold">{error}</p>}

      {/* Stats Summary */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Modules', value: items.length, color: 'text-sky-600' },
            { label: 'Active', value: items.filter((m) => m.status === 'ACTIVE').length, color: 'text-emerald-600' },
            { label: 'Total Checkpoints', value: items.reduce((s, m) => s + (m.checkpoint_count || 0), 0), color: 'text-blue-600' },
            { label: 'Total Submissions', value: items.reduce((s, m) => s + (m.submission_count || 0), 0), color: 'text-violet-600' },
          ].map((s) => (
            <div key={s.label} className="card px-4 py-3 flex items-center gap-3">
              <BarChart3 className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-sky-600">
                    {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <SortHeader field="name" label="Module" />
                <th>Department</th>
                <SortHeader field="checkpoints" label="Checkpoints" />
                <SortHeader field="submissions" label="Submissions" />
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-text-muted">No modules found.</td></tr>
              ) : (
                filtered.map((m) => (
                  <>
                    <tr key={m.id} className={selected.has(m.id) ? 'bg-sky-50' : ''}>
                      <td>
                        <button onClick={() => toggleSelect(m.id)} className="text-slate-400 hover:text-sky-600">
                          {selected.has(m.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-text">{m.name}</p>
                            <p className="text-[11px] text-text-muted font-mono">/{m.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs">{m.department_name || <span className="text-slate-400">—</span>}</td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                          <Layers className="w-3 h-3" /> {m.checkpoint_count || 0}
                        </span>
                      </td>
                      <td className="text-xs font-semibold">{m.submission_count || 0}</td>
                      <td>
                        <button onClick={() => void toggleStatus(m)} className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer hover:opacity-80 transition-opacity ${m.status === 'ACTIVE' ? 'bg-success-bg text-success' : 'bg-slate-100 text-slate-500'}`}>
                          {m.status}
                        </button>
                      </td>
                      <td className="text-xs text-text-secondary">{fmtDateTime(m.created_at)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn btn-ghost btn-sm" title="Preview" onClick={() => void openPreview(m)}><Eye className="w-3.5 h-3.5" /></button>
                          <button className="btn btn-ghost btn-sm" title="Clone" onClick={() => void cloneModule(m)}><Copy className="w-3.5 h-3.5" /></button>
                          <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(m)}><Pencil className="w-3.5 h-3.5" /></button>
                          <button className="btn btn-ghost btn-sm text-danger" title="Delete" onClick={() => void remove(m)}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)} title={editing ? `Edit: ${editing.name}` : 'Create module'}>
        <form onSubmit={submit} className="space-y-3">
          {formError && <p className="text-xs text-danger font-semibold">{formError}</p>}
          <div>
            <label className="label">Department *</label>
            <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
              <option value="">Select department...</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => {
              const name = e.target.value
              setForm({ ...form, name, slug: form.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })
            }} required />
          </div>
          <div>
            <label className="label">Slug</label>
            <input className="input font-mono text-xs" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Display Order</label>
              <input className="input" type="number" min={0} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>ACTIVE</option><option>INACTIVE</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save changes' : 'Create module'}
          </button>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal open={modal === 'preview'} onClose={() => setModal(null)} title={`Preview: ${previewModule?.name || ''}`}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{previewModule?.description || 'No description'}</p>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Department: <strong>{previewModule?.department_name || '—'}</strong></span>
            <span>·</span>
            <span>{previewModule?.checkpoint_count || 0} checkpoints</span>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Checkpoints</h4>
            {checkpoints.length === 0 ? (
              <p className="text-xs text-slate-400">No checkpoints yet</p>
            ) : (
              <div className="space-y-2">
                {checkpoints.map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{c.title}</p>
                      <p className="text-[10px] text-slate-500">{c.score || 0} pts {c.isPhotoRequired ? '· Photo required' : ''}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.status || 'ACTIVE'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Stats Modal */}
      <Modal open={modal === 'stats'} onClose={() => setModal(null)} title={`Stats: ${statsModule?.name || ''}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Checkpoints', value: statsModule?.checkpoint_count || 0, color: 'text-sky-600' },
              { label: 'Submissions', value: statsModule?.submission_count || 0, color: 'text-blue-600' },
              { label: 'Status', value: statsModule?.status, color: statsModule?.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-500' },
              { label: 'Order', value: statsModule?.display_order || 0, color: 'text-violet-600' },
            ].map((s) => (
              <div key={s.label} className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</p>
                <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Created</p>
            <p className="text-sm font-semibold text-slate-700">{fmtDateTime(statsModule?.created_at)}</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
