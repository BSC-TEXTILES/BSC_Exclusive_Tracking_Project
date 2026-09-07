import { useEffect, useState } from 'react'
import {
  FileBarChart,
  FileDown,
  CheckCircle2,
  XCircle,
  Clock,
  FileEdit,
  TrendingUp,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { get, apiUrl } from '../lib/api'
import { Spinner, ErrorState, PageHeader } from '../components/States'
import StatCard from '../components/StatCard'
import { complianceLabel, accuracyLabel } from '../lib/format'
import { useChartTheme } from '../lib/chartTheme'

interface ReportsData {
  totals: { total: number; approved: number; rejected: number; submitted: number; draft: number; pending: number; approvalRate: number }
  byStatus: { status: string; c: number }[]
  compliance: { compliance_status: string; c: number }[]
  accuracy: { accuracy_status: string; c: number }[]
  byModule: { module_name: string; total: number; approved: number; rejected: number; pending: number }[]
  trend: { day: string; total: number; approved: number }[]
  monthly: { month: string; total: number; approved: number; rejected: number }[]
}

const PIE_COLORS = ['#0ea5e9', '#16a34a', '#dc2626', '#d97706', '#94a3b8']
const COMPLIANCE_COLORS: Record<string, string> = {
  FULLY_FOLLOWED: '#16a34a',
  PARTIALLY_FOLLOWED: '#d97706',
  NOT_FOLLOWED: '#dc2626',
  NO_TRANSACTION: '#94a3b8',
  YET_TO_IMPLEMENT: '#0ea5e9',
}

export default function Reports() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const chart = useChartTheme()

  const load = () => {
    setLoading(true)
    setError('')
    get<ReportsData>('/api/reports')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <Spinner text="Building reports..." />
  if (error || !data) return <ErrorState message={error || 'Failed to load reports'} onRetry={load} />

  const statusPie = data.byStatus.map((s) => ({ name: s.status, value: s.c }))
  const compliancePie = data.compliance.map((c) => ({ name: complianceLabel(c.compliance_status), value: c.c, raw: c.compliance_status }))
  const trend = data.trend.map((t) => ({ ...t, label: new Date(t.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }))

  return (
    <div>
      <PageHeader
        title="Compliance Reports"
        subtitle="Your compliance & accuracy analytics"
        actions={
          <a href={apiUrl('/api/reports/export')} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            <FileDown className="w-3.5 h-3.5" /> Export CSV
          </a>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total" value={data.totals.total} icon={FileBarChart} />
        <StatCard label="Approved" value={data.totals.approved} icon={CheckCircle2} tone="success" />
        <StatCard label="Rejected" value={data.totals.rejected} icon={XCircle} tone="danger" />
        <StatCard label="Pending" value={data.totals.submitted} icon={Clock} tone="info" />
        <StatCard label="Drafts" value={data.totals.draft} icon={FileEdit} tone="warning" />
        <StatCard label="Approval Rate" value={`${data.totals.approvalRate}%`} icon={TrendingUp} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3">30-day trend</h3>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
              <Line type="monotone" dataKey="total" name="Submissions" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="approved" name="Approved" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3">Compliance distribution</h3>
          {compliancePie.length === 0 ? (
            <p className="text-xs text-text-muted py-10 text-center">No compliance data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={compliancePie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3}>
                  {compliancePie.map((p) => (
                    <Cell key={p.name} fill={COMPLIANCE_COLORS[p.raw] || '#0ea5e9'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
                <Legend wrapperStyle={{ fontSize: 11, color: chart.textColor }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3">Status overview</h3>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {statusPie.map((s, i) => (
                  <Cell key={s.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
              <Legend wrapperStyle={{ fontSize: 11, color: chart.textColor }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3">By module</h3>
          {data.byModule.length === 0 ? (
            <p className="text-xs text-text-muted py-10 text-center">No module data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.byModule} layout="vertical" margin={{ top: 5, right: 15, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="module_name" tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
                <Bar dataKey="approved" name="Approved" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#0ea5e9" />
                <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {data.accuracy.length > 0 && (
        <div className="card p-5 mt-4">
          <h3 className="text-sm font-bold text-text mb-3">Accuracy ratings</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.accuracy.map((a) => (
              <div key={a.accuracy_status} className="rounded-xl bg-surface-alt border border-border p-4 text-center">
                <p className="text-2xl font-extrabold text-primary tabular-nums">{a.c}</p>
                <p className="text-[11px] font-semibold text-text-secondary mt-1">{accuracyLabel(a.accuracy_status)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
