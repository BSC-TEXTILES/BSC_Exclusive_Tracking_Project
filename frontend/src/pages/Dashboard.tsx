import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Satellite,
  ArrowRight,
  AlertTriangle,
  MapPin,
  Loader2,
  Crosshair,
  Check,
  Search,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { get } from '../lib/api'
import { Spinner, ErrorState, PageHeader } from '../components/States'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import { fmtDateTime } from '../lib/format'
import { useTracking } from '../lib/tracking'
import { timeAgo } from '../lib/format'
import { useChartTheme } from '../lib/chartTheme'
import GlobalSearchModal from '../components/GlobalSearchModal'

interface DashboardData {
  kpis: {
    assignedToday: number
    submittedToday: number
    approvedTotal: number
    rejectedTotal: number
    pendingReview: number
    completionRate: number
  }
  weekly: { day: string; submissions: number; approved: number }[]
  recentActivity: { id: string; checkpointTitle: string; moduleName: string; status: string; updatedAt: string }[]
  todayTasks: {
    assignmentId: string
    checkpointId: string
    checkpointTitle: string
    moduleName: string
    moduleSlug: string
    dueDate: string | null
    status: string
    submissionId: string | null
    evidenceCount: number
  }[]
}

const STATUS_PIE: Record<string, string> = {
  APPROVED: '#16a34a',
  SUBMITTED: '#0284c7',
  REJECTED: '#dc2626',
  DRAFT: '#d97706',
  PENDING: '#94a3b8',
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const tracking = useTracking()
  const chart = useChartTheme()
  const [locating, setLocating] = useState(false)
  const [located, setLocated] = useState(false)
  const [admittanceCode, setAdmittanceCode] = useState<{ admittance_code: string; location_name: string; location_address: string | null } | null>(null)

  useEffect(() => {
    get<{ code: typeof admittanceCode }>('/api/tracking/my-admittance-code')
      .then((d) => setAdmittanceCode(d.code))
      .catch(() => {})
  }, [])

  const handleGetLocation = useCallback(() => {
    setLocating(true)
    setLocated(false)
    tracking.syncNow().then(() => {
      setLocating(false)
      setLocated(true)
      setTimeout(() => setLocated(false), 3000)
    }).catch(() => {
      setLocating(false)
    })
  }, [tracking])

  const load = () => {
    setLoading(true)
    setError('')
    get<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <Spinner text="Loading dashboard..." />
  if (error || !data) return <ErrorState message={error || 'Failed to load dashboard'} onRetry={load} />

  const weekly = data.weekly.map((w) => ({ ...w, label: new Date(w.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }))

  return (
    <div>
      <PageHeader
        title="My Dashboard"
        subtitle="Today's checkpoints, compliance summary and live activity"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            >
              <Search className="w-3.5 h-3.5" /> Search
            </button>
            <button
              onClick={handleGetLocation}
              disabled={locating || tracking.syncing}
              className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              {locating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : located ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Crosshair className="w-3.5 h-3.5" />
              )}
              {locating ? 'Getting Location...' : located ? 'Location Captured!' : 'Get Location'}
            </button>
            {tracking.error ? (
              <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-100 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {tracking.error}
              </span>
            ) : tracking.lastSync ? (
              <span className="inline-flex items-center gap-1.5 bg-white/15 text-white px-3 py-1.5 rounded-full text-[11px] font-semibold">
                <Satellite className="w-3.5 h-3.5" />
                Location synced {timeAgo(tracking.lastSync.toISOString())}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-white/15 text-white px-3 py-1.5 rounded-full text-[11px] font-semibold">
                <Satellite className="w-3.5 h-3.5 animate-pulse" />
                Waiting for GPS fix...
              </span>
            )}
            <button
              onClick={() => tracking.syncNow()}
              disabled={tracking.syncing}
              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              {tracking.syncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MapPin className="w-3.5 h-3.5" />
              )}
              Sync Now
            </button>
          </div>
        }
      />

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      {/* Admittance Code */}
      {admittanceCode && (
        <div className="mb-6 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-sky-600 text-white flex items-center justify-center text-lg font-black tracking-wider shrink-0">
            {admittanceCode.admittance_code}
          </div>
          <div>
            <p className="text-xs font-bold text-sky-900">Your Admittance Code</p>
            <p className="text-[11px] text-sky-700 mt-0.5">Present this code at: {admittanceCode.location_name}</p>
            {admittanceCode.location_address && (
              <p className="text-[10px] text-sky-500 mt-0.5">{admittanceCode.location_address}</p>
            )}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Assigned Today" value={data.kpis.assignedToday} icon={ClipboardList} />
        <StatCard label="Submitted Today" value={data.kpis.submittedToday} icon={Send} tone="info" />
        <StatCard label="Pending Review" value={data.kpis.pendingReview} icon={Clock} tone="warning" />
        <StatCard label="Approved" value={data.kpis.approvedTotal} icon={CheckCircle2} tone="success" />
        <StatCard label="Rejected" value={data.kpis.rejectedTotal} icon={XCircle} tone="danger" />
        <StatCard label="Completion Rate" value={`${Math.min(data.kpis.completionRate, 100)}%`} icon={TrendingUp} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Today's tasks */}
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-text flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> Today&apos;s Checkpoints
            </h2>
            <Link to="/modules" className="text-xs text-primary hover:text-primary-dark font-semibold">View all modules →</Link>
          </div>
          <div className="divide-y divide-border-light">
            {data.todayTasks.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <AlertTriangle className="w-6 h-6 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">No checkpoints assigned for today.</p>
              </div>
            ) : (
              data.todayTasks.map((t) => (
                <div key={t.assignmentId} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-primary-faint transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{t.checkpointTitle}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {t.moduleName}
                      {t.dueDate && <> · due {new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</>}
                      {t.evidenceCount > 0 && <> · {t.evidenceCount} evidence file{t.evidenceCount > 1 ? 's' : ''}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={t.status} />
                    <Link to={`/checkpoints/${t.checkpointId}`} className="btn btn-outline btn-sm">
                      {t.status === 'PENDING' ? 'Start' : t.status === 'DRAFT' ? 'Continue' : 'View'} <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Weekly bar */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Last 7 Days
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: chart.cursorFill }} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
              <Bar dataKey="submissions" name="Submissions" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="approved" name="Approved" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-text">Recent Activity</h2>
            <Link to="/history" className="text-xs text-primary hover:text-primary-dark font-semibold">Full history →</Link>
          </div>
          <div className="divide-y divide-border-light">
            {data.recentActivity.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-text-muted">No activity yet — submit your first checkpoint.</p>
            ) : (
              data.recentActivity.map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-primary-faint transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{a.checkpointTitle}</p>
                    <p className="text-xs text-text-muted mt-0.5">{a.moduleName} · {fmtDateTime(a.updatedAt)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status distribution */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text mb-2">Submission Status</h2>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={data.weekly.length ? [{ name: 'Approved', value: data.kpis.approvedTotal }, { name: 'Pending', value: data.kpis.pendingReview }, { name: 'Rejected', value: data.kpis.rejectedTotal }] : []} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                <Cell fill="#16a34a" />
                <Cell fill="#0284c7" />
                <Cell fill="#dc2626" />
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-[11px] font-medium text-text-secondary mt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Approved</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-info" /> Pending</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" /> Rejected</span>
          </div>
        </div>
      </div>
    </div>
  )
}
