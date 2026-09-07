import { useEffect, useState } from 'react'
import { Building2, Users, Star } from 'lucide-react'
import { get } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'

interface Dept {
  id: string
  name: string
  code: string
  description: string | null
  is_primary: boolean
  assigned: boolean
  employee_count: number
}

export default function SupervisorDepartments() {
  const [items, setItems] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ departments: Dept[] }>('/api/supervisor/departments')
      .then((d) => setItems(d.departments))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [])

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  const assigned = items.filter((d) => d.assigned)

  return (
    <div>
      <PageHeader title="Departments" subtitle="Departments you supervise" />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {assigned.map((d) => (
          <div key={d.id} className="card p-5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-primary-light text-primary-deep flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              {d.is_primary && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-bg text-warning text-[10px] font-bold">
                  <Star className="w-3 h-3" /> PRIMARY
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-text mt-3">{d.name}</h3>
            <p className="text-[11px] text-text-muted font-mono mt-0.5">{d.code}</p>
            <p className="text-xs text-text-secondary mt-1.5 line-clamp-2 min-h-[2rem]">{d.description || '—'}</p>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-text-secondary">
              <Users className="w-3.5 h-3.5 text-primary" />
              <b>{d.employee_count}</b> team member{d.employee_count === 1 ? '' : 's'}
            </div>
          </div>
        ))}
        {assigned.length === 0 && (
          <div className="card p-10 text-center text-sm text-text-muted col-span-full">
            No departments are assigned to you yet. An administrator can assign them.
          </div>
        )}
      </div>
    </div>
  )
}
