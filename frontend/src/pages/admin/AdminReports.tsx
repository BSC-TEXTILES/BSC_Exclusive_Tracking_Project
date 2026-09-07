import { useEffect, useState } from 'react'
import { FileBarChart, FileDown, Trophy, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { get, apiUrl } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import { complianceLabel, accuracyLabel } from '../../lib/format'
import { useChartTheme } from '../../lib/chartTheme'

interface ReportsData {
  byUser: { full_name: string; department_name: string | null; total: number; approved: number; rejected: number; pending: number; rate: number }[]
  compliance: { compliance_status: string; c: number }[]
  accuracy: { accuracy_status: string; c: number }[]
  monthly: { month: string; total: number; approved: number; rejected: number }[]
}

const COMPLIANCE_COLORS: Record<string, string> = {
  FULLY_FOLLOWED: '#16a34a', PARTIALLY_FOLLOWED: '#d97706', NOT_FOLLOWED: '#dc2626',
  NO_TRANSACTION: '#94a3b8', YET_TO_IMPLEMENT: '#0ea5e9',
}

export default function AdminReports() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const chart = useChartTheme()

  const load = () => {
    setLoading(true)
    setError('')
    get<ReportsData>('/api/admin/reports')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState message={error || 'Failed to load'} onRetry={load} />

  const compliancePie = data.compliance.map((c) => ({ name: complianceLabel(c.compliance_status), value: c.c, raw: c.compliance_status }))
  const monthly = data.monthly.map((m) => ({ ...m, label: m.month })).reverse()

  return (
    <div>
      <PageHeader
        title="Organization Reports"
        subtitle="Compliance analytics across every user"
        actions={<a href={apiUrl('/api/admin/reports/export')} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"><FileDown className="w-3.5 h-3.5" /> Export all CSV</a>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Monthly submissions</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chart.textColor }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
              <Bar dataKey="total" name="Total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="approved" name="Approved" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rejected" name="Rejected" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2"><FileBarChart className="w-4 h-4 text-primary" /> Organization compliance</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={compliancePie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={3}>
                {compliancePie.map((p) => <Cell key={p.name} fill={COMPLIANCE_COLORS[p.raw] || '#0ea5e9'} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 flex-wrap text-[10px] font-semibold text-text-secondary mt-1">
            {compliancePie.map((p) => (
              <span key={p.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COMPLIANCE_COLORS[p.raw] || '#0ea5e9' }} /> {p.name} ({p.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Per-user leaderboard */}
      <div className="card overflow-x-auto">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-bold text-text flex items-center gap-2"><Trophy className="w-4 h-4 text-warning" /> Team performance</h3>
        </div>
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Department</th><th>Total</th><th>Approved</th><th>Rejected</th><th>Pending</th><th>Approval Rate</th></tr>
          </thead>
          <tbody>
            {data.byUser.map((u) => (
              <tr key={u.full_name}>
                <td className="font-semibold text-text">{u.full_name}</td>
                <td>{u.department_name || '—'}</td>
                <td>{u.total}</td>
                <td className="text-success font-bold">{u.approved}</td>
                <td className="text-danger font-bold">{u.rejected}</td>
                <td className="text-warning font-bold">{u.pending}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-surface-alt h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-400 to-sky-600 h-full" style={{ width: `${u.rate || 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-text tabular-nums">{Math.round(u.rate || 0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.accuracy.length > 0 && (
        <div className="card p-5 mt-4">
          <h3 className="text-sm font-bold text-text mb-3">Accuracy overview</h3>
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
