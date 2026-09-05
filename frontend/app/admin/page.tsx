import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  ClipboardCheck,
  FileCheck,
  Building2,
  Layers,
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Activity,
  CalendarDays,
  FileBarChart,
  ScrollText,
  Settings,
  UserPlus,
  FolderOpen,
  Eye,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const user = await getCurrentUser()

  if (!user || user.role.name !== 'ADMIN') {
    redirect('/dashboard')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    suspendedUsers,
    totalDepartments,
    activeDepartments,
    totalModules,
    activeModules,
    totalCheckpoints,
    activeCheckpoints,
    totalRoles,
    todaySubmissions,
    todayPending,
    todayRejected,
    todayApproved,
    totalSubmissionsAllTime,
    approvedAllTime,
    rejectedAllTime,
    pendingAllTime,
    totalEvidence,
    recentSubmissions,
    overdueAssignments,
    recentUsers,
    departmentStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'INACTIVE' } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.department.count(),
    prisma.department.count({ where: { status: 'ACTIVE' } }),
    prisma.module.count(),
    prisma.module.count({ where: { status: 'ACTIVE' } }),
    prisma.checkpoint.count(),
    prisma.checkpoint.count({ where: { status: 'ACTIVE' } }),
    prisma.role.count(),
    prisma.checkpointSubmission.count({
      where: {
        submissionDate: today,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
    }),
    prisma.checkpointAssignment.count({
      where: {
        assignedDate: today,
        status: 'ACTIVE',
      },
    }),
    prisma.checkpointSubmission.count({
      where: {
        submissionDate: today,
        status: 'REJECTED',
      },
    }),
    prisma.checkpointSubmission.count({
      where: {
        submissionDate: today,
        status: 'APPROVED',
      },
    }),
    prisma.checkpointSubmission.count(),
    prisma.checkpointSubmission.count({ where: { status: 'APPROVED' } }),
    prisma.checkpointSubmission.count({ where: { status: 'REJECTED' } }),
    prisma.checkpointSubmission.count({ where: { status: { in: ['SUBMITTED', 'PENDING'] } } }),
    prisma.evidenceFile.count(),
    prisma.checkpointSubmission.findMany({
      where: {
        submissionDate: today,
      },
      include: {
        user: { select: { fullName: true, employeeCode: true } },
        checkpoint: {
          include: { module: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.checkpointAssignment.count({
      where: {
        assignedDate: { lt: today },
        status: 'ACTIVE',
        submissions: { none: { status: { in: ['SUBMITTED', 'APPROVED'] } } },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { role: true, department: true },
    }),
    prisma.department.findMany({
      where: { status: 'ACTIVE' },
      include: {
        users: { select: { id: true } },
        modules: {
          select: { id: true, checkpoints: { select: { id: true } } },
        },
      },
    }),
  ])

  const completionPercent = todayPending > 0
    ? Math.round((todaySubmissions / todayPending) * 100)
    : 0

  const approvalRate = totalSubmissionsAllTime > 0
    ? Math.round((approvedAllTime / totalSubmissionsAllTime) * 100)
    : 0

  const rejectionRate = totalSubmissionsAllTime > 0
    ? Math.round((rejectedAllTime / totalSubmissionsAllTime) * 100)
    : 0

  const statusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-success-bg text-success border border-success-border'
      case 'SUBMITTED':
        return 'bg-info-bg text-info border border-info-border'
      case 'REJECTED':
        return 'bg-danger-bg text-danger border border-danger-border'
      case 'DRAFT':
        return 'bg-warning-bg text-warning border border-warning-border'
      default:
        return 'bg-surface-alt text-text-muted border border-border-light'
    }
  }

  return (
    <div className="p-4 sm:p-6 bg-background min-h-full">
      {/* Header */}
      <div className="bg-primary border-b border-primary-hover px-5 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
            <p className="text-xs text-white/70 mt-0.5">System overview and management center</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/audit-logs"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <ScrollText className="w-3.5 h-3.5" />
              Audit Logs
            </Link>
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-primary' },
          { label: 'Departments', value: totalDepartments, icon: Building2, color: 'text-info' },
          { label: 'Modules', value: totalModules, icon: Layers, color: 'text-success' },
          { label: 'Checkpoints', value: totalCheckpoints, icon: ClipboardCheck, color: 'text-warning' },
          { label: 'Total Submissions', value: totalSubmissionsAllTime, icon: FileCheck, color: 'text-primary' },
          { label: 'Evidence Files', value: totalEvidence, icon: FolderOpen, color: 'text-info' },
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

      {/* Today's Overview + Approval Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Today's Completion */}
        <div className="bg-surface border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Today&apos;s Overview
            </h2>
            <span className="text-xs text-text-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Completion Rate</span>
              <span className="text-sm font-bold text-primary tabular-nums">{completionPercent}%</span>
            </div>
            <div className="w-full bg-surface-alt h-2.5 overflow-hidden rounded-full progress-bar">
              <div
                className="bg-primary h-full transition-all duration-500 rounded-full"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              {todaySubmissions} of {todayPending} assignments completed
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border-light">
            <div className="text-center">
              <p className="text-lg font-bold text-success tabular-nums">{todayApproved}</p>
              <p className="text-xs text-text-muted">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-info tabular-nums">{todaySubmissions - todayApproved}</p>
              <p className="text-xs text-text-muted">Submitted</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-danger tabular-nums">{todayRejected}</p>
              <p className="text-xs text-text-muted">Rejected</p>
            </div>
          </div>
        </div>

        {/* All-Time Approval Stats */}
        <div className="bg-surface border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              All-Time Stats
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Total Submissions</span>
              <span className="text-sm font-bold text-text tabular-nums">{totalSubmissionsAllTime.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-success rounded-full" />
                <span className="text-xs text-text-secondary">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-success tabular-nums">{approvedAllTime.toLocaleString()}</span>
                <span className="text-xs text-success tabular-nums">({approvalRate}%)</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-danger rounded-full" />
                <span className="text-xs text-text-secondary">Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-danger tabular-nums">{rejectedAllTime.toLocaleString()}</span>
                <span className="text-xs text-danger tabular-nums">({rejectionRate}%)</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-warning rounded-full" />
                <span className="text-xs text-text-secondary">Pending Review</span>
              </div>
              <span className="text-sm font-bold text-warning tabular-nums">{pendingAllTime.toLocaleString()}</span>
            </div>
            {overdueAssignments > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-border-light">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-danger" />
                  <span className="text-xs text-danger font-medium">Overdue Tasks</span>
                </div>
                <span className="text-sm font-bold text-danger tabular-nums">{overdueAssignments}</span>
              </div>
            )}
          </div>
        </div>

        {/* User Status Breakdown */}
        <div className="bg-surface border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              User Breakdown
            </h2>
            <Link href="/admin/users" className="text-xs text-primary hover:text-primary-hover font-medium">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-success rounded-full" />
                <span className="text-xs text-text-secondary">Active</span>
              </div>
              <span className="text-sm font-bold text-success tabular-nums">{activeUsers}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-text-muted rounded-full" />
                <span className="text-xs text-text-secondary">Inactive</span>
              </div>
              <span className="text-sm font-bold text-text-muted tabular-nums">{inactiveUsers}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-danger rounded-full" />
                <span className="text-xs text-text-secondary">Suspended</span>
              </div>
              <span className="text-sm font-bold text-danger tabular-nums">{suspendedUsers}</span>
            </div>
            <div className="pt-2 border-t border-border-light">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Roles Configured</span>
                <span className="text-sm font-bold text-text tabular-nums">{totalRoles}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Active Departments</span>
              <span className="text-sm font-bold text-text tabular-nums">{activeDepartments}/{totalDepartments}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Department Stats + Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Department Performance */}
        <div className="bg-surface border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Department Overview
            </h2>
            <Link href="/admin/departments" className="text-xs text-primary hover:text-primary-hover font-medium">
              Manage
            </Link>
          </div>
          <div className="divide-y divide-border-light max-h-80 overflow-y-auto">
            {departmentStats.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-text-muted">No departments configured</div>
            ) : (
              departmentStats.map(dept => (
                <div key={dept.id} className="px-5 py-3 hover:bg-background transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-text">{dept.name}</span>
                    <span className="text-xs text-text-muted">{dept.users.length} user{dept.users.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>{dept.modules.length} module{dept.modules.length !== 1 ? 's' : ''}</span>
                    <span>{dept.modules.reduce((acc, m) => acc + m.checkpoints.length, 0)} checkpoint{dept.modules.reduce((acc, m) => acc + m.checkpoints.length, 0) !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-surface border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Activity className="w-4 h-4 text-info" />
              Recent Users
            </h2>
            <Link href="/admin/users" className="text-xs text-primary hover:text-primary-hover font-medium">
              View All
            </Link>
          </div>
          <div className="divide-y divide-border-light">
            {recentUsers.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-text-muted">No users found</div>
            ) : (
              recentUsers.map(u => (
                <div key={u.id} className="px-5 py-3 hover:bg-background transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary-light text-primary border border-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      {u.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{u.fullName}</p>
                      <p className="text-xs text-text-muted truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-xs text-text-muted hidden sm:inline">{u.employeeCode}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium ${
                      u.status === 'ACTIVE' ? 'bg-success-bg text-success border border-success-border' :
                      u.status === 'INACTIVE' ? 'bg-surface-alt text-text-muted border border-border-light' :
                      'bg-danger-bg text-danger border border-danger-border'
                    }`}>
                      {u.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Today's Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              Today&apos;s Activity
            </h2>
            <Link href="/admin/submissions" className="text-xs text-primary hover:text-primary-hover font-medium">
              View All
            </Link>
          </div>
          <div className="divide-y divide-border-light max-h-96 overflow-y-auto">
            {recentSubmissions.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-text-muted">No activity today yet</div>
            ) : (
              recentSubmissions.map(sub => (
                <div key={sub.id} className="px-5 py-3 hover:bg-background transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text truncate">{sub.checkpoint.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>{sub.checkpoint.module.name}</span>
                        <span>·</span>
                        <span>{sub.user.fullName}</span>
                        {sub.user.employeeCode && (
                          <>
                            <span>·</span>
                            <span>{sub.user.employeeCode}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium whitespace-nowrap ${statusBadge(sub.status)}`}>
                      {sub.status}
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
              { label: 'Manage Users', href: '/admin/users', icon: UserPlus, desc: 'Add, edit, or deactivate accounts' },
              { label: 'Manage Roles', href: '/admin/roles', icon: Shield, desc: 'Configure permissions and roles' },
              { label: 'Manage Departments', href: '/admin/departments', icon: Building2, desc: 'Organizational structure' },
              { label: 'Manage Modules', href: '/admin/modules', icon: Layers, desc: 'Module configuration' },
              { label: 'Manage Checkpoints', href: '/admin/checkpoints', icon: ClipboardCheck, desc: 'Checkpoint templates' },
              { label: 'Assign Tasks', href: '/admin/assignments', icon: CalendarDays, desc: 'Assign checkpoints to users' },
              { label: 'Review Submissions', href: '/admin/submissions', icon: FileCheck, desc: 'Approve or reject' },
              { label: 'View Reports', href: '/admin/reports', icon: FileBarChart, desc: 'Analytics and export' },
              { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, desc: 'System activity trail' },
              { label: 'Settings', href: '/admin/settings', icon: Settings, desc: 'Application configuration' },
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
