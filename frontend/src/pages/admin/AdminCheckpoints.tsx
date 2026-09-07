import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ListChecks, Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { get, post, put, del } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'

interface Checkpoint {
  id: string
  title: string
  description: string | null
  score: number
  is_accuracy_required: boolean
  is_corrective_action_required: boolean
  is_photo_required: boolean
  display_order: number
  status: string
  module_name: string
  module_slug: string
  department_name: string
  submission_count: number
}

interface ModuleOpt { id: string; name: string; department_name: string }

const emptyForm = { moduleId: '', title: '', description: '', score: 5, isAccuracyRequired: false, isCorrectiveActionRequired: false, isPhotoRequired: false, displayOrder: 1 }

export default function AdminCheckpoints() {
  const [items, setItems] = useState<Checkpoint[]>([])
  const [modules, setModules] = useState<ModuleOpt[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Checkpoint | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ checkpoints: Checkpoint[] }>(`/api/admin/checkpoints${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then((d) => setItems(d.checkpoints))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    void load()
    get<{ modules: ModuleOpt[] }>('/api/admin/modules').then((d) => setModules(d.modules)).catch(() => undefined)
  }, [search])

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, moduleId: modules[0]?.id || '' }); setFormError(''); setModal(true) }
  const openEdit = (c: Checkpoint) => {
    setEditing(c)
    setForm({ moduleId: '', title: c.title, description: c.description || '', score: c.score, isAccuracyRequired: c.is_accuracy_required, isCorrectiveActionRequired: c.is_corrective_action_required, isPhotoRequired: c.is_photo_required, displayOrder: c.display_order })
    setFormError('')
    setModal(true)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      const payload = {
        title: form.title, description: form.description || null, score: form.score,
        isAccuracyRequired: form.isAccuracyRequired, isCorrectiveActionRequired: form.isCorrectiveActionRequired,
        isPhotoRequired: form.isPhotoRequired, displayOrder: form.displayOrder,
        ...(editing ? {} : { moduleId: form.moduleId }),
      }
      if (editing) await put(`/api/admin/checkpoints/${editing.id}`, payload)
      else await post('/api/admin/checkpoints', payload)
      setModal(false)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c: Checkpoint) => {
    if (!window.confirm(`Delete checkpoint "${c.title}"?`)) return
    try {
      await del(`/api/admin/checkpoints/${c.id}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title="Checkpoints"
        subtitle="Individual compliance tasks inside modules"
        actions={<button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"><Plus className="w-3.5 h-3.5" /> New checkpoint</button>}
      />
      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search checkpoints..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Checkpoint</th><th>Module</th><th>Department</th><th>Score</th><th>Requirements</th><th>Submissions</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-text-muted">No checkpoints found.</td></tr>
              ) : (
                items.slice((page - 1) * pageSize, page * pageSize).map((c) => (
                  <tr key={c.id}>
                    <td className="max-w-[260px]">
                      <p className="font-semibold text-text truncate">{c.title}</p>
                      <p className="text-[11px] text-text-muted line-clamp-1">{c.description || '—'}</p>
                    </td>
                    <td>{c.module_name}</td>
                    <td>{c.department_name}</td>
                    <td>{c.score}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {c.is_accuracy_required && <span className="px-1.5 py-0.5 rounded bg-info-bg text-info text-[9px] font-bold">ACCURACY</span>}
                        {c.is_corrective_action_required && <span className="px-1.5 py-0.5 rounded bg-warning-bg text-warning text-[9px] font-bold">CORRECTIVE</span>}
                        {c.is_photo_required && <span className="px-1.5 py-0.5 rounded bg-primary-light text-primary-deep text-[9px] font-bold">EVIDENCE</span>}
                        {!c.is_accuracy_required && !c.is_corrective_action_required && !c.is_photo_required && <span className="text-text-muted text-[10px]">—</span>}
                      </div>
                    </td>
                    <td>{c.submission_count}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(c)}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          totalPages={Math.max(1, Math.ceil(items.length / pageSize))}
          totalItems={items.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          itemLabel="checkpoints"
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.title}` : 'New checkpoint'}>
        <form onSubmit={submit} className="space-y-3">
          {formError && <p className="text-xs text-danger font-semibold">{formError}</p>}
          {!editing && (
            <div>
              <label className="label">Module *</label>
              <select className="input" value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })} required>
                <option value="">Select...</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.department_name})</option>)}
              </select>
            </div>
          )}
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div><label className="label">Description</label><textarea className="input resize-y" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Score</label><input className="input" type="number" min={1} value={form.score} onChange={(e) => setForm({ ...form, score: parseInt(e.target.value || '5', 10) })} /></div>
            <div><label className="label">Display order</label><input className="input" type="number" min={0} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value || '0', 10) })} /></div>
          </div>
          <div className="space-y-2 pt-1">
            {([
              ['isAccuracyRequired', 'Accuracy rating required'],
              ['isCorrectiveActionRequired', 'Corrective action required'],
              ['isPhotoRequired', 'Evidence upload required'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" className="accent-sky-500 w-4 h-4" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save changes' : 'Create checkpoint'}</button>
        </form>
      </Modal>
    </div>
  )
}
