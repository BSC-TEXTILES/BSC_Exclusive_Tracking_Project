'use client'

import { useState, useEffect } from 'react'
import {
  FileBarChart,
  Download,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Layers,
  FileCheck2,
} from 'lucide-react'
import { LiveDateTime } from '@/components/ui/live-date-time'

interface UserSummary {
  id: string
  fullName: string
  employeeCode: string
  email: string
  role: string
  department: string
}

interface ReportSummary {
  totalSubmissions: number
  approved: number
  rejected: number
  pending: number
  drafts: number
  complianceRate: number
  accuracyRate: number
}

interface ModuleBreakdown {
  id: string
  name: string
  slug: string
  totalCheckpoints: number
  submissionsCount: number
  approvedCount: number
  pendingCount: number
  complianceRate: number
}

interface RecentSubmission {
  id: string
  checkpointTitle: string
  moduleName: string
  status: string
  complianceStatus: string
  accuracyStatus: string
  submissionDate: string
  evidenceCount: number
}

interface ReportData {
  user: UserSummary
  summary: ReportSummary
  moduleBreakdown: ModuleBreakdown[]
  recentSubmissions: RecentSubmission[]
}

const STATUS_BORDER: Record<string, string> = {
  APPROVED: 'border-border',
  REJECTED: 'border-danger',
  SUBMITTED: 'border-border',
  PENDING: 'border-warning',
  DRAFT: 'border-border-light',
}

const STATUS_TEXT: Record<string, string> = {
  APPROVED: 'text-success',
  REJECTED: 'text-danger',
  SUBMITTED: 'text-text-secondary',
  PENDING: 'text-warning',
  DRAFT: 'text-text-muted',
}

const STATUS_BG: Record<string, string> = {
  APPROVED: 'bg-success',
  REJECTED: 'bg-danger',
  SUBMITTED: 'bg-surface-alt',
  PENDING: 'bg-warning',
  DRAFT: 'bg-surface',
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'all'>('all')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    async function fetchData() {
      try {
        const res = await fetch(`/api/reports?range=${range}`)
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const json = await res.json()
        if (json.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (!ignore && json.success) {
          setData(json.data)
          setError(null)
        }
      } catch (err) {
        console.error('Failed to load reports:', err)
        if (!ignore) setError('Failed to load reports. Please try again.')
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }
    fetchData()
    return () => { ignore = true }
  }, [range])

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range }),
      })
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ivt-report-${range}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setError(null)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export CSV report.')
    } finally {
      setExporting(false)
    }
  }

  const approvalRate = data?.summary.totalSubmissions
    ? Math.round((data.summary.approved / data.summary.totalSubmissions) * 100)
    : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-slide-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-text">Reports</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Operational compliance tracking and performance analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LiveDateTime
              showSeconds={false}
              dateFormat="compact"
              timeFormat="12h"
              dateClassName="text-xs font-semibold text-text"
              timeClassName="text-xs text-text-muted font-mono"
            />
            <button
              onClick={() => {
                setLoading(true)
                setError(null)
                fetch(`/api/reports?range=${range}`).then(r => {
                  if (r.status === 401) {
                    window.location.replace('/login')
                    return
                  }
                  return r.json()
                }).then(j => {
                  if (!j) return
                  if (j.code === 'UNAUTHORIZED') {
                    window.location.replace('/login')
                    return
                  }
                  if (j.success) {
                    setData(j.data)
                    setError(null)
                  }
                  setLoading(false)
                }).catch(() => {
                  setError('Failed to refresh reports.')
                  setLoading(false)
                })
              }}
              className="p-1.5 border border-border bg-surface hover:bg-surface-alt text-text-secondary"
              title="Refresh reports"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-warning' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-danger/10 border border-danger px-4 py-2.5 flex items-center justify-between text-xs text-danger">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-danger hover:opacity-80 ml-3">Dismiss</button>
          </div>
        )}

        {/* Time Range Tabs & Export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Report time range"
            className="flex items-center border border-border bg-surface"
          >
            {(
              [
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'Past 7 Days' },
                { key: 'month', label: 'Past 30 Days' },
                { key: 'all', label: 'All Time' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={range === tab.key}
                onClick={() => { setRange(tab.key); setError(null) }}
                className={`px-3 py-1.5 text-xs font-medium ${
                  range === tab.key
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-surface-alt'
                } ${tab.key !== 'today' ? 'border-l border-border' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border bg-surface text-text-secondary hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface border border-border p-4 hover-lift">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Total Submissions</span>
              <FileCheck2 className="w-3.5 h-3.5 text-text-muted" />
            </div>
            <p className="text-2xl font-bold text-text">
              {data?.summary.totalSubmissions ?? 0}
            </p>
          </div>

          <div className="bg-surface border border-border p-4 hover-lift">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Approved</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">
              {data?.summary.approved ?? 0}
            </p>
          </div>

          <div className="bg-surface border border-border p-4 hover-lift">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Pending</span>
              <Clock className="w-3.5 h-3.5 text-warning" />
            </div>
            <p className="text-2xl font-bold text-warning">
              {data?.summary.pending ?? 0}
            </p>
          </div>

          <div className="bg-surface border border-border p-4 hover-lift">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Approval Rate</span>
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-text">
              {approvalRate}%
            </p>
          </div>
        </div>

        {/* Module Breakdown Table */}
        <div className="bg-surface border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-header-bg">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-text-muted" />
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Module Breakdown</h2>
            </div>
            <span className="text-[10px] text-text-muted">{data?.moduleBreakdown.length ?? 0} modules</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-alt border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Module</th>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-right">Total</th>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-right">Approved</th>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-right">Pending</th>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-right">Compliance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {data?.moduleBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-text-muted text-xs">No module data available.</td>
                  </tr>
                ) : (
                  data?.moduleBreakdown.map(mod => (
                    <tr key={mod.id} className="hover:bg-surface-alt">
                      <td className="px-4 py-2.5 font-medium text-text whitespace-nowrap">{mod.name}</td>
                      <td className="px-4 py-2.5 text-right text-text-secondary">{mod.submissionsCount}</td>
                      <td className="px-4 py-2.5 text-right text-success font-medium">{mod.approvedCount}</td>
                      <td className="px-4 py-2.5 text-right text-warning font-medium">{mod.pendingCount}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-medium ${mod.complianceRate >= 80 ? 'text-success' : mod.complianceRate >= 50 ? 'text-warning' : 'text-danger'}`}>
                          {mod.complianceRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Submissions Audit Trail */}
        <div className="bg-surface border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-header-bg">
            <div className="flex items-center gap-1.5">
              <FileBarChart className="w-3.5 h-3.5 text-text-muted" />
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Recent Submissions</h2>
            </div>
          </div>

          {data?.recentSubmissions.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-muted text-xs">
              No submissions recorded for this date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-alt border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Date</th>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Module</th>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Checkpoint</th>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Compliance</th>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Accuracy</th>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {data?.recentSubmissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-surface-alt">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-text-muted whitespace-nowrap">
                        {new Date(sub.submissionDate).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text whitespace-nowrap">
                        {sub.moduleName}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary max-w-xs truncate" title={sub.checkpointTitle}>
                        {sub.checkpointTitle}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                          sub.complianceStatus === 'COMPLIANT' || sub.complianceStatus === 'YES'
                            ? 'bg-success/10 text-success border-success'
                            : 'bg-warning/10 text-warning border-warning'
                        }`}>
                          {sub.complianceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                          sub.accuracyStatus === 'ACCURATE' || sub.accuracyStatus === 'YES'
                            ? 'bg-primary-light text-primary border-primary'
                            : 'bg-surface-alt text-text-muted border-border-light'
                        }`}>
                          {sub.accuracyStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                          STATUS_BG[sub.status] || 'bg-surface'
                        } ${STATUS_TEXT[sub.status] || 'text-text-secondary'} ${STATUS_BORDER[sub.status] || 'border-border'}`}>
                          {sub.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
