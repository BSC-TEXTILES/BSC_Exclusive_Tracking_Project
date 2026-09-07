import { useEffect, useState } from 'react'
import { Settings, Save, Loader2, Clock, Satellite, HardDrive } from 'lucide-react'
import { get, put } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'

interface Setting {
  id: string
  key: string
  value: string
  type: string
  category: string
  updated_at: string
}

const CATEGORY_META: Record<string, { icon: typeof Settings; label: string; desc: string }> = {
  general: { icon: Settings, label: 'General', desc: 'Application identity settings' },
  approval: { icon: Clock, label: 'Approval', desc: 'Auto-approval review window' },
  tracking: { icon: Satellite, label: 'Live Tracking', desc: 'Location update frequency' },
  storage: { icon: HardDrive, label: 'Storage', desc: 'File upload limits' },
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = () => {
    setLoading(true)
    setError('')
    get<{ settings: Setting[] }>('/api/admin/settings')
      .then((d) => {
        setSettings(d.settings)
        setValues(Object.fromEntries(d.settings.map((s) => [s.key, s.value])))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [])

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await put('/api/admin/settings', { settings: Object.entries(values).map(([key, value]) => ({ key, value })) })
      setMsg({ ok: true, text: 'Settings saved successfully' })
      await load()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  const grouped = settings.reduce<Record<string, Setting[]>>((acc, s) => {
    const cat = s.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="System Settings"
        subtitle="Runtime configuration for approvals, tracking and storage"
        actions={<button onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save settings</button>}
      />

      {msg && (
        <p className={`text-xs font-semibold mb-3 ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, list]) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META.general
          return (
            <div key={cat} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary-light text-primary-deep flex items-center justify-center">
                  <meta.icon className="w-4.5 h-4.5 w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">{meta.label}</h3>
                  <p className="text-xs text-text-muted">{meta.desc}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {list.map((s) => (
                  <div key={s.key}>
                    <label className="label">
                      {s.key.replace(/_/g, ' ')}
                      {s.type === 'number' && <span className="text-text-muted font-normal"> (number)</span>}
                    </label>
                    <input
                      className="input"
                      value={values[s.key] ?? ''}
                      onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                    />
                    {s.key === 'auto_approve_hours' && (
                      <p className="text-[10px] text-text-muted mt-1">Submissions not reviewed within this many hours are auto-approved by the background job.</p>
                    )}
                    {s.key === 'tracking_interval_minutes' && (
                      <p className="text-[10px] text-text-muted mt-1">How often clients report their GPS location to the server.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
