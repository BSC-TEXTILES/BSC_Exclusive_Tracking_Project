import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Briefcase, Plus, Trash2, Loader2, Layers, FolderOpen } from 'lucide-react'
import { get, post, del } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'

interface Project {
  project_id: string | null
  module_id: string
  name: string
  slug: string
  description: string | null
  department_name: string
  responsibility: string | null
  assigned_date: string | null
  checkpoint_count: number
  submission_count: number
}

interface ModuleOpt { id: string; name: string; department_name: string }

export default function SupervisorProjects() {
  const [items, setItems] = useState<Project[]>([])
  const [modules, setModules] = useState<ModuleOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [moduleId, setModuleId] = useState('')
  const [responsibility, setResponsibility] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ projects: Project[] }>('/api/supervisor/projects')
      .then((d) => setItems(d.projects))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    void load()
    get<{ modules: ModuleOpt[] }>('/api/admin/modules')
      .then((d) => setModules(d.modules))
      .catch(() => undefined)
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      await post('/api/supervisor/projects', { moduleId, responsibility: responsibility || null })
      setModal(false)
      setModuleId(''); setResponsibility('')
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: Project) => {
    if (!p.project_id) return
    if (!window.confirm(`Remove project "${p.name}"?`)) return
    try {
      await del(`/api/supervisor/projects/${p.project_id}`)
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
        title="My Projects"
        subtitle="Modules you own end-to-end"
        actions={<button onClick={() => { setFormError(''); setModal(true) }} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"><Plus className="w-3.5 h-3.5" /> Add project</button>}
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((p) => (
          <div key={p.module_id} className="card p-5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-primary-light text-primary-deep flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              {p.project_id && (
                <button className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(p)}><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <h3 className="text-sm font-bold text-text mt-3">{p.name}</h3>
            <p className="text-[11px] text-text-muted font-mono mt-0.5">/{p.slug} · {p.department_name}</p>
            <p className="text-xs text-text-secondary mt-1.5 line-clamp-2 min-h-[2rem]">{p.responsibility || p.description || '—'}</p>
            <div className="flex items-center gap-3 mt-3 text-[11px] text-text-secondary">
              <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-primary" /> {p.checkpoint_count} checkpoints</span>
              <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3 text-primary" /> {p.submission_count} submissions</span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="card p-10 text-center text-sm text-text-muted col-span-full">No projects assigned yet.</div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add project">
        <form onSubmit={submit} className="space-y-3">
          {formError && <p className="text-xs text-danger font-semibold">{formError}</p>}
          <div>
            <label className="label">Module *</label>
            <select className="input" value={moduleId} onChange={(e) => setModuleId(e.target.value)} required>
              <option value="">Select module...</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.department_name})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Responsibility (optional)</label>
            <textarea className="input resize-y" value={responsibility} onChange={(e) => setResponsibility(e.target.value)} placeholder="What do you own in this project?" />
          </div>
          <button className="btn btn-primary w-full" disabled={busy || !moduleId}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />} Add project
          </button>
        </form>
      </Modal>
    </div>
  )
}
