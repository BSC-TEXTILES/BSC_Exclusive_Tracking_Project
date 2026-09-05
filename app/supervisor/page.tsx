'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users,
  ClipboardCheck,
  FileCheck,
  Building2,
  FolderOpen,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Activity,
  CalendarDays,
  FileBarChart,
  ShieldCheck,
  Loader2,
  ScrollText,
  User,
} from 'lucide-react'

interface DashboardData {
  totalEmployees: number
  activeEmployees: number
  pendingApprovals: number
  assignedProjects: number
  departments: number
  todayActivity: Array<{
    id: string
    userName: string
    checkpointTitle: string
    moduleName: string
    status: string
    time: string
  }>
  recentApprovals: Array<{
    id: string
    userName: string
    checkpointTitle: string
    moduleName: string
    status: string
    submittedAt: string
  }>
  teamPerformance: {
    totalSubmissions: number
    approved: number
    rejected: number
    pending: number
  }
}

export default function SupervisorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/supervisor/dashboard')
      if (res.status === 401) {
        window.location.replace('/login')
        return
      }
      const result = await res.json()
      if (result.code === 'UNAUTHORIZED') {
        window.location.replace('/login')
        return
      }
      if (result.success) {
        setData(result.data)
      } else {
        setError(result.message || 'Failed to load dashboard')
      }
    } catch {
      setError('Network error loading dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const statusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-success-bg text-success border border-success-border'
      case 'SUBMITTED':
        return 'bg-info-bg text-info border border-info-border'
      case 'REJECTED':
        return 'bg-danger-bg text-danger border border-danger-border'
      case 'PENDING':
        return 'bg-warning-bg text-warning border border-warning-border'
      default:
        return 'bg-surface-alt text-text-muted border border-border-light'
    }
  }

  const completionPercent = data && data.teamPerformance.totalSubmissions > 0
    ? Math.round((data.teamPerformance.approved / data.teamPerformance.totalSubmissions) * 100)
    : 0

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        <span className="ml-2 text-sm text-text-muted">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-background min-h-full">
        <div className="bg-surface border border-border p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-2" />
          <p className="text-sm font-medium text-text">{error}</p>
          <button onClick={fetchDashboard} className="mt-3 text-xs text-primary hover:text-primary-hover font-medium">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 bg-background min-h-full">
      {/* Header */}
      <div className="bg-primary border-b border-primary-hover px-5 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Supervisor Dashboard</h1>
            <p className="text-xs text-white/70 mt-0.5">Team overview and management center</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/supervisor/activity"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <ScrollText className="w-3.5 h-3.5" />
              Activity
            </Link>
            <Link
              href="/supervisor/profile"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              Profile
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Employees', value: data?.totalEmployees ?? 0, icon: Users, color: 'text-primary' },
          { label: 'Active Employees', value: data?.activeEmployees ?? 0, icon: CheckCircle2, color: 'text-success' },
          { label: 'Pending Approvals', value: data?.pendingApprovals ?? 0, icon: ClipboardCheck, color: 'text-warning' },
          { label: 'Assigned Projects', value: data?.assignedProjects ?? 0, icon: FolderOpen, color: 'text-info' },
          { label: 'Departments', value: data?.departments ?? 0, icon: Building2, color: 'text-primary' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`bg-surface border border-border p-4 hover:border-primary transition-colors duration-200 hover-lift animate-fade-in stagger-${index + 1}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-text-muted font-medium">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-text tabular-nums">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Today's Activity + Team Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Today's Activity */}
        <div className="lg:col-span-2 bg-surface border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              Today&apos;s Team Activity
            </h2>
            <Link href="/supervisor/activity" className="text-xs text-primary hover:text-primary-hover font-medium">
              View All
            </Link>
          </div>
          <div className="divide-y divide-border-light max-h-80 overflow-y-auto">
            {!data?.todayActivity || data.todayActivity.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-text-muted">No activity today yet</div>
            ) : (
              data.todayActivity.map(item => (
                <div key={item.id} className="px-5 py-3 hover:bg-background transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text truncate">{item.checkpointTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>{item.moduleName}</span>
                        <span>·</span>
                        <span>{item.userName}</span>
                        <span>·</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium whitespace-nowrap ${statusBadge(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Performance */}
        <div className="bg-surface border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Activity className="w-4 h-4 text-info" />
              Team Performance
            </h2>
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Approval Rate</span>
              <span className="text-sm font-bold text-primary tabular-nums">{completionPercent}%</span>
            </div>
            <div className="w-full bg-surface-alt h-2.5 overflow-hidden rounded-full progress-bar">
              <div
                className="bg-primary h-full transition-all duration-500 rounded-full"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Total Submissions</span>
              <span className="text-sm font-bold text-text tabular-nums">{data?.teamPerformance.totalSubmissions ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-success rounded-full" />
                <span className="text-xs text-text-secondary">Approved</span>
              </div>
              <span className="text-sm font-bold text-success tabular-nums">{data?.teamPerformance.approved ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-danger rounded-full" />
                <span className="text-xs text-text-secondary">Rejected</span>
              </div>
              <span className="text-sm font-bold text-danger tabular-nums">{data?.teamPerformance.rejected ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-warning rounded-full" />
                <span className="text-xs text-text-secondary">Pending Review</span>
              </div>
              <span className="text-sm font-bold text-warning tabular-nums">{data?.teamPerformance.pending ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Approvals + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Recent Approvals */}
        <div className="lg:col-span-2 bg-surface border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              Recent Approval Requests
            </h2>
            <Link href="/supervisor/approvals" className="text-xs text-primary hover:text-primary-hover font-medium">
              View All
            </Link>
          </div>
          <div className="divide-y divide-border-light max-h-80 overflow-y-auto">
            {!data?.recentApprovals || data.recentApprovals.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-text-muted">No pending approvals</div>
            ) : (
              data.recentApprovals.map(item => (
                <div key={item.id} className="px-5 py-3 hover:bg-background transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text truncate">{item.checkpointTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>{item.moduleName}</span>
                        <span>·</span>
                        <span>{item.userName}</span>
                        <span>·</span>
                        <span>{new Date(item.submittedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium whitespace-nowrap ${statusBadge(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-surface border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              Quick Actions
            </h2>
          </div>
          <div className="p-3 space-y-1.5">
            {[
              { label: 'View Team', href: '/supervisor/employees', icon: Users, desc: 'Manage your team members' },
              { label: 'Review Approvals', href: '/supervisor/approvals', icon: ClipboardCheck, desc: 'Approve or reject submissions' },
              { label: 'View Reports', href: '/supervisor/reports', icon: FileBarChart, desc: 'Team performance analytics' },
              { label: 'Departments', href: '/supervisor/departments', icon: Building2, desc: 'Manage departments' },
              { label: 'Projects', href: '/supervisor/projects', icon: FolderOpen, desc: 'Manage assigned projects' },
              { label: 'Activity Log', href: '/supervisor/activity', icon: Activity, desc: 'View action history' },
            ].map(action => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-primary-light hover:border-primary border border-transparent transition-colors duration-150 group rounded"
              >
                <div className="w-8 h-8 bg-surface-alt group-hover:bg-primary-light flex items-center justify-center flex-shrink-0 transition-colors">
                  <action.icon className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text group-hover:text-primary transition-colors">{action.label}</p>
                  <p className="text-xs text-text-muted truncate">{action.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-primary ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
