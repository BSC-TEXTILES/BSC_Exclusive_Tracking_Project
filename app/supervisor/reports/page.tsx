'use client'

import { useState, useEffect } from 'react'
import {
  FileBarChart,
  Download,
  Loader2,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'

interface SummaryStats {
  totalSubmissions: number
  approved: number
  rejected: number
  pending: number
}

interface ModuleRow {
  moduleId: string
  moduleName: string
  department: string
  totalSubmissions: number
  approved: number
  rejected: number
  pending: number
}

interface EmployeeRow {
  userId: string
  fullName: string
  employeeCode: string
  department: string | null
  totalSubmissions: number
  approved: number
  rejected: number
  pending: number
}

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) => (
  <div className="bg-surface border border-border rounded-lg p-4">
    <div className="flex items-center gap-3">
      <div className={`flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-text leading-tight">{value}</p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  </div>
)

export default function ReportsPage() {
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [byModule, setByModule] = useState<ModuleRow[]>([])
  const [byEmployee, setByEmployee] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)

  const [moduleFilter, setModuleFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [modules, setModules] = useState<{ id: string; name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; fullName: string; employeeCode: string }[]>([])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (moduleFilter) params.set('moduleId', moduleFilter)
      if (employeeFilter) params.set('userId', employeeFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/supervisor/reports?${params}`)
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const data = await res.json()
      if (data.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (data.success) {
        setSummary(data.data.summary)
        setByModule(data.data.byModule || [])
        setByEmployee(data.data.byEmployee || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (moduleFilter) params.set('moduleId', moduleFilter)
        if (employeeFilter) params.set('userId', employeeFilter)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        const res = await fetch(`/api/supervisor/reports?${params}`, { signal: controller.signal })
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        const data = await res.json()
        if (data.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (!controller.signal.aborted && data.success) {
          setSummary(data.data.summary)
          setByModule(data.data.byModule || [])
          setByEmployee(data.data.byEmployee || [])
        }
      } catch {
        // silent
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [moduleFilter, employeeFilter, dateFrom, dateTo])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [modRes, empRes] = await Promise.all([
          fetch('/api/supervisor/projects'),
          fetch('/api/supervisor/employees'),
        ])
        if (modRes.status === 401 || empRes.status === 401) {
          window.location.replace('/login')
          return
        }
        const modData = await modRes.json()
        if (modData.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (modData.success) setModules(modData.data.projects || [])
        const empData = await empRes.json()
        if (empData.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (empData.success) setEmployees(empData.data.employees || [])
      } catch {}
    }
    loadMeta()
  }, [])

  const exportCSV = () => {
    const headers = ['Employee', 'Employee ID', 'Department', 'Total Submissions', 'Approved', 'Rejected', 'Pending']
    const dataRows = byEmployee.map(r => [
      r.fullName, r.employeeCode, r.department || '', String(r.totalSubmissions),
      String(r.approved), String(r.rejected), String(r.pending),
    ])
    const csv = [headers, ...dataRows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-text flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-text-muted" />
              Reports
            </h1>
            <p className="text-sm text-text-muted mt-0.5">Team performance overview and analytics</p>
          </div>
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-light text-text-secondary rounded-md text-sm font-medium hover:bg-surface-alt">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              className="px-3 py-1.5 border border-border-light rounded-md text-sm bg-surface-alt focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">All Modules</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              value={employeeFilter}
              onChange={e => setEmployeeFilter(e.target.value)}
              className="px-3 py-1.5 border border-border-light rounded-md text-sm bg-surface-alt focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">All Employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-border-light rounded-md text-sm bg-surface-alt focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-border-light rounded-md text-sm bg-surface-alt focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={fetchReport} className="px-4 py-1.5 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover">
              Generate Report
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-surface border border-border rounded-lg p-16 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="ml-2 text-sm text-text-muted">Generating report...</span>
          </div>
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Submissions" value={summary.totalSubmissions} icon={ClipboardCheck} color="bg-primary-light text-primary" />
              <StatCard label="Approved" value={summary.approved} icon={CheckCircle2} color="bg-success-light text-success" />
              <StatCard label="Pending" value={summary.pending} icon={Clock} color="bg-warning-light text-warning" />
              <StatCard label="Rejected" value={summary.rejected} icon={XCircle} color="bg-danger-light text-danger" />
            </div>

            {byModule.length > 0 && (
              <div className="bg-surface border border-border rounded-lg mb-6">
                <div className="px-4 py-3 border-b border-border-light">
                  <h2 className="text-sm font-medium text-text">By Module</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light bg-header-bg">
                        <th className="px-4 py-2 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Module</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Approved</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Pending</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Rejected</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {byModule.map(row => {
                        const rate = row.totalSubmissions > 0 ? ((row.approved / row.totalSubmissions) * 100).toFixed(0) : '0'
                        return (
                          <tr key={row.moduleId} className="hover:bg-surface-alt">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-text">{row.moduleName}</div>
                              <div className="text-xs text-text-muted">{row.department}</div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-text-secondary">{row.totalSubmissions}</td>
                            <td className="px-4 py-2.5 text-right text-success font-medium">{row.approved}</td>
                            <td className="px-4 py-2.5 text-right text-warning font-medium">{row.pending}</td>
                            <td className="px-4 py-2.5 text-right text-danger font-medium">{row.rejected}</td>
                            <td className="px-4 py-2.5 text-right text-text-secondary">{rate}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {byEmployee.length > 0 && (
              <div className="bg-surface border border-border rounded-lg">
                <div className="px-4 py-3 border-b border-border-light">
                  <h2 className="text-sm font-medium text-text">By Employee</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light bg-header-bg">
                        <th className="px-4 py-2 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Employee</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-white/60 uppercase tracking-wider hidden md:table-cell">Employee ID</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Approved</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Pending</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Rejected</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {byEmployee.map(row => {
                        const rate = row.totalSubmissions > 0 ? ((row.approved / row.totalSubmissions) * 100).toFixed(0) : '0'
                        return (
                          <tr key={row.userId} className="hover:bg-surface-alt">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-text">{row.fullName}</div>
                              <div className="text-xs text-text-muted md:hidden">{row.employeeCode}</div>
                            </td>
                            <td className="px-4 py-2.5 text-text-secondary hidden md:table-cell font-mono text-xs">{row.employeeCode}</td>
                            <td className="px-4 py-2.5 text-right text-text-secondary">{row.totalSubmissions}</td>
                            <td className="px-4 py-2.5 text-right text-success font-medium">{row.approved}</td>
                            <td className="px-4 py-2.5 text-right text-warning font-medium">{row.pending}</td>
                            <td className="px-4 py-2.5 text-right text-danger font-medium">{row.rejected}</td>
                            <td className="px-4 py-2.5 text-right text-text-secondary">{rate}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-surface border border-border rounded-lg p-16 text-center">
            <FileBarChart className="w-10 h-10 text-text-muted mb-3 mx-auto" />
            <p className="text-sm text-text-muted">Click &quot;Generate Report&quot; to load data</p>
          </div>
        )}
      </div>
    </div>
  )
}
