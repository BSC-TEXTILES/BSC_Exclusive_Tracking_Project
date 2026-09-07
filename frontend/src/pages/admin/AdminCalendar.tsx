import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Paperclip,
  X,
  ExternalLink,
  ShieldAlert,
  Building,
  RotateCcw,
  Sparkles,
  Download
} from 'lucide-react'
import { get } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import StatusBadge from '../../components/StatusBadge'
import { complianceLabel, accuracyLabel, fmtDateTime, fmtTime } from '../../lib/format'

interface DayBucket {
  date: string
  total: number
  completed: number
  approved: number
  submitted: number
  rejected: number
  draft: number
  pending: number
  unique_candidates: number
}

interface EvidenceFile {
  id: string
  original_name: string
  mime_type: string
  file_size: number
  storage_path: string
}

interface CalendarItem {
  id: string
  date: string
  checkpoint_id: string
  checkpoint_title: string
  checkpoint_code: string | null
  module_name: string
  module_slug: string
  status: string
  submitted_at: string | null
  approved_at: string | null
  rejected_at: string | null
  auto_approved: boolean | null
  review_comment: string | null
  reviewer_name: string | null
  compliance_status: string | null
  accuracy_status: string | null
  comments: string | null
  corrective_action: string | null
  candidate_id: string
  candidate_name: string
  candidate_email: string
  candidate_employee_code: string | null
  candidate_role: string | null
  department_name: string | null
  evidence_count: number
  evidence_files: EvidenceFile[]
}

interface AdminCalendarResponse {
  year: number
  month: number
  days: DayBucket[]
  itemsByDate: Record<string, CalendarItem[]>
  totalSubmissions: number
  today: string
}

interface Department {
  id: string
  name: string
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function AdminCalendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<AdminCalendarResponse | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalSearch, setModalSearch] = useState<string>('')

  // Load departments list for filter
  useEffect(() => {
    get<{ departments: Department[] }>('/api/admin/departments')
      .then((res) => setDepartments(res.departments || []))
      .catch(() => undefined)
  }, [])

  // Load calendar items
  const loadCalendar = () => {
    setLoading(true)
    setError('')
    const queryParams = new URLSearchParams({
      year: String(year),
      month: String(month),
    })
    if (selectedDept) queryParams.append('department_id', selectedDept)
    if (selectedStatus) queryParams.append('status', selectedStatus)

    get<AdminCalendarResponse>(`/api/admin/calendar?${queryParams.toString()}`)
      .then((res) => {
        setData(res)
      })
      .catch((err) => setError(err.message || 'Failed to load admin calendar data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCalendar()
  }, [year, month, selectedDept, selectedStatus])

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const goToToday = () => {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }

  // Map of days
  const buckets = useMemo(() => {
    const map = new Map<string, DayBucket>()
    ;(data?.days || []).forEach((d) => map.set(d.date, d))
    return map
  }, [data])

  // Calendar cells for current month
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const startOffset = first.getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const out: (DayBucket | null)[] = []

    for (let i = 0; i < startOffset; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      out.push(
        buckets.get(key) || {
          date: key,
          total: 0,
          completed: 0,
          approved: 0,
          submitted: 0,
          rejected: 0,
          draft: 0,
          pending: 0,
          unique_candidates: 0,
        }
      )
    }
    return out
  }, [year, month, buckets])

  // Aggregate stats for current visible month
  const monthStats = useMemo(() => {
    if (!data?.days) {
      return { total: 0, approved: 0, submitted: 0, rejected: 0, draft: 0, completionRate: 0, candidates: 0 }
    }
    let total = 0
    let approved = 0
    let submitted = 0
    let rejected = 0
    let draft = 0
    const candidateSet = new Set<string>()

    for (const d of data.days) {
      total += d.total
      approved += d.approved
      submitted += d.submitted
      rejected += d.rejected
      draft += d.draft
    }

    if (data.itemsByDate) {
      Object.values(data.itemsByDate).forEach((items) => {
        items.forEach((it) => {
          if (it.candidate_id) candidateSet.add(it.candidate_id)
        })
      })
    }

    const completionRate = total > 0 ? Math.round(((approved + submitted) / total) * 100) : 0

    return {
      total,
      approved,
      submitted,
      rejected,
      draft,
      completionRate,
      candidates: candidateSet.size,
    }
  }, [data])

  // Items for selected date
  const selectedItems = useMemo(() => {
    if (!selectedDate || !data?.itemsByDate) return []
    const items = data.itemsByDate[selectedDate] || []
    if (!modalSearch.trim()) return items
    const q = modalSearch.toLowerCase()
    return items.filter(
      (it) =>
        it.candidate_name?.toLowerCase().includes(q) ||
        it.candidate_email?.toLowerCase().includes(q) ||
        it.candidate_employee_code?.toLowerCase().includes(q) ||
        it.checkpoint_title?.toLowerCase().includes(q) ||
        it.module_name?.toLowerCase().includes(q) ||
        it.department_name?.toLowerCase().includes(q)
    )
  }, [selectedDate, data, modalSearch])

  const selectedDayBucket = selectedDate ? buckets.get(selectedDate) : null

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Admin Compliance Calendar"
        subtitle="Complete company-wide compliance tracking & detailed daily verification across all candidates"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Today
            </button>
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
              <button
                onClick={prevMonth}
                title="Previous Month"
                className="p-1.5 text-white/80 hover:text-white rounded-md hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-white text-xs font-bold px-3 py-1 min-w-[130px] text-center">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button
                onClick={nextMonth}
                title="Next Month"
                className="p-1.5 text-white/80 hover:text-white rounded-md hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={loadCalendar}
              title="Refresh"
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* Top Monthly Metrics Overview Card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-3.5 border-l-4 border-l-primary">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Tracked</div>
          <div className="mt-1 text-2xl font-extrabold text-text">{monthStats.total}</div>
          <div className="mt-0.5 text-[10px] text-text-secondary">Processes recorded</div>
        </div>

        <div className="card p-3.5 border-l-4 border-l-emerald-500">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Process Completed</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {monthStats.completionRate}%
          </div>
          <div className="mt-0.5 text-[10px] text-text-secondary">Approved & submitted</div>
        </div>

        <div className="card p-3.5 border-l-4 border-l-green-500">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Approved</div>
          <div className="mt-1 text-2xl font-extrabold text-green-600 dark:text-green-400">{monthStats.approved}</div>
          <div className="mt-0.5 text-[10px] text-text-secondary">Fully verified</div>
        </div>

        <div className="card p-3.5 border-l-4 border-l-sky-500">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Submitted</div>
          <div className="mt-1 text-2xl font-extrabold text-sky-600 dark:text-sky-400">{monthStats.submitted}</div>
          <div className="mt-0.5 text-[10px] text-text-secondary">Pending review</div>
        </div>

        <div className="card p-3.5 border-l-4 border-l-rose-500">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Rejected</div>
          <div className="mt-1 text-2xl font-extrabold text-rose-600 dark:text-rose-400">{monthStats.rejected}</div>
          <div className="mt-0.5 text-[10px] text-text-secondary">Requires action</div>
        </div>

        <div className="card p-3.5 border-l-4 border-l-amber-500">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Active Candidates</div>
          <div className="mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-400">{monthStats.candidates}</div>
          <div className="mt-0.5 text-[10px] text-text-secondary">Users tracked</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-text-muted shrink-0" />
          <span className="text-xs font-bold text-text uppercase tracking-wider">Filters:</span>
          
          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="input text-xs py-1.5 px-2.5 rounded-lg border-border bg-surface text-text w-full sm:w-48"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input text-xs py-1.5 px-2.5 rounded-lg border-border bg-surface text-text w-full sm:w-40"
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="REJECTED">Rejected</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        <div className="text-xs text-text-muted self-end md:self-center">
          Click any date cell below (e.g. <span className="font-semibold text-primary">6 Sep</span>) to inspect exact timings, candidate data, and process details.
        </div>
      </div>

      {/* Calendar Grid Section */}
      {loading ? (
        <Spinner text="Loading admin compliance calendar..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadCalendar} />
      ) : (
        <div className="card overflow-hidden shadow-sm border border-border">
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 border-b border-border bg-surface-alt">
            {DAY_NAMES.map((d, idx) => (
              <div
                key={d}
                className={`px-2 py-3 text-center text-xs font-bold uppercase tracking-wider ${
                  idx === 0 || idx === 6 ? 'text-rose-500/80 dark:text-rose-400/80' : 'text-text-muted'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
            {cells.map((cell, idx) => {
              if (cell === null) {
                return (
                  <div
                    key={`blank-${idx}`}
                    className="min-h-[110px] sm:min-h-[125px] bg-surface-alt/30"
                  />
                )
              }

              const isToday = cell.date === data?.today
              const isSelected = cell.date === selectedDate
              const dayNum = parseInt(cell.date.slice(8), 10)
              const hasActivity = cell.total > 0
              const completionPercent = cell.total > 0 ? Math.round(((cell.approved + cell.submitted) / cell.total) * 100) : 0

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  className={`group relative min-h-[110px] sm:min-h-[125px] p-2 text-left flex flex-col justify-between transition-all duration-150 focus:outline-none ${
                    isToday
                      ? 'bg-primary/5 hover:bg-primary/10 ring-2 ring-primary/40 ring-inset'
                      : isSelected
                      ? 'bg-primary-faint ring-2 ring-primary ring-inset'
                      : hasActivity
                      ? 'bg-surface hover:bg-surface-alt/80 cursor-pointer'
                      : 'bg-surface hover:bg-surface-alt/50'
                  }`}
                >
                  {/* Cell Top Bar: Date Number & Badges */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-transform group-hover:scale-105 ${
                        isToday
                          ? 'bg-primary text-white shadow-sm'
                          : hasActivity
                          ? 'bg-surface-alt text-text font-extrabold border border-border'
                          : 'text-text-muted'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Unique Candidate Pill if any */}
                    {cell.unique_candidates > 0 && (
                      <span
                        title={`${cell.unique_candidates} candidate(s) tracked on this date`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-alt text-text-secondary border border-border"
                      >
                        <Users className="w-2.5 h-2.5 text-primary" />
                        {cell.unique_candidates}
                      </span>
                    )}
                  </div>

                  {/* Cell Center: Process Completion Visual Bar */}
                  {hasActivity ? (
                    <div className="my-1.5 space-y-1 w-full">
                      <div className="flex items-center justify-between text-[10px] font-medium text-text-secondary">
                        <span className="truncate">{cell.total} tasks</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {completionPercent}%
                        </span>
                      </div>
                      {/* Mini Progress Bar */}
                      <div className="w-full h-1.5 bg-surface-alt rounded-full overflow-hidden border border-border/50">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="my-auto text-[10px] text-text-muted/60 text-center py-2">
                      No events
                    </div>
                  )}

                  {/* Cell Bottom: Breakdown Badges */}
                  {hasActivity ? (
                    <div className="flex flex-wrap gap-1 mt-auto pt-1">
                      {cell.approved > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold border border-emerald-300/40">
                          {cell.approved} ✓
                        </span>
                      )}
                      {cell.submitted > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-[9px] font-bold border border-sky-300/40">
                          {cell.submitted} ⏱
                        </span>
                      )}
                      {cell.rejected > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[9px] font-bold border border-rose-300/40">
                          {cell.rejected} ✗
                        </span>
                      )}
                      {cell.draft > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[9px] font-bold border border-amber-300/40">
                          {cell.draft} ✎
                        </span>
                      )}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DETAILED DATE INSPECTOR MODAL (e.g. For date 6/9)            */}
      {/* ============================================================ */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-border bg-gradient-to-r from-surface to-surface-alt flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider border border-primary/20">
                    Daily Process Audit
                  </span>
                  {selectedDate === data?.today && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                      Today
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-text mt-1">
                  {new Date(selectedDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Detailed inspection of timings, candidates, processes, and verification evidence for date: <b className="text-text font-mono">{selectedDate}</b>
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="self-end sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-alt hover:bg-border text-text font-semibold text-xs border border-border transition-colors focus:outline-none"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>

            {/* Date Summary Metric Strip */}
            {selectedDayBucket && selectedDayBucket.total > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-5 py-3 bg-surface-alt/60 border-b border-border text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted uppercase font-semibold">Total Processes</span>
                  <span className="font-extrabold text-base text-text">{selectedDayBucket.total}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted uppercase font-semibold">Completed %</span>
                  <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                    {Math.round(((selectedDayBucket.approved + selectedDayBucket.submitted) / selectedDayBucket.total) * 100)}%
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted uppercase font-semibold">Approved</span>
                  <span className="font-extrabold text-base text-green-600 dark:text-green-400">
                    {selectedDayBucket.approved}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted uppercase font-semibold">Submitted / Review</span>
                  <span className="font-extrabold text-base text-sky-600 dark:text-sky-400">
                    {selectedDayBucket.submitted}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted uppercase font-semibold">Candidates Tracked</span>
                  <span className="font-extrabold text-base text-amber-600 dark:text-amber-400">
                    {selectedDayBucket.unique_candidates}
                  </span>
                </div>
              </div>
            )}

            {/* Filter Search inside modal */}
            <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-surface">
              <Search className="w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Filter by candidate name, code, department, or checkpoint..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-none text-text placeholder:text-text-muted"
              />
              {modalSearch && (
                <button onClick={() => setModalSearch('')} className="text-text-muted hover:text-text p-1">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Modal Body: List of detailed items */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {selectedItems.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <FileCheck2 className="w-10 h-10 text-text-muted mx-auto opacity-50" />
                  <p className="text-sm font-semibold text-text">
                    {selectedDayBucket?.total === 0
                      ? 'No compliance activity recorded for this date.'
                      : 'No matches found for your filter criteria.'}
                  </p>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    Candidates who submit checkpoints on this day will have their exact timings, answers, and evidence files recorded here automatically.
                  </p>
                </div>
              ) : (
                selectedItems.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-surface-alt/40 p-4 sm:p-5 hover:border-primary/40 transition-colors shadow-xs"
                    >
                      {/* Item Top Row: Process Info + Status */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-border/80">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {item.module_name}
                            </span>
                            {item.checkpoint_code && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-alt text-text-secondary border border-border">
                                {item.checkpoint_code}
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-text leading-snug">
                            {item.checkpoint_title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <StatusBadge status={item.status} />
                        </div>
                      </div>

                      {/* Item Candidate Details */}
                      <div className="mt-3.5 p-3 rounded-xl bg-surface border border-border/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1">
                            <Users className="w-3 h-3 text-primary" /> Candidate
                          </div>
                          <div className="font-bold text-text mt-0.5">{item.candidate_name}</div>
                          <div className="text-[11px] text-text-muted font-mono">{item.candidate_email}</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-text-muted">Employee Code & Role</div>
                          <div className="font-semibold text-text mt-0.5 font-mono">
                            {item.candidate_employee_code || '—'}
                          </div>
                          <div className="text-[11px] text-text-secondary">{item.candidate_role || 'Staff'}</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1">
                            <Building className="w-3 h-3 text-amber-500" /> Department
                          </div>
                          <div className="font-semibold text-text mt-0.5">
                            {item.department_name || 'General Department'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3 text-sky-500" /> Timings Logged
                          </div>
                          <div className="font-semibold text-text mt-0.5 text-[11px]">
                            {item.submitted_at ? (
                              <span>Submitted: <b className="text-sky-600 dark:text-sky-400">{fmtTime(item.submitted_at)}</b></span>
                            ) : (
                              <span className="text-text-muted">Draft / Not Submitted</span>
                            )}
                          </div>
                          {item.approved_at && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Approved: {fmtTime(item.approved_at)} {item.auto_approved ? '(Auto)' : ''}
                            </div>
                          )}
                          {item.rejected_at && (
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                              Rejected: {fmtTime(item.rejected_at)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Process Verification & Answers Details */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-surface border border-border/70">
                          <div className="text-[10px] uppercase font-bold text-text-muted">Compliance Adherence</div>
                          <div className="mt-1 font-semibold text-text flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {complianceLabel(item.compliance_status)}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-surface border border-border/70">
                          <div className="text-[10px] uppercase font-bold text-text-muted">Data Accuracy</div>
                          <div className="mt-1 font-semibold text-text flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                            {accuracyLabel(item.accuracy_status)}
                          </div>
                        </div>
                      </div>

                      {/* Comments & Remarks */}
                      {item.comments && (
                        <div className="mt-3 p-3 rounded-xl bg-surface border border-border/70 text-xs">
                          <div className="text-[10px] uppercase font-bold text-text-muted mb-1">
                            Candidate Remarks / Comments
                          </div>
                          <p className="text-text-secondary leading-relaxed">{item.comments}</p>
                        </div>
                      )}

                      {/* Corrective Actions */}
                      {item.corrective_action && (
                        <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                          <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" /> Corrective Action Specified
                          </div>
                          <p className="text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                            {item.corrective_action}
                          </p>
                        </div>
                      )}

                      {/* Review Details & Supervisor Remarks */}
                      {(item.review_comment || item.reviewer_name) && (
                        <div className="mt-2.5 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs">
                          <div className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 mb-1">
                            Reviewer Notes {item.reviewer_name ? `by ${item.reviewer_name}` : ''}
                          </div>
                          <p className="text-sky-900 dark:text-sky-200 leading-relaxed">
                            {item.review_comment || 'Reviewed without comment.'}
                          </p>
                        </div>
                      )}

                      {/* Evidence Files Attached */}
                      {item.evidence_files && item.evidence_files.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/80">
                          <div className="text-[10px] uppercase font-bold text-text-muted mb-2 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-primary" />
                            Evidence Files Attached ({item.evidence_files.length})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.evidence_files.map((file) => (
                              <a
                                key={file.id}
                                href={`/api/evidence/${file.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-primary text-text text-xs transition-colors group"
                              >
                                <Download className="w-3 h-3 text-primary group-hover:scale-110 transition-transform" />
                                <span className="font-medium max-w-[200px] truncate">{file.original_name}</span>
                                <span className="text-[10px] text-text-muted">
                                  ({Math.round(file.file_size / 1024)} KB)
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-surface-alt flex items-center justify-between">
              <div className="text-xs text-text-muted">
                Showing <b className="text-text">{selectedItems.length}</b> process item(s) for {selectedDate}
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="btn-primary text-xs px-5 py-2 rounded-xl"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
