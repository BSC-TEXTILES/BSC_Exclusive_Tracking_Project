import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Paperclip, Clock } from 'lucide-react'
import { get } from '../lib/api'
import { Spinner, ErrorState, PageHeader } from '../components/States'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { complianceLabel, accuracyLabel, fmtDateTime } from '../lib/format'

interface DayBucket {
  date: string
  total: number
  completed: number
  approved: number
  submitted: number
  rejected: number
  draft: number
  pending: number
}

interface CalendarItem {
  id: string
  date: string
  checkpoint_title: string
  module_name: string
  module_slug: string
  status: string
  submitted_at: string | null
  approved_at: string | null
  rejected_at: string | null
  review_comment: string | null
  compliance_status: string | null
  accuracy_status: string | null
  comments: string | null
  corrective_action: string | null
  evidence_count: number
}

interface CalendarData {
  year: number
  month: number
  days: DayBucket[]
  itemsByDate: Record<string, CalendarItem[]>
  today: string
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<CalendarData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError('')
    get<CalendarData>(`/api/calendar?year=${year}&month=${month}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [year, month])

  const prev = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) } else setMonth(month - 1)
  }
  const next = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) } else setMonth(month + 1)
  }

  const buckets = useMemo(() => {
    const map = new Map<string, DayBucket>()
    ;(data?.days || []).forEach((d) => map.set(d.date, d))
    return map
  }, [data])

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const startOffset = first.getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const out: (DayBucket | null)[] = []
    for (let i = 0; i < startOffset; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      out.push(buckets.get(key) || { date: key, total: 0, completed: 0, approved: 0, submitted: 0, rejected: 0, draft: 0, pending: 0 })
    }
    return out
  }, [year, month, buckets])

  const selectedItems = selected ? data?.itemsByDate[selected] || [] : []

  return (
    <div>
      <PageHeader
        title="Compliance Calendar"
        subtitle="Your submissions across the month at a glance"
        actions={
          <div className="flex items-center gap-1.5">
            <button onClick={prev} className="bg-white/15 hover:bg-white/25 text-white p-1.5 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-white text-sm font-bold w-44 text-center">{MONTH_NAMES[month - 1]} {year}</span>
            <button onClick={next} className="bg-white/15 hover:bg-white/25 text-white p-1.5 rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        }
      />

      {loading ? <Spinner text="Loading calendar..." /> : error || !data ? <ErrorState message={error || 'Failed to load'} onRetry={load} /> : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface-alt">
            {DAY_NAMES.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-[11px] font-bold text-text-muted uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) =>
              cell === null ? (
                <div key={`x${i}`} className="min-h-[96px] border-b border-r border-border-light bg-surface-alt/50" />
              ) : (
                <button
                  key={cell.date}
                  onClick={() => cell.total > 0 && setSelected(cell.date)}
                  className={`min-h-[96px] border-b border-r border-border-light p-1.5 text-left transition-colors ${
                    cell.date === data.today ? 'bg-primary-faint' : 'hover:bg-primary-faint/60'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                    cell.date === data.today ? 'bg-primary text-white' : 'text-text-secondary'
                  }`}>
                    {parseInt(cell.date.slice(8), 10)}
                  </span>
                  {cell.total > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {cell.approved > 0 && <span className="px-1.5 py-0.5 rounded bg-success-bg text-success text-[9px] font-bold">{cell.approved} ✓</span>}
                      {cell.submitted > 0 && <span className="px-1.5 py-0.5 rounded bg-info-bg text-info text-[9px] font-bold">{cell.submitted} ⏱</span>}
                      {cell.rejected > 0 && <span className="px-1.5 py-0.5 rounded bg-danger-bg text-danger text-[9px] font-bold">{cell.rejected} ✗</span>}
                      {cell.draft > 0 && <span className="px-1.5 py-0.5 rounded bg-warning-bg text-warning text-[9px] font-bold">{cell.draft} ✎</span>}
                    </div>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Submissions — ${selected ? new Date(selected).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''}`} wide>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">Nothing recorded on this day.</p>
        ) : (
          <div className="space-y-3">
            {selectedItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-text">{item.checkpoint_title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{item.module_name}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-xs text-text-secondary">
                  <span>Compliance: <b className="text-text">{complianceLabel(item.compliance_status)}</b></span>
                  <span>Accuracy: <b className="text-text">{accuracyLabel(item.accuracy_status)}</b></span>
                  {item.submitted_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Submitted {fmtDateTime(item.submitted_at)}</span>}
                  {item.approved_at && <span className="text-success font-semibold">Approved {fmtDateTime(item.approved_at)}</span>}
                  {item.rejected_at && <span className="text-danger font-semibold">Rejected {fmtDateTime(item.rejected_at)}</span>}
                  {item.evidence_count > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {item.evidence_count} evidence file(s)</span>}
                </div>
                {item.comments && <p className="mt-2.5 text-xs text-text-secondary bg-surface-alt rounded-lg px-3 py-2">{item.comments}</p>}
                {item.review_comment && <p className="mt-2 text-xs text-info bg-info-bg rounded-lg px-3 py-2">Review: {item.review_comment}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
