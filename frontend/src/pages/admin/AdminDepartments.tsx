import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, Plus, Pencil, Trash2, Users, FolderOpen, Loader2 } from 'lucide-react'
import { get, post, put, del } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'

interface Department {
  id: string
  name: string
  code: string
  description: string | null
  status: string
  user_count: number
  module_count: number
}

export default function AdminDepartments() {
  const [items, setItems] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ departments: Department[] }>('/api/admin/departments')
      .then((d) => setItems(d.departments))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [])

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', description: '' }); setFormError(''); setModal(true) }
  const openEdit = (d: Department) => { setEditing(d); setForm({ name: d.name, code: d.code, description: d.description || '' }); setFormError(''); setModal(true) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      if (editing) await put(`/api/admin/departments/${editing.id}`, form)
      else await post('/api/admin/departments', form)
      setModal(false)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (d: Department) => {
    if (!window.confirm(`Delete department "${d.name}"?`)) return
    try {
      await del(`/api/admin/departments/${d.id}`)
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
        title="Departments"
        subtitle="Organizational units for modules and users"
        actions={<button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"><Plus className="w-3.5 h-3.5" /> New department</button>}
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((d) => (
          <div key={d.id} className="card p-5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-primary-light text-primary-deep flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}><Pencil className="w-3.5 h-3.5" /></button>
                <button className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(d)}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <h3 className="text-sm font-bold text-text mt-3">{d.name}</h3>
            <p className="text-[11px] text-text-muted font-mono mt-0.5">{d.code}</p>
            <p className="text-xs text-text-secondary mt-1.5 line-clamp-2 min-h-[2rem]">{d.description || '—'}</p>
            <div className="flex items-center gap-3 mt-3 text-[11px] text-text-secondary">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {d.user_count} users</span>
              <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" /> {d.module_count} modules</span>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'New department'}>
        <form onSubmit={submit} className="space-y-3">
          {formError && <p className="text-xs text-danger font-semibold">{formError}</p>}
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Code *</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
          <div><label className="label">Description</label><textarea className="input resize-y" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save changes' : 'Create department'}</button>
        </form>
      </Modal>
    </div>
  )
}
