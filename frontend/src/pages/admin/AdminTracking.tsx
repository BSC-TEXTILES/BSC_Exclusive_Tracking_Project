import { useEffect, useState } from 'react'
import { Satellite, MapPin, Battery, RefreshCw, Radio, Plus, Trash2, Key, ShieldCheck, Navigation } from 'lucide-react'
import { get, post, del } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import LiveMap from '../../components/LiveMap'
import type { MapMarker } from '../../components/LiveMap'
import { fmtDateTime, timeAgo } from '../../lib/format'

interface TrackUser {
  userId: string
  fullName: string
  employeeCode: string
  roleName: string
  departmentName: string | null
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  address: string | null
  batteryLevel: number | null
  trackedAt: string | null
  online: boolean
  profileImage: string | null
}

interface Office {
  id: string
  name: string
  code: string
  address: string | null
  latitude: number | null
  longitude: number | null
}

export default function AdminTracking() {
  const [data, setData] = useState<{ users: TrackUser[]; offices: Office[] } | null>(null)
  const [history, setHistory] = useState<{ latitude: number; longitude: number; accuracy: number | null; battery_level: number | null; address: string | null; tracked_at: string }[] | null>(null)
  const [selectedUser, setSelectedUser] = useState<TrackUser | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [locModal, setLocModal] = useState(false)
  const [locName, setLocName] = useState('')
  const [locCode, setLocCode] = useState('')
  const [locAddress, setLocAddress] = useState('')
  const [locLat, setLocLat] = useState('')
  const [locLng, setLocLng] = useState('')
  const [saving, setSaving] = useState(false)
  const [locError, setLocError] = useState('')
  const [admittanceCodes, setAdmittanceCodes] = useState<{ id: string; user_id: string; user_name: string; employee_code: string; location_name: string; admittance_code: string; is_active: boolean }[]>([])
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [codeUserId, setCodeUserId] = useState('')
  const [codeLocationId, setCodeLocationId] = useState('')
  const [savingCode, setSavingCode] = useState(false)
  const [adminLocation, setAdminLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [selectedMapUser, setSelectedMapUser] = useState<MapMarker | null>(null)

  const load = () => {
    setLoading(true)
    setError('')
    get<{ users: TrackUser[]; offices: Office[] }>('/api/tracking/latest')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60000)
    return () => clearInterval(id)
  }, [])

  // Load admittance codes
  useEffect(() => {
    get<{ codes: typeof admittanceCodes }>('/api/admin/admittance-codes')
      .then((d) => setAdmittanceCodes(d.codes))
      .catch(() => {})
  }, [])

  // Get admin's own location for distance calculation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setAdminLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }, [])

  const openHistory = async (u: TrackUser) => {
    setSelectedUser(u)
    setHistory(null)
    try {
      const h = await get<{ items: { latitude: number; longitude: number; accuracy: number | null; battery_level: number | null; address: string | null; tracked_at: string }[] }>(`/api/tracking/history?userId=${u.userId}&limit=120`)
      setHistory(h.items)
    } catch {
      setHistory([])
    }
  }

  const saveOffice = async () => {
    setLocError('')
    if (!locName.trim() || !locCode.trim()) {
      setLocError('Name and code are required')
      return
    }
    setSaving(true)
    try {
      await post('/api/admin/locations', {
        name: locName.trim(),
        code: locCode.trim(),
        address: locAddress.trim() || null,
        latitude: locLat ? parseFloat(locLat) : null,
        longitude: locLng ? parseFloat(locLng) : null,
      })
      setLocModal(false)
      setLocName(''); setLocCode(''); setLocAddress(''); setLocLat(''); setLocLng('')
      await load()
    } catch (e) {
      setLocError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const removeOffice = async (id: string) => {
    try {
      await del(`/api/admin/locations/${id}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const assignAdmittanceCode = async () => {
    if (!codeUserId || !codeLocationId) return
    setSavingCode(true)
    try {
      await post('/api/admin/admittance-codes', { userId: codeUserId, locationId: codeLocationId })
      const d = await get<{ codes: typeof admittanceCodes }>('/api/admin/admittance-codes')
      setAdmittanceCodes(d.codes)
      setShowCodeModal(false)
      setCodeUserId('')
      setCodeLocationId('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingCode(false)
    }
  }

  const deleteAdmittanceCode = async (id: string) => {
    try {
      await del(`/api/admin/admittance-codes/${id}`)
      setAdmittanceCodes((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading && !data) return <Spinner text="Loading live locations..." />
  if (error && !data) return <ErrorState message={error} onRetry={load} />

  const markers: MapMarker[] = [
    ...(data?.offices || [])
      .filter((o) => o.latitude !== null && o.longitude !== null)
      .map((o) => ({
        id: `office-${o.id}`,
        name: o.name,
        latitude: o.latitude as number,
        longitude: o.longitude as number,
        kind: 'office' as const,
        address: o.address,
      })),
    ...(data?.users || [])
      .filter((u) => u.latitude !== null && u.longitude !== null)
      .map((u) => ({
        id: u.userId,
        name: u.fullName,
        latitude: u.latitude as number,
        longitude: u.longitude as number,
        online: u.online,
        role: u.roleName,
        address: u.address,
        profileImage: u.profileImage,
        employeeCode: u.employeeCode,
        departmentName: u.departmentName,
        batteryLevel: u.batteryLevel,
        accuracy: u.accuracy,
      })),
  ]
  const onlineCount = (data?.users || []).filter((u) => u.online).length

  return (
    <div>
      <PageHeader
        title="Live Tracking"
        subtitle={`Real-time location updates via WebSocket · ${onlineCount} online now`}
        actions={
          <>
            <button onClick={() => void load()} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={() => setLocModal(true)} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              <Plus className="w-3.5 h-3.5" /> Office location
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Map */}
        <div className="xl:col-span-2 card p-2 h-[520px]">
          <LiveMap
            markers={markers}
            center={[19.1, 72.89]}
            zoom={9}
            showDistanceFrom={adminLocation}
            onMarkerClick={(m) => setSelectedMapUser(m)}
          />
        </div>

        {/* User list */}
        <div className="card flex flex-col max-h-[520px]">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Satellite className="w-4 h-4 text-primary" /> Team locations
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border-light">
            {(data?.users || []).map((u) => (
              <div key={u.userId} className="px-5 py-3.5 hover:bg-primary-faint transition-colors">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => void openHistory(u)}>
                  {u.profileImage ? (
                    <img src={u.profileImage.startsWith('http') ? u.profileImage : u.profileImage} alt={u.fullName} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${u.online ? 'bg-green-500' : 'bg-gray-400'}`}>
                      {u.fullName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-text truncate">{u.fullName}</p>
                      <span className={`flex items-center gap-1 text-[10px] font-bold shrink-0 ${u.online ? 'text-success' : 'text-text-muted'}`}>
                        <Radio className="w-3 h-3" /> {u.online ? 'ONLINE' : timeAgo(u.trackedAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {u.roleName}{u.departmentName ? ` · ${u.departmentName}` : ''} · {u.employeeCode}
                    </p>
                    {(() => {
                      const ac = admittanceCodes.find((c) => c.user_id === u.userId && c.is_active)
                      if (!ac) return null
                      return (
                        <p className="text-[10px] text-primary-deep mt-1 flex items-center gap-1.5 font-mono font-bold">
                          <Key className="w-3 h-3" /> {ac.admittance_code} — {ac.location_name}
                        </p>
                      )
                    })()}
                    <p className="text-[11px] text-text-secondary mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-primary shrink-0" />
                      {u.latitude ? `${u.latitude.toFixed(5)}, ${u.longitude?.toFixed(5)}` : 'No location reported yet'}
                    </p>
                    {u.batteryLevel !== null && (
                      <p className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                        <Battery className="w-3 h-3" /> {Math.round(u.batteryLevel)}% battery
                      </p>
                    )}
                  </div>
                </div>
                {u.latitude && u.longitude && (
                  <button
                    onClick={() => {
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${u.latitude},${u.longitude}&travelmode=driving`, '_blank')
                    }}
                    className="mt-2 ml-12 inline-flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary-deep bg-primary-faint px-2 py-1 rounded-md transition-colors"
                  >
                    <Navigation className="w-3 h-3" /> Navigate
                  </button>
                )}
              </div>
            ))}
            {(data?.users || []).length === 0 && (
              <p className="px-5 py-8 text-center text-xs text-text-muted">No tracked users yet.</p>
            )}
          </div>

          {/* Offices */}
          <div className="border-t border-border px-5 py-4">
            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Registered offices</h4>
            <div className="space-y-2">
              {(data?.offices || []).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3 h-3 text-primary-deep shrink-0" />
                    <span className="truncate">{o.name} ({o.code})</span>
                  </span>
                  <button onClick={() => void removeOffice(o.id)} className="text-text-muted hover:text-danger transition-colors shrink-0" title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Admittance Codes */}
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wide flex items-center gap-1.5">
                <Key className="w-3 h-3" /> Admittance Codes
              </h4>
              <button onClick={() => setShowCodeModal(true)} className="text-[10px] font-bold text-primary hover:text-primary-dark">
                + Assign
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {admittanceCodes.length === 0 ? (
                <p className="text-[10px] text-text-muted">No codes assigned yet</p>
              ) : (
                admittanceCodes.map((ac) => (
                  <div key={ac.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-text truncate">{ac.user_name}</p>
                      <p className="text-[9px] text-text-muted">{ac.location_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ac.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {ac.admittance_code}
                      </span>
                      <button onClick={() => void deleteAdmittanceCode(ac.id)} className="text-text-muted hover:text-danger">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Track history modal */}
      <Modal open={!!selectedUser} onClose={() => setSelectedUser(null)} title={selectedUser ? `Location history — ${selectedUser.fullName}` : ''} wide>
        {history === null ? (
          <Spinner text="Loading history..." />
        ) : history.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">No location history for this user.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Time</th><th>Coordinates</th><th>Accuracy</th><th>Battery</th><th>Address</th></tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{fmtDateTime(h.tracked_at)}</td>
                    <td className="font-mono text-xs">{h.latitude.toFixed(6)}, {h.longitude.toFixed(6)}</td>
                    <td>{h.accuracy ? `±${Math.round(h.accuracy)} m` : '—'}</td>
                    <td>{h.battery_level !== null ? `${Math.round(h.battery_level)}%` : '—'}</td>
                    <td className="max-w-[260px] truncate">{h.address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Add office modal */}
      <Modal open={locModal} onClose={() => setLocModal(false)} title="Add registered office">
        <div className="space-y-3">
          {locError && <p className="text-xs text-danger font-semibold">{locError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name *</label><input className="input" value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Head Office - Pune" /></div>
            <div><label className="label">Code *</label><input className="input" value={locCode} onChange={(e) => setLocCode(e.target.value)} placeholder="HO-PUN" /></div>
          </div>
          <div><label className="label">Address</label><input className="input" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Latitude</label><input className="input" value={locLat} onChange={(e) => setLocLat(e.target.value)} placeholder="18.5204" /></div>
            <div><label className="label">Longitude</label><input className="input" value={locLng} onChange={(e) => setLocLng(e.target.value)} placeholder="73.8567" /></div>
          </div>
          <button className="btn btn-primary w-full" onClick={() => void saveOffice()} disabled={saving}>
            {saving ? 'Saving...' : 'Add office'}
          </button>
        </div>
      </Modal>

      {/* Assign admittance code modal */}
      <Modal open={showCodeModal} onClose={() => setShowCodeModal(false)} title="Assign Admittance Code">
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">Assign a location and admittance code to a team member. The code will be displayed during live tracking.</p>
          <div>
            <label className="label">Select User *</label>
            <select className="input" value={codeUserId} onChange={(e) => setCodeUserId(e.target.value)}>
              <option value="">Choose user...</option>
              {(data?.users || []).map((u) => (
                <option key={u.userId} value={u.userId}>{u.fullName} ({u.employeeCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Select Location *</label>
            <select className="input" value={codeLocationId} onChange={(e) => setCodeLocationId(e.target.value)}>
              <option value="">Choose location...</option>
              {(data?.offices || []).map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary w-full" onClick={() => void assignAdmittanceCode()} disabled={savingCode || !codeUserId || !codeLocationId}>
            {savingCode ? 'Assigning...' : 'Generate & Assign Code'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
