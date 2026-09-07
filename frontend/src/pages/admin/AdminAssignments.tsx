import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckSquare, Plus, Trash2, Loader2, Search } from 'lucide-react'
import { get, post, del } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import { todayStr } from '../../lib/format'

interface Assignment {
  id: string
  assigned_date: string
  due_date: string | null
  frequency: string
  status: string
  user_name: string
  employee_code: string
  checkpoint_title: string
  module_name: string
  submission_status: string | null
}

interface CheckpointOpt { id: string; title: string; module_name: string }
interface UserOpt { id: string; full_name: string; employee_code: string; role_name: string }

export default function AdminAssignments() {
  const [items, setItems] = useState<Assignment[]>([])
  const [checkpoints, setCheckpoints] = useState<CheckpointOpt[]>([])
  const [users, setUsers] = useState<UserOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ checkpointId: '', userId: '', assignedDate: todayStr(), dueDate: '', frequency: 'DAILY' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ assignments: Assignment[] }>(`/api/admin/assignments${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then((d) => setItems(d.assignments))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    void load()
    get<{ checkpoints: CheckpointOpt[] }>('/api/admin/checkpoints').then((d) => setCheckpoints(d.checkpoints)).catch(() => undefined)
    get<{ users: UserOpt[] }>('/api/admin/users').then((d) => setUsers(d.users.filter((u) => u.role_name === 'USER' || u.role_name === 'VIEWER'))).catch(() => undefined)
  }, [search])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      await post('/api/admin/assignments', {
        checkpointId: form.checkpointId, userId: form.userId, assignedDate: form.assignedDate,
        dueDate: form.dueDate || null, frequency: form.frequency,
      })
      setModal(false)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a: Assignment) => {
    if (!window.confirm('Remove this assignment?')) return
    try {
      await del(`/api/admin/assignments/${a.id}`)
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
        title="Assignments"
        subtitle="Assign checkpoints to users with due dates"
        actions={<button onClick={() => { setForm({ checkpointId: '', userId: '', assignedDate: todayStr(), dueDate: '', frequency: 'DAILY' }); setFormError(''); setModal(true) }} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"><Plus className="w-3.5 h-3.5" /> New assignment</button>}
      />
      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Filter by user or checkpoint..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>User</th><th>Checkpoint</th><th>Module</th><th>Due</th><th>Frequency</th><th>Submission</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap">{new Date(a.assigned_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                <td>
                  <p className="font-semibold text-text">{a.user_name}</p>
                  <p className="text-[11px] text-text-muted font-mono">{a.employee_code}</p>
                </td>
                <td className="max-w-[200px] truncate">{a.checkpoint_title}</td>
                <td>{a.module_name}</td>
                <td className="whitespace-nowrap">{a.due_date ? new Date(a.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                <td>{a.frequency}</td>
                <td>{a.submission_status ? <StatusBadge status={a.submission_status} /> : <span className="text-text-muted text-xs">Not started</span>}</td>
                <td>
                  <div className="flex justify-end">
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(a)}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New assignment">
        <form onSubmit={submit} className="space-y-3">
          {formError && <p className="text-xs text-danger font-semibold">{formError}</p>}
          <div>
            <label className="label">User *</label>
            <select className="input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Select user...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.employee_code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Checkpoint *</label>
            <select className="input" value={form.checkpointId} onChange={(e) => setForm({ ...form, checkpointId: e.target.value })} required>
              <option value="">Select checkpoint...</option>
              {checkpoints.map((c) => <option key={c.id} value={c.id}>{c.module_name} — {c.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Assigned date *</label><input className="input" type="date" value={form.assignedDate} onChange={(e) => setForm({ ...form, assignedDate: e.target.value })} required /></div>
            <div><label className="label">Due date</label><input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">Frequency</label>
            <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              <option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option><option>ONE_TIME</option>
            </select>
          </div>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />} Assign</button>
        </form>
      </Modal>
    </div>
  )
}
