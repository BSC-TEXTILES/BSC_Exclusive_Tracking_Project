import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { get } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import { fmtDateTime } from '../../lib/format'

interface ActivityRow {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: unknown
  ip_address: string | null
  created_at: string
}

export default function SupervisorActivity() {
  const [data, setData] = useState<{ items: ActivityRow[]; total: number; page: number; pageSize: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const load = () => {
    setLoading(true)
    setError('')
    get<{ items: ActivityRow[]; total: number; page: number; pageSize: number }>(`/api/supervisor/activity?page=${page}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [page])

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader title="Activity Log" subtitle="Everything you have done in the system" />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Time</th><th>Action</th><th>Entity</th><th>Details</th></tr>
          </thead>
          <tbody>
            {(data?.items || []).map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs text-text-secondary">{fmtDateTime(a.created_at)}</td>
                <td>
                  <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary-deep text-[10px] font-bold">{a.action}</span>
                </td>
                <td className="text-xs text-text-secondary">{a.entity_type}{a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ''}</td>
                <td className="text-xs text-text-muted max-w-[320px] truncate">{a.details ? JSON.stringify(a.details) : '—'}</td>
              </tr>
            ))}
            {(data?.items || []).length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-text-muted flex items-center justify-center gap-2"><Activity className="w-4 h-4" /> No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted mt-3">
        <span>{data?.total || 0} entries</span>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn btn-outline btn-sm" disabled={(data?.page || 1) * (data?.pageSize || 25) >= (data?.total || 0)} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  )
}
