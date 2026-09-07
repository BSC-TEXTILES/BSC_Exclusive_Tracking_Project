import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { Search, FileDown, ShieldCheck } from 'lucide-react'
import { get, apiUrl } from '../lib/api'
import { Spinner, ErrorState, PageHeader } from '../components/States'
import StatusBadge from '../components/StatusBadge'
import { complianceLabel, accuracyLabel, fmtDate, fmtDateTime } from '../lib/format'
import { useChartTheme } from '../lib/chartTheme'

interface HistoryItem {
  id: string
  checkpointTitle: string
  moduleName: string
  moduleSlug: string
  departmentName: string
  submissionDate: string
  status: string
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  reviewComment: string | null
  autoApproved: boolean
  complianceStatus: string | null
  accuracyStatus: string | null
  evidenceCount: number
  score: number
}

interface HistoryData {
  items: HistoryItem[]
  total: number
  page: number
  pageSize: number
  modules: { slug: string; name: string }[]
}

const PIE_COLORS = ['#0ea5e9', '#0284c7', '#0369a1', '#38bdf8', '#7dd3fc', '#bae6fd']

export default function History() {
  const [data, setData] = useState<HistoryData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [module, setModule] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const chart = useChartTheme()

  const load = () => {
    setLoading(true)
    setError('')
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    if (module) q.set('module', module)
    if (search) q.set('search', search)
    q.set('page', String(page))
    q.set('pageSize', '15')
    get<HistoryData>(`/api/submissions/history?${q.toString()}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status, module, search, page])

  const byModule = (data?.items || []).reduce<Record<string, number>>((acc, i) => {
    acc[i.moduleName] = (acc[i.moduleName] || 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(byModule).map(([name, value]) => ({ name, value }))

  return (
    <div>
      <PageHeader
        title="Submission History"
        subtitle="Every checkpoint you have submitted, with review outcomes"
        actions={
          <a href={apiUrl('/api/reports/export')} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            <FileDown className="w-3.5 h-3.5" /> Export CSV
          </a>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search checkpoint or module..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          <option>APPROVED</option>
          <option>SUBMITTED</option>
          <option>REJECTED</option>
          <option>DRAFT</option>
          <option>PENDING</option>
        </select>
        <select className="input w-44" value={module} onChange={(e) => { setModule(e.target.value); setPage(1) }}>
          <option value="">All modules</option>
          {(data?.modules || []).map((m) => (
            <option key={m.slug} value={m.slug}>{m.name}</option>
          ))}
        </select>
      </div>

      {loading ? <Spinner text="Loading history..." /> : error || !data ? <ErrorState message={error || 'Failed to load'} onRetry={load} /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th><th>Checkpoint</th><th>Module</th><th>Compliance</th><th>Accuracy</th><th>Evidence</th><th>Status</th><th>Reviewed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-text-muted">No submissions match your filters.</td></tr>
                  ) : (
                    data.items.map((i) => (
                      <tr key={i.id}>
                        <td className="whitespace-nowrap">{fmtDate(i.submissionDate)}</td>
                        <td className="max-w-[220px]">
                          <p className="font-semibold text-text truncate">{i.checkpointTitle}</p>
                          <p className="text-[10px] text-text-muted">{i.score} pts</p>
                        </td>
                        <td>{i.moduleName}</td>
                        <td>{complianceLabel(i.complianceStatus)}</td>
                        <td>{accuracyLabel(i.accuracyStatus)}</td>
                        <td className="text-center">{i.evidenceCount || '—'}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={i.status} />
                            {i.autoApproved && <span className="flex items-center gap-1 text-[10px] text-info font-semibold"><ShieldCheck className="w-3 h-3" /> Auto</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-xs text-text-secondary">
                          {i.approvedAt ? fmtDateTime(i.approvedAt) : i.rejectedAt ? fmtDateTime(i.rejectedAt) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-bold text-text mb-3">Submissions by module</h3>
              {pieData.length === 0 ? (
                <p className="text-xs text-text-muted py-6 text-center">No data</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chart.tooltipBorder}`, background: chart.tooltipBg, color: chart.tooltipText }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-1">
                    {pieData.map((p, i) => (
                      <li key={p.name} className="flex items-center gap-2 text-[11px] text-text-secondary">
                        <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {p.name} <span className="font-bold text-text ml-auto">{p.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{data.total} total submission{data.total === 1 ? '' : 's'}</span>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="self-center font-semibold text-text">Page {page}</span>
              <button className="btn btn-outline btn-sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
