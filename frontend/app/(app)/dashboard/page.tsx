'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'

interface ModuleStats {
  id: string
  name: string
  slug: string
  total: number
  submitted: number
  pending: number
  draft: number
}

interface DashboardData {
  user: {
    fullName: string
    firstName: string
    initials: string
    role: string
  }
  totalCheckpoints: number
  submittedToday: number
  modules: ModuleStats[]
}

interface TodayTask {
  id: string
  checkpointTitle?: string
  title?: string
  moduleName?: string
  module?: string
  status: string
}

function formatShortDate(date: Date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('en-US', { month: 'short' })
  return `${day} ${month}`
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, notifRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/notifications'),
        ])

        if (dashRes.status === 401 || notifRes.status === 401) {
          window.location.replace('/login')
          return
        }

        const dashData = await dashRes.json()
        if (dashData.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (dashData.success) {
          setData(dashData.data)
        } else {
          setError(dashData.message || 'Failed to load dashboard')
        }

        if (notifRes.status === 401) {
          window.location.replace('/login')
          return
        }
        const notifData = await notifRes.json()
        if (notifData.code === 'UNAUTHORIZED') {
          window.location.replace('/login')
          return
        }
        if (notifData.success) {
          const tasks: TodayTask[] = [
            ...(notifData.data.upcoming || []).map((t: TodayTask) => ({
              id: t.id,
              title: t.checkpointTitle || t.title,
              module: t.moduleName || t.module,
              status: 'upcoming',
            })),
            ...(notifData.data.recent || []).map((t: TodayTask) => ({
              id: t.id,
              title: t.checkpointTitle || t.title,
              module: t.moduleName || t.module,
              status: (t.status || 'pending').toLowerCase(),
            })),
          ]
          setTodayTasks(tasks)
        }
      } catch {
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="px-4 py-5 md:px-6 md:py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-28 bg-surface border border-border p-5" />
          <div className="h-4 bg-surface-alt w-32" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-16 bg-surface border border-border" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-5 md:px-6 md:py-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-danger-bg border border-danger-border p-4 text-center">
            <AlertCircle className="w-5 h-5 text-danger mx-auto mb-1.5" />
            <p className="text-danger text-sm">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const progressPercent = data.totalCheckpoints > 0
    ? Math.round((data.submittedToday / data.totalCheckpoints) * 100)
    : 0

  const todayShortStr = formatShortDate()

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 animate-slide-up">
      <div className="max-w-3xl mx-auto">
        {/* Progress card */}
        <div className="bg-surface border border-border p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-text tabular-nums">
                {data.submittedToday} / {data.totalCheckpoints}
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-1">checkpoints submitted today</p>
          </div>
          <span className="inline-block bg-primary text-white text-xs font-medium px-2.5 py-1">
            {todayShortStr}
          </span>
        </div>
        <div className="w-full bg-surface-alt h-2 mt-4 overflow-hidden progress-bar">
          <div
            className="bg-primary h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 animate-fade-in">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Today&apos;s Tasks
            </h2>
          </div>
          <div className="bg-surface border border-border divide-y divide-border-light">
            {todayTasks.slice(0, 8).map(task => (
              <div key={task.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {task.status === 'approved' ? (
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  ) : task.status === 'submitted' ? (
                    <Clock className="w-4 h-4 text-warning flex-shrink-0" />
                  ) : task.status === 'rejected' ? (
                    <XCircle className="w-4 h-4 text-danger flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-border flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-text truncate">{task.checkpointTitle || task.title}</p>
                    <p className="text-xs text-text-secondary">{task.moduleName || task.module}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ml-3 ${
                  task.status === 'approved' ? 'text-success' :
                  task.status === 'submitted' ? 'text-primary' :
                  task.status === 'rejected' ? 'text-danger' :
                  'text-text-secondary'
                }`}>
                  {task.status === 'upcoming' ? 'Pending' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module list */}
      <div className="mb-3 animate-fade-in">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Your Modules
        </h2>
      </div>

      {data.modules.length === 0 ? (
        <div className="bg-surface border border-border p-6 text-center">
          <p className="text-sm text-text-secondary">No modules assigned.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.modules.map((mod, index) => {
            const isCompleted = mod.total > 0 && mod.submitted === mod.total

            return (
              <Link
                key={mod.id}
                href={`/modules/${mod.slug}`}
                className={`block bg-surface border border-border p-4 hover:border-primary-hover transition group hover-lift stagger-${index + 1}`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-4">
                    <h3 className="font-medium text-sm text-text group-hover:text-primary transition">
                      {mod.name}
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {mod.total} checkpoints
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <span className="inline-block bg-success-bg text-success text-xs px-2.5 py-1 font-medium">
                        Done
                      </span>
                    ) : (
                      <span className="inline-block bg-surface-alt text-text-secondary text-xs px-2.5 py-1 font-medium">
                        {mod.pending} pending
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
