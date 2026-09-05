'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  FileText,
  AlertCircle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { LiveDateTime } from '@/components/ui/live-date-time'

interface UserProfile {
  id: string
  employeeCode: string
  fullName: string
  email: string
  phone: string | null
  role: string
  department: string | null
  status: string
  lastLoginAt: string | null
  createdAt: string
}

interface UserStats {
  totalSubmissions: number
  approvedCount: number
  rejectedCount: number
  pendingCount: number
  draftCount: number
  thisWeekSubmissions: number
  thisMonthSubmissions: number
  approvalRate: number
}

interface ProfileData {
  user: UserProfile
  stats: UserStats
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border p-5">
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-surface-alt w-32" />
        <div className="space-y-2.5">
          <div className="h-3 bg-surface-alt w-full" />
          <div className="h-3 bg-surface-alt w-3/4" />
          <div className="h-3 bg-surface-alt w-1/2" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="bg-surface border border-border p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-base font-semibold text-text">{value}</p>
          <p className="text-[11px] text-text-muted">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/profile')
      .then(res => {
        if (res.status === 401) {
          window.location.replace('/login')
          return
        }
        return res.json()
      })
      .then(result => {
        if (!result) return
        if (result.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.message || 'Failed to load profile')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to connect to server')
        setLoading(false)
      })
  }, [])

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    })
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface-alt w-32" />
          <div className="h-3 bg-surface-alt w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div>
              <SkeletonCard />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-base sm:text-lg font-semibold text-text mb-4">Profile</h1>
        <div className="bg-surface border border-border p-5 text-center">
          <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
          <p className="text-danger text-sm">{error || 'Failed to load profile'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { user, stats } = data

  const userInitial = user.fullName
    ? user.fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg font-semibold text-text">User Profile</h1>
          <p className="text-xs text-text-muted mt-0.5">View and manage your account details and operational track record</p>
        </div>
        <LiveDateTime
          showSeconds={false}
          dateFormat="compact"
          timeFormat="12h"
          dateClassName="text-sm font-medium text-text"
          timeClassName="text-xs text-text-muted font-mono"
        />
      </div>

      {/* Profile Header */}
      <div className="bg-surface border border-border p-5 animate-scale-in">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary text-white font-semibold text-lg flex items-center justify-center flex-shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text">{user.fullName}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-primary text-white">
                {user.role}
              </span>
              {user.department && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-surface-alt text-text-secondary border border-border">
                  {user.department}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-1.5">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-border p-4 text-center">
          <p className="text-lg font-semibold text-text">{stats.totalSubmissions}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Total Submissions</p>
        </div>
        <div className="bg-surface border border-border p-4 text-center">
          <p className="text-lg font-semibold text-text">{stats.approvalRate}%</p>
          <p className="text-[11px] text-text-muted mt-0.5">Approval Rate</p>
        </div>
        <div className="bg-surface border border-border p-4 text-center">
          <p className="text-lg font-semibold text-text">{stats.thisWeekSubmissions}</p>
          <p className="text-[11px] text-text-muted mt-0.5">This Week</p>
        </div>
        <div className="bg-surface border border-border p-4 text-center">
          <p className="text-lg font-semibold text-text">{stats.thisMonthSubmissions}</p>
          <p className="text-[11px] text-text-muted mt-0.5">This Month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Personal Information */}
          <div className="bg-surface border border-border p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Full Name</p>
                <p className="text-xs font-medium text-text">{user.fullName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Email</p>
                <p className="text-xs font-medium text-text">{user.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Employee Code</p>
                <p className="text-xs font-medium text-text">{user.employeeCode}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Department</p>
                <p className="text-xs font-medium text-text">{user.department || 'Not assigned'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Role</p>
                <p className="text-xs font-medium text-text">{user.role}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Last Login</p>
                <p className="text-xs font-medium text-text">{formatDate(user.lastLoginAt)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Account Created</p>
                <p className="text-xs font-medium text-text">{formatDate(user.createdAt)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Account Status</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${
                  user.status === 'ACTIVE'
                    ? 'bg-success/10 text-success border border-success/20'
                    : user.status === 'INACTIVE'
                    ? 'bg-surface-alt text-text-secondary border border-border'
                    : 'bg-danger/10 text-danger border border-danger/20'
                }`}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          {/* Submission Stats */}
          <div className="bg-surface border border-border p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Submission Statistics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-surface-alt border border-border">
                <p className="text-lg font-semibold text-text">{stats.totalSubmissions}</p>
                <p className="text-[11px] text-text-muted">Total</p>
              </div>
              <div className="text-center p-3 bg-success/10 border border-success/20">
                <p className="text-lg font-semibold text-success">{stats.approvedCount}</p>
                <p className="text-[11px] text-text-muted">Approved</p>
              </div>
              <div className="text-center p-3 bg-danger/10 border border-danger/20">
                <p className="text-lg font-semibold text-danger">{stats.rejectedCount}</p>
                <p className="text-[11px] text-text-muted">Rejected</p>
              </div>
              <div className="text-center p-3 bg-warning/10 border border-warning/20">
                <p className="text-lg font-semibold text-warning">{stats.pendingCount + stats.draftCount}</p>
                <p className="text-[11px] text-text-muted">Pending</p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-surface-alt border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">Approval Rate</span>
                <span className="text-sm font-semibold text-text">{stats.approvalRate}%</span>
              </div>
              <div className="w-full bg-surface border border-border h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500"
                  style={{ width: `${stats.approvalRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Status Breakdown */}
          <div className="bg-surface border border-border p-5">
            <h3 className="text-xs font-semibold text-text mb-3 uppercase tracking-wider">Status Breakdown</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-success flex-shrink-0" />
                  <span className="text-xs text-text-secondary">Approved</span>
                </div>
                <span className="text-xs font-semibold text-text">{stats.approvedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-warning flex-shrink-0" />
                  <span className="text-xs text-text-secondary">Pending</span>
                </div>
                <span className="text-xs font-semibold text-text">{stats.pendingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary-light flex-shrink-0" />
                  <span className="text-xs text-text-secondary">Draft</span>
                </div>
                <span className="text-xs font-semibold text-text">{stats.draftCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-danger flex-shrink-0" />
                  <span className="text-xs text-text-secondary">Rejected</span>
                </div>
                <span className="text-xs font-semibold text-text">{stats.rejectedCount}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-3">
            <StatCard
              icon={FileText}
              label="This Week"
              value={stats.thisWeekSubmissions}
              color="bg-primary-light/10 text-primary-light border border-primary-light/20"
            />
            <StatCard
              icon={TrendingUp}
              label="This Month"
              value={stats.thisMonthSubmissions}
              color="bg-success/10 text-success border border-success/20"
            />
            <StatCard
              icon={CheckCircle2}
              label="Approval Rate"
              value={`${stats.approvalRate}%`}
              color="bg-success/10 text-success border border-success/20"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
