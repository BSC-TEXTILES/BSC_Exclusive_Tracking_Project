import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, CheckCircle2, ClipboardCheck, FolderOpen, Building2, Clock, Activity, ArrowRight, FileBarChart, ScrollText, UserRound, Search,
} from 'lucide-react'
import { get } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { fmtDateTime } from '../../lib/format'
import GlobalSearchModal from '../../components/GlobalSearchModal'

interface DashData {
  totalEmployees: number
  activeEmployees: number
  pendingApprovals: number
  assignedProjects: number
  departments: number
  todayActivity: { id: string; userName: string; checkpointTitle: string; moduleName: string; status: string; time: string }[]
  recentApprovals: { id: string; userName: string; checkpointTitle: string; moduleName: string; status: string; submittedAt: string | null }[]
  teamPerformance: { total: number; approved: number; rejected: number; pending: number }
}

export default function SupervisorDashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    get<DashData>('/api/supervisor/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [])

  if (loading) return <Spinner text="Loading team dashboard..." />
  if (error || !data) return <ErrorState message={error || 'Failed to load'} onRetry={load} />

  const rate = data.teamPerformance.total > 0 ? Math.round((data.teamPerformance.approved / data.teamPerformance.total) * 100) : 0

  return (
    <div>
      <PageHeader
        title="Team Dashboard"
        subtitle="Your team's compliance overview"
        actions={
          <>
            <button
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/10 shadow-xs transition-colors"
            >
              <Search className="w-3.5 h-3.5" /> Search
            </button>
            <Link to="/supervisor/activity" className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"><ScrollText className="w-3.5 h-3.5" /> Activity</Link>
            <Link to="/supervisor/profile" className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"><UserRound className="w-3.5 h-3.5" /> Profile</Link>
          </>
        }
      />

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
        <StatCard label="Team Members" value={data.totalEmployees} icon={Users} />
        <StatCard label="Active" value={data.activeEmployees} icon={CheckCircle2} tone="success" />
        <StatCard label="Pending Approvals" value={data.pendingApprovals} icon={ClipboardCheck} tone="warning" />
        <StatCard label="Projects" value={data.assignedProjects} icon={FolderOpen} tone="info" />
        <StatCard label="Departments" value={data.departments} icon={Building2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-text flex items-center gap-2"><Clock className="w-4 h-4 text-warning" /> Today's team activity</h3>
            <Link to="/supervisor/activity" className="text-xs text-primary font-semibold">View all →</Link>
          </div>
          <div className="divide-y divide-border-light max-h-72 overflow-y-auto">
            {data.todayActivity.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-text-muted">No activity today yet.</p>
            ) : (
              data.todayActivity.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{a.checkpointTitle}</p>
                    <p className="text-xs text-text-muted mt-0.5">{a.moduleName} · {a.userName} · {fmtDateTime(a.time)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-text flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-info" /> Team performance</h3>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Approval rate</span>
              <span className="text-sm font-extrabold text-primary tabular-nums">{rate}%</span>
            </div>
            <div className="w-full bg-surface-alt h-2.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-sky-400 to-sky-600 h-full rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-xs text-text-secondary">Total submissions</span><b className="text-text tabular-nums">{data.teamPerformance.total}</b></div>
            <div className="flex justify-between"><span className="text-xs text-text-secondary flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" /> Approved</span><b className="text-success tabular-nums">{data.teamPerformance.approved}</b></div>
            <div className="flex justify-between"><span className="text-xs text-text-secondary flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger" /> Rejected</span><b className="text-danger tabular-nums">{data.teamPerformance.rejected}</b></div>
            <div className="flex justify-between"><span className="text-xs text-text-secondary flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" /> Pending review</span><b className="text-warning tabular-nums">{data.teamPerformance.pending}</b></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-text flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /> Recent approval requests</h3>
            <Link to="/supervisor/approvals" className="text-xs text-primary font-semibold">Review queue →</Link>
          </div>
          <div className="divide-y divide-border-light max-h-72 overflow-y-auto">
            {data.recentApprovals.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-text-muted">No recent submissions.</p>
            ) : (
              data.recentApprovals.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{a.checkpointTitle}</p>
                    <p className="text-xs text-text-muted mt-0.5">{a.moduleName} · {a.userName}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-bold text-text flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Quick actions</h3>
          </div>
          <div className="p-3 space-y-1.5">
            {[
              { label: 'Review approvals', to: '/supervisor/approvals', icon: ClipboardCheck },
              { label: 'Manage team', to: '/supervisor/employees', icon: Users },
              { label: 'Team reports', to: '/supervisor/reports', icon: FileBarChart },
              { label: 'Departments', to: '/supervisor/departments', icon: Building2 },
              { label: 'Projects', to: '/supervisor/projects', icon: FolderOpen },
            ].map((a) => (
              <Link key={a.to} to={a.to} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary-faint border border-transparent hover:border-primary transition-colors group">
                <span className="w-8 h-8 rounded-lg bg-surface-alt group-hover:bg-primary-light flex items-center justify-center"><a.icon className="w-4 h-4 text-text-muted group-hover:text-primary" /></span>
                <span className="text-xs font-semibold text-text group-hover:text-primary">{a.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
