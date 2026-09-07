import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, CheckCircle2, ArrowRight, Layers } from 'lucide-react'
import { get } from '../lib/api'
import { Spinner, ErrorState, PageHeader } from '../components/States'

interface ModuleItem {
  id: string
  name: string
  slug: string
  description: string | null
  displayOrder: number
  departmentName: string
  checkpointCount: number
  todayTotal: number
  todayDone: number
}

const ICON_COLORS = ['from-sky-400 to-sky-600', 'from-blue-400 to-blue-600', 'from-cyan-400 to-sky-600', 'from-indigo-400 to-blue-600', 'from-sky-500 to-cyan-600', 'from-blue-500 to-sky-700']

export default function Modules() {
  const [modules, setModules] = useState<ModuleItem[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError('')
    get<ModuleItem[]>('/api/modules')
      .then(setModules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <Spinner text="Loading modules..." />
  if (error || !modules) return <ErrorState message={error || 'Failed to load modules'} onRetry={load} />

  return (
    <div>
      <PageHeader title="Process Modules" subtitle="All compliance modules with today's checkpoint progress" />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {modules.map((m, i) => {
          const pct = m.todayTotal > 0 ? Math.round((m.todayDone / m.todayTotal) * 100) : 0
          return (
            <Link
              key={m.id}
              to={`/modules/${m.slug}`}
              className="card p-5 hover:border-primary hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ICON_COLORS[i % ICON_COLORS.length]} text-white flex items-center justify-center`}>
                  <FolderOpen className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-text mt-3">{m.name}</h3>
              <p className="text-xs text-text-muted mt-1 line-clamp-2 min-h-[2rem]">{m.description || '—'}</p>
              <div className="flex items-center gap-2 mt-3 text-[11px] text-text-secondary">
                <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary-deep font-semibold">{m.departmentName}</span>
                <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {m.checkpointCount} checkpoints</span>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-text-muted">Today&apos;s progress</span>
                  <span className="font-bold text-text tabular-nums">
                    {m.todayDone}/{m.todayTotal}
                  </span>
                </div>
                <div className="w-full bg-surface-alt h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-sky-400 to-sky-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      {modules.length === 0 && (
        <div className="card p-10 text-center">
          <CheckCircle2 className="w-6 h-6 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">No modules available yet.</p>
        </div>
      )}
    </div>
  )
}
