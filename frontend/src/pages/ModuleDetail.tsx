import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, ListChecks, Paperclip } from 'lucide-react'
import { get } from '../lib/api'
import { Spinner, ErrorState, PageHeader } from '../components/States'
import StatusBadge from '../components/StatusBadge'

interface CheckpointItem {
  id: string
  title: string
  description: string | null
  score: number
  isAccuracyRequired: boolean
  isCorrectiveActionRequired: boolean
  isPhotoRequired: boolean
  displayOrder: number
  status: string
  submissionId: string | null
  evidenceCount: number
  dueDate: string | null
}

interface ModuleData {
  module: { id: string; name: string; slug: string; description: string | null; departmentName: string }
  checkpoints: CheckpointItem[]
}

export default function ModuleDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<ModuleData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError('')
    get<ModuleData>(`/api/modules/${slug}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [slug])

  if (loading) return <Spinner text="Loading module..." />
  if (error || !data) return <ErrorState message={error || 'Module not found'} onRetry={load} />

  const done = data.checkpoints.filter((c) => ['APPROVED', 'SUBMITTED', 'REJECTED'].includes(c.status)).length

  return (
    <div>
      <PageHeader
        title={data.module.name}
        subtitle={`${data.module.departmentName} department · ${done}/${data.checkpoints.length} checkpoints completed today`}
        actions={
          <Link to="/modules" className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> All modules
          </Link>
        }
      />
      {data.module.description && <p className="text-sm text-text-secondary -mt-3 mb-5">{data.module.description}</p>}

      <div className="space-y-3">
        {data.checkpoints.map((c, i) => (
          <div key={c.id} className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary transition-colors">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary-light text-primary-deep font-extrabold flex items-center justify-center text-sm shrink-0">
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-text">{c.title}</h3>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{c.description || 'No description'}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-secondary flex-wrap">
                  <span className="flex items-center gap-1"><ListChecks className="w-3 h-3" /> {c.score} pts</span>
                  {c.isAccuracyRequired && <span className="text-info">Accuracy required</span>}
                  {c.isCorrectiveActionRequired && <span className="text-warning">Corrective action</span>}
                  {c.isPhotoRequired && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> Evidence required</span>}
                  {c.evidenceCount > 0 && <span className="flex items-center gap-1 text-success font-semibold"><CheckCircle2 className="w-3 h-3" /> {c.evidenceCount} file(s)</span>}
                  {c.dueDate && <span>Due {new Date(c.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                </div>
              </div>
            </div>
            <Link
              to={`/checkpoints/${c.id}?module=${data.module.slug}`}
              className="btn btn-primary btn-sm shrink-0 self-start sm:self-center"
            >
              {c.status === 'PENDING' ? 'Start' : c.status === 'DRAFT' ? 'Continue' : 'Open'} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
