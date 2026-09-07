import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { UserRound, Save, Loader2, BadgeCheck } from 'lucide-react'
import { get, put } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'

interface SupervisorProfile {
  id: string
  designation: string | null
  joining_date: string | null
  bio: string | null
  specialization: string | null
  reporting_manager_id: string | null
  full_name: string
  email: string
  phone: string | null
  employee_code: string
  department_name: string | null
  manager_name: string | null
}

export default function SupervisorProfile() {
  const [profile, setProfile] = useState<SupervisorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ designation: '', joiningDate: '', bio: '', specialization: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ profile: SupervisorProfile | null }>('/api/supervisor/profile')
      .then((d) => {
        setProfile(d.profile)
        if (d.profile) {
          setForm({
            designation: d.profile.designation || '',
            joiningDate: d.profile.joining_date || '',
            bio: d.profile.bio || '',
            specialization: d.profile.specialization || '',
          })
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      await put('/api/supervisor/profile', {
        designation: form.designation || null,
        joiningDate: form.joiningDate || null,
        bio: form.bio || null,
        specialization: form.specialization || null,
      })
      setMsg('Profile saved successfully')
      await load()
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  const initials = (profile?.full_name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div>
      <PageHeader title="Supervisor Profile" subtitle="Your professional details" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 text-white text-2xl font-extrabold flex items-center justify-center shadow-lg">
            {initials}
          </div>
          <h2 className="text-base font-bold text-text mt-3">{profile?.full_name}</h2>
          <p className="text-xs text-text-muted">{profile?.employee_code}</p>
          {profile?.designation && (
            <p className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-light text-primary-deep text-xs font-bold">
              <BadgeCheck className="w-3.5 h-3.5" /> {profile.designation}
            </p>
          )}
          <div className="mt-5 text-left space-y-2.5 text-xs">
            <div className="flex justify-between"><span className="text-text-muted">Email</span><b className="text-text">{profile?.email}</b></div>
            <div className="flex justify-between"><span className="text-text-muted">Department</span><b className="text-text">{profile?.department_name || '—'}</b></div>
            <div className="flex justify-between"><span className="text-text-muted">Reports to</span><b className="text-text">{profile?.manager_name || '—'}</b></div>
            {profile?.joining_date && <div className="flex justify-between"><span className="text-text-muted">Joined</span><b className="text-text">{new Date(profile.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</b></div>}
          </div>
        </div>

        <form onSubmit={submit} className="lg:col-span-2 card p-5 space-y-4 h-fit">
          <h3 className="text-sm font-bold text-text flex items-center gap-2"><UserRound className="w-4 h-4 text-primary" /> Professional details</h3>
          {msg && <p className={`text-xs font-semibold ${msg.startsWith('Profile') ? 'text-success' : 'text-danger'}`}>{msg}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Senior Supervisor" /></div>
            <div><label className="label">Joining date</label><input className="input" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
          </div>
          <div><label className="label">Specialization</label><input className="input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Field Operations & Compliance" /></div>
          <div><label className="label">Bio</label><textarea className="input min-h-[100px] resize-y" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save profile
          </button>
        </form>
      </div>
    </div>
  )
}
