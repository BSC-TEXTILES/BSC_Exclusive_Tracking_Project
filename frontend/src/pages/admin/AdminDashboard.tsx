import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Building2, FolderOpen, ListChecks, ClipboardCheck, Paperclip,
  Satellite, CheckCircle2, Clock, AlertTriangle, Activity, ArrowRight, MapPin, ShieldCheck, Search, CalendarDays,
  Smartphone, Monitor, Laptop, Globe, Wifi, Copy, Check,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { get } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { fmtDateTime, timeAgo } from '../../lib/format'
import { useChartTheme } from '../../lib/chartTheme'
import GlobalSearchModal from '../../components/GlobalSearchModal'
import UserAnalyticsCharts from '../../components/UserAnalyticsCharts'

interface AdminDashboardData {
  counts: {
    users: number
    departments: number
    modules: number
    checkpoints: number
    submissions: number
    pendingReview: number
    approvedToday: number
    evidence: number
    onlineTrackers: number
    roles?: number
  }
  trend: { day: string; total: number; approved: number }[]
  statusDistribution: { status: string; c: number }[]
  departmentPerformance: { name: string; total: number; approved: number; pending: number; rejected: number }[]
  recentSubmissions: { id: string; user_name: string; checkpoint_title: string; module_name: string; status: string; submission_date: string; updated_at: string }[]
  latestTracks: { full_name: string; role_name: string; department_name: string | null; latitude: number; longitude: number; address: string | null; battery_level: number | null; tracked_at: string; online: boolean }[]
  recentAudit: { id: string; user_name: string | null; action: string; entity_type: string; created_at: string }[]
  recentActiveDevices?: {
    user_id: string
    full_name: string
    employee_code: string
    role_name: string
    ip_address: string
    device_info: string
    device_type: string
    last_login_at: string
  }[]
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#16a34a', SUBMITTED: '#0ea5e9', REJECTED: '#dc2626', DRAFT: '#d97706', PENDING: '#94a3b8', OVERDUE: '#7f1d1d',
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [copiedIp, setCopiedIp] = useState<string | null>(null)
  const chart = useChartTheme()

  const copyIp = (ip: string) => {
    navigator.clipboard?.writeText(ip)
    setCopiedIp(ip)
    setTimeout(() => setCopiedIp(null), 2000)
  }

  const load = () => {
    setLoading(true)
    setError('')
    get<AdminDashboardData>('/api/admin/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <Spinner text="Loading admin dashboard..." />
  if (error || !data) return <ErrorState message={error || 'Failed to load'} onRetry={load} />

  const trend = data.trend.map((t) => ({ ...t, label: new Date(t.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }))
  const statusPie = data.statusDistribution.map((s) => ({ name: s.status, value: s.c }))

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Complete overview of the tracking system"
        actions={
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/10 shadow-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search System...</span>
            <kbd className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded text-white/80">Ctrl+K</kbd>
          </button>
        }
      />

      {/* Global Search Modal */}
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Live Customer & BSC User Analytics */}
      <UserAnalyticsCharts />

      {/* Admin Calendar Quick Access Card */}
      <div className="card p-4 mb-4 bg-gradient-to-r from-primary/10 via-surface to-surface border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text flex items-center gap-2">
              Compliance Tracking Calendar
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                Daily Verification
              </span>
            </h4>
            <p className="text-xs text-text-muted mt-0.5">
              Inspect process completion rates, exact timings, candidate profiles, and evidence files for any date.
            </p>
          </div>
        </div>
        <Link
          to="/admin/calendar"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:opacity-90 transition-opacity shrink-0"
        >
          Open Calendar &rarr;
        </Link>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
        <StatCard label="Active Users" value={data.counts.users} icon={Users} />
        <StatCard label="Departments" value={data.counts.departments} icon={Building2} />
        <StatCard label="Modules" value={data.counts.modules} icon={FolderOpen} />
        <StatCard label="Checkpoints" value={data.counts.checkpoints} icon={ListChecks} />
        <StatCard label="Total Submissions" value={data.counts.submissions} icon={ClipboardCheck} />
        <StatCard label="Pending Review" value={data.counts.pendingReview} icon={Clock} tone="warning" hint="Auto-approve after 1h" />
        <StatCard label="Approved Today" value={data.counts.approvedToday} icon={CheckCircle2} tone="success" />
        <StatCard label="Evidence Files" value={data.counts.evidence} icon={Paperclip} tone="info" />
        <StatCard label="Online Trackers" value={data.counts.onlineTrackers} icon={Satellite} tone="primary" hint="Live GPS · 30 min cycle" />
        <StatCard label="Roles Created" value={data.counts.roles ?? 5} icon={ShieldCheck} tone="primary" hint="Role-based permissions" />
        <StatCard label="Log Entries" value="Live" icon={Activity} tone="success" hint="Audit trail active" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Trend */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-bold text-text mb-3">Submissions — last 14 days</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={trend} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
              <Bar dataKey="total" name="Total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="approved" name="Approved" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3">Status distribution</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={3}>
                {statusPie.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#94a3b8'} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 flex-wrap text-[10px] font-semibold text-text-secondary mt-1">
            {statusPie.map((s) => (
              <span key={s.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s.name] || '#94a3b8' }} /> {s.name} ({s.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live locations */}
        <div className="card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Satellite className="w-4 h-4 text-primary" /> Live Locations
            </h3>
            <Link to="/admin/tracking" className="text-xs text-primary hover:text-primary-dark font-semibold">Open map →</Link>
          </div>
          <div className="divide-y divide-border-light max-h-80 overflow-y-auto">
            {data.latestTracks.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-text-muted">No location data yet</p>
            ) : (
              data.latestTracks.map((t) => (
                <div key={t.full_name} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-text truncate">{t.full_name}</p>
                    <span className={`flex items-center gap-1 text-[10px] font-bold ${t.online ? 'text-success' : 'text-text-muted'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.online ? 'bg-success' : 'bg-slate-300'}`} />
                      {t.online ? 'Online' : timeAgo(t.tracked_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {t.latitude ? `${t.latitude.toFixed(5)}, ${t.longitude.toFixed(5)}` : 'No fix yet'}
                    {t.address ? ` · ${t.address}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent submissions */}
        <div className="card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" /> Recent Submissions
            </h3>
            <Link to="/admin/submissions" className="text-xs text-primary hover:text-primary-dark font-semibold">Review →</Link>
          </div>
          <div className="divide-y divide-border-light max-h-80 overflow-y-auto">
            {data.recentSubmissions.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-text-muted">No submissions yet</p>
            ) : (
              data.recentSubmissions.map((s) => (
                <div key={s.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-text truncate">{s.checkpoint_title}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {s.user_name} · {s.module_name} · {s.submission_date}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent audit */}
        <div className="card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Recent Audit Activity
            </h3>
            <Link to="/admin/audit-logs" className="text-xs text-primary hover:text-primary-dark font-semibold">All logs →</Link>
          </div>
          <div className="divide-y divide-border-light max-h-80 overflow-y-auto">
            {data.recentAudit.map((a) => (
              <div key={a.id} className="px-5 py-3">
                <p className="text-xs font-bold text-text">{a.action}</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {a.user_name || 'System'} · {a.entity_type} · {fmtDateTime(a.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Connected Systems & Mobile Devices (Device & IP Security Telemetry) */}
      <div className="card mt-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-alt/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text">
                  Connected Systems & Mobile Devices
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live IP Telemetry
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Real-time tracking of employee mobile phone devices, desktop system IP addresses, and browsers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary">
              <Smartphone className="w-3.5 h-3.5 text-purple-500" />
              <span>
                {data.recentActiveDevices?.filter((d) => d.device_type === 'Mobile').length || 0} Mobiles
              </span>
              <span className="text-border">|</span>
              <Monitor className="w-3.5 h-3.5 text-sky-500" />
              <span>
                {data.recentActiveDevices?.filter((d) => d.device_type !== 'Mobile').length || 0} Systems
              </span>
            </div>
            <Link to="/admin/users" className="text-xs text-primary hover:text-primary-dark font-semibold">
              Manage users →
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User / Employee</th>
                <th>Device Category</th>
                <th>Operating System & Browser</th>
                <th>System / Mobile IP Address</th>
                <th>Last Active Time</th>
              </tr>
            </thead>
            <tbody>
              {(!data.recentActiveDevices || data.recentActiveDevices.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-text-muted">
                    No active device telemetry recorded yet.
                  </td>
                </tr>
              ) : (
                data.recentActiveDevices.map((d) => {
                  const isMobile = d.device_type === 'Mobile'
                  return (
                    <tr key={d.user_id + (d.ip_address || '')}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            isMobile ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                          }`}>
                            {d.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-text text-xs">{d.full_name}</p>
                            <p className="text-[11px] text-text-muted">{d.employee_code} · {d.role_name}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isMobile
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                            : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                        }`}>
                          {isMobile ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                          {isMobile ? 'Mobile Phone' : 'Desktop / System'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span className="text-xs text-text font-medium" title={d.device_info}>
                            {d.device_info || 'System Terminal'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-text font-bold bg-surface-alt px-2 py-0.5 rounded border border-border flex items-center gap-1.5">
                            <Wifi className="w-3 h-3 text-emerald-500" />
                            {d.ip_address || '127.0.0.1'}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyIp(d.ip_address || '127.0.0.1')}
                            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-alt transition-colors"
                            title="Copy IP Address"
                          >
                            {copiedIp === (d.ip_address || '127.0.0.1') ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="text-xs text-text font-medium block">
                          {timeAgo(d.last_login_at)}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {fmtDateTime(d.last_login_at)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick links */}
      <div className="card p-4 mt-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">Quick actions:</span>
        {[
          ['Create user', '/admin/users'],
          ['New module', '/admin/modules'],
          ['Assign checkpoint', '/admin/assignments'],
          ['Review submissions', '/admin/submissions'],
          ['Live tracking map', '/admin/tracking'],
        ].map(([label, to]) => (
          <Link key={to} to={to} className="btn btn-outline btn-sm">
            {label} <ArrowRight className="w-3 h-3" />
          </Link>
        ))}
      </div>
    </div>
  )
}
