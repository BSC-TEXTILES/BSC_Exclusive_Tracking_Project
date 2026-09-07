import { useEffect, useState } from 'react'
import { FileBarChart, Trophy, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { get } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import { complianceLabel } from '../../lib/format'
import { useChartTheme } from '../../lib/chartTheme'

interface ReportsData {
  byEmployee: { full_name: string; total: number; approved: number; rejected: number; pending: number; rate: number }[]
  compliance: { compliance_status: string; c: number }[]
  trend: { day: string; total: number; approved: number }[]
}

const COMPLIANCE_COLORS: Record<string, string> = {
  FULLY_FOLLOWED: '#16a34a', PARTIALLY_FOLLOWED: '#d97706', NOT_FOLLOWED: '#dc2626',
  NO_TRANSACTION: '#94a3b8', YET_TO_IMPLEMENT: '#0ea5e9',
}

export default function SupervisorReports() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const chart = useChartTheme()

  const load = () => {
    setLoading(true)
    setError('')
    get<ReportsData>('/api/supervisor/reports')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState message={error || 'Failed to load'} onRetry={load} />

  const trend = data.trend.map((t) => ({ ...t, label: new Date(t.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }))
  const compliancePie = data.compliance.map((c) => ({ name: complianceLabel(c.compliance_status), value: c.c, raw: c.compliance_status }))

  return (
    <div>
      <PageHeader title="Team Reports" subtitle="Performance analytics for your team" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> 14-day team trend</h3>
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

        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2"><FileBarChart className="w-4 h-4 text-primary" /> Team compliance</h3>
          {compliancePie.length === 0 ? (
            <p className="text-xs text-text-muted py-10 text-center">No compliance data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={compliancePie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={3}>
                  {compliancePie.map((p) => <Cell key={p.name} fill={COMPLIANCE_COLORS[p.raw] || '#0ea5e9'} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-bold text-text flex items-center gap-2"><Trophy className="w-4 h-4 text-warning" /> Team leaderboard</h3>
        </div>
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Total</th><th>Approved</th><th>Rejected</th><th>Pending</th><th>Approval Rate</th></tr>
          </thead>
          <tbody>
            {data.byEmployee.map((e) => (
              <tr key={e.full_name}>
                <td className="font-semibold text-text">{e.full_name}</td>
                <td>{e.total}</td>
                <td className="text-success font-bold">{e.approved}</td>
                <td className="text-danger font-bold">{e.rejected}</td>
                <td className="text-warning font-bold">{e.pending}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-surface-alt h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-400 to-sky-600 h-full" style={{ width: `${e.rate || 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-text tabular-nums">{Math.round(e.rate || 0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {data.byEmployee.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-text-muted">No team data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
