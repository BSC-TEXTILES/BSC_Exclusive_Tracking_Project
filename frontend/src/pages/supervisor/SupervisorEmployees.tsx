import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Users, Plus, UserMinus, Loader2, MapPin } from 'lucide-react'
import { get, post, del } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import { timeAgo } from '../../lib/format'

interface Employee {
  id: string
  employee_id: string
  full_name: string
  employee_code: string
  email: string
  phone: string | null
  status: string
  department_name: string
  assigned_date: string
  total: number
  approved: number
  rejected: number
  pending: number
  last_tracked_at: string | null
}

interface Available {
  id: string
  full_name: string
  employee_code: string
  department_name: string | null
  role_name: string
}

export default function SupervisorEmployees() {
  const [items, setItems] = useState<Employee[]>([])
  const [available, setAvailable] = useState<Available[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ employees: Employee[]; available: Available[] }>(`/api/supervisor/employees${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then((d) => {
        setItems(d.employees)
        setAvailable(d.available)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    void load()
    get<{ departments: { id: string; name: string; assigned: boolean }[] }>('/api/supervisor/departments')
      .then((d) => setDepts(d.departments.filter((x) => x.assigned)))
      .catch(() => undefined)
  }, [search])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      await post('/api/supervisor/employees', { employeeId, departmentId: departmentId || depts[0]?.id, reason: reason || null })
      setModal(false)
      setEmployeeId(''); setReason('')
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const unassign = async (emp: Employee) => {
    if (!window.confirm(`Remove ${emp.full_name} from your team?`)) return
    try {
      await del(`/api/supervisor/employees/${emp.employee_id}`)
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
        title="My Team"
        subtitle="Employees you supervise"
        actions={<button onClick={() => { setFormError(''); setModal(true) }} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"><Plus className="w-3.5 h-3.5" /> Add member</button>}
      />

      <div className="card p-4 mb-4">
        <input className="input max-w-sm" placeholder="Search team..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Department</th><th>Submissions</th><th>Approved</th><th>Rejected</th><th>Pending</th><th>Last Location</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td>
                  <p className="font-semibold text-text">{e.full_name}</p>
                  <p className="text-[11px] text-text-muted">{e.employee_code} · {e.email}</p>
                </td>
                <td>{e.department_name}</td>
                <td>{e.total}</td>
                <td className="text-success font-bold">{e.approved}</td>
                <td className="text-danger font-bold">{e.rejected}</td>
                <td className="text-warning font-bold">{e.pending}</td>
                <td className="text-xs text-text-secondary whitespace-nowrap">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary" /> {e.last_tracked_at ? timeAgo(e.last_tracked_at) : 'never'}</span>
                </td>
                <td>
                  <div className="flex justify-end">
                    <button className="btn btn-ghost btn-sm text-danger" title="Remove from team" onClick={() => void unassign(e)}><UserMinus className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-text-muted">No team members yet. Add your first member.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add team member">
        <form onSubmit={submit} className="space-y-3">
          {formError && <p className="text-xs text-danger font-semibold">{formError}</p>}
          <div>
            <label className="label">Employee *</label>
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">Select employee...</option>
              {available.map((a) => <option key={a.id} value={a.id}>{a.full_name} ({a.employee_code})</option>)}
            </select>
            {available.length === 0 && <p className="text-[11px] text-text-muted mt-1">All eligible users are already on a team.</p>}
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Select...</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div><label className="label">Reason (optional)</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you adding this member?" /></div>
          <button className="btn btn-primary w-full" disabled={busy || !employeeId}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} Add to team
          </button>
        </form>
      </Modal>
    </div>
  )
}
