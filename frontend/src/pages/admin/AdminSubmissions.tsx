import { useEffect, useState } from 'react'
import { Search, CheckCircle2, XCircle, Eye, ShieldCheck, Paperclip, Music, FileText, FileSpreadsheet, Image as ImageIcon } from 'lucide-react'
import { get, post, apiUrl } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import Pagination from '../../components/Pagination'
import { complianceLabel, accuracyLabel, fmtDateTime, fileSize, isAudio, isImage, isPdf, isCsv } from '../../lib/format'

interface SubmissionRow {
  id: string
  status: string
  submission_date: string
  submitted_at: string | null
  approved_at: string | null
  rejected_at: string | null
  review_comment: string | null
  auto_approved: boolean
  updated_at: string
  user_id: string
  user_name: string
  employee_code: string
  checkpoint_title: string
  module_name: string
  module_slug: string
  department_name: string
  compliance_status: string | null
  accuracy_status: string | null
  comments: string | null
  corrective_action: string | null
  reviewed_by_name: string | null
  evidence_count: number
}

interface EvidenceRow {
  id: string
  original_name: string
  mime_type: string
  file_size: number
  created_at: string
}

function EvidenceBadge({ mime }: { mime: string }) {
  if (isImage(mime)) return <ImageIcon className="w-4 h-4" />
  if (isPdf(mime)) return <FileText className="w-4 h-4" />
  if (isCsv(mime)) return <FileSpreadsheet className="w-4 h-4" />
  if (isAudio(mime)) return <Music className="w-4 h-4" />
  return <Paperclip className="w-4 h-4" />
}

export default function AdminSubmissions() {
  const [data, setData] = useState<{ items: SubmissionRow[]; total: number; page: number; pageSize: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState<SubmissionRow | null>(null)
  const [evidence, setEvidence] = useState<EvidenceRow[]>([])
  const [reviewComment, setReviewComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    if (search) q.set('search', search)
    q.set('page', String(page))
    q.set('pageSize', String(pageSize))
    get<{ items: SubmissionRow[]; total: number; page: number; pageSize: number }>(`/api/admin/submissions?${q.toString()}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setPage(1)
  }, [status, search])

  useEffect(() => { void load() }, [status, search, page, pageSize])

  const openDetail = async (s: SubmissionRow) => {
    setSelected(s)
    setEvidence([])
    setReviewComment('')
    setMsg('')
    try {
      const d = await get<{ evidence: EvidenceRow[] }>(`/api/admin/evidence?submissionId=${encodeURIComponent(s.id)}`)
      setEvidence(d.evidence)
    } catch { /* ignore */ }
  }

  const review = async (action: 'APPROVE' | 'REJECT') => {
    if (!selected) return
    if (action === 'REJECT' && !reviewComment.trim()) {
      setMsg('Please add a review comment before rejecting')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await post(`/api/admin/submissions/${selected.id}/review`, { action, comment: reviewComment.trim() || null })
      setSelected(null)
      await load()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader title="Submissions" subtitle="Review and approve or reject compliance submissions" />

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search user, checkpoint or module..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          <option>SUBMITTED</option><option>APPROVED</option><option>REJECTED</option><option>DRAFT</option><option>PENDING</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>User</th><th>Checkpoint</th><th>Module</th><th>Compliance</th><th>Evidence</th><th>Status</th><th>Reviewed By</th><th className="text-right">Action</th></tr>
          </thead>
          <tbody>
            {(data?.items || []).map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap">{new Date(s.submission_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                <td>
                  <p className="font-semibold text-text">{s.user_name}</p>
                  <p className="text-[11px] text-text-muted">{s.department_name}</p>
                </td>
                <td className="max-w-[220px] truncate">{s.checkpoint_title}</td>
                <td>{s.module_name}</td>
                <td>{complianceLabel(s.compliance_status)}</td>
                <td className="text-center">{s.evidence_count > 0 ? <span className="font-bold text-primary">{s.evidence_count}</span> : '—'}</td>
                <td>
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={s.status} />
                    {s.auto_approved && <span className="flex items-center gap-1 text-[10px] text-info font-bold"><ShieldCheck className="w-3 h-3" /> Auto</span>}
                  </div>
                </td>
                <td className="text-xs text-text-secondary">{s.reviewed_by_name || '—'}</td>
                <td>
                  <div className="flex justify-end">
                    <button className="btn btn-outline btn-sm" onClick={() => void openDetail(s)}><Eye className="w-3.5 h-3.5" /> View</button>
                  </div>
                </td>
              </tr>
            ))}
            {(data?.items || []).length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-text-muted">No submissions found.</td></tr>
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={page}
          totalPages={Math.max(1, Math.ceil((data?.total || 0) / pageSize))}
          totalItems={data?.total || 0}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          itemLabel="submissions"
        />
      </div>

      {/* Detail / review modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.user_name} — ${selected.checkpoint_title}` : ''} wide>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
              <span className="font-bold text-text">{selected.module_name}</span> · {selected.department_name} · {new Date(selected.submission_date).toLocaleDateString('en-IN')}
              <StatusBadge status={selected.status} />
              {selected.auto_approved && <span className="flex items-center gap-1 text-[10px] text-info font-bold"><ShieldCheck className="w-3 h-3" /> Auto-approved</span>}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-alt border border-border p-3.5">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide">Compliance</p>
                <p className="text-sm font-bold text-text mt-1">{complianceLabel(selected.compliance_status)}</p>
              </div>
              <div className="rounded-xl bg-surface-alt border border-border p-3.5">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide">Accuracy</p>
                <p className="text-sm font-bold text-text mt-1">{accuracyLabel(selected.accuracy_status)}</p>
              </div>
            </div>

            {selected.comments && (
              <div className="rounded-xl bg-surface-alt border border-border p-3.5">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide">Comments</p>
                <p className="text-sm text-text mt-1">{selected.comments}</p>
              </div>
            )}
            {selected.corrective_action && (
              <div className="rounded-xl bg-warning-bg border border-warning/20 p-3.5">
                <p className="text-[10px] font-bold text-warning uppercase tracking-wide">Corrective action</p>
                <p className="text-sm text-text mt-1">{selected.corrective_action}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-2">Evidence files</p>
              {evidence.length === 0 ? (
                <p className="text-xs text-text-muted bg-surface-alt rounded-lg px-3 py-3">No evidence files attached.</p>
              ) : (
                <ul className="space-y-2">
                  {evidence.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-alt border border-border">
                      <span className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0"><EvidenceBadge mime={e.mime_type} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-text truncate">{e.original_name}</p>
                        <p className="text-[10px] text-text-muted">{e.mime_type} · {fileSize(e.file_size)}</p>
                      </div>
                      {isAudio(e.mime_type) && <audio controls preload="none" className="h-8 w-40" src={apiUrl(`/api/evidence/${e.id}`)} />}
                      <a href={apiUrl(`/api/evidence/${e.id}`)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Open</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {['SUBMITTED', 'PENDING', 'DRAFT'].includes(selected.status) && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-bold text-text mb-2">Review decision</p>
                {msg && <p className="text-xs text-danger font-semibold mb-2">{msg}</p>}
                <textarea className="input resize-y mb-3" placeholder="Review comment (required for rejection)..." value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1" disabled={busy} onClick={() => void review('APPROVE')}>
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                  <button className="btn btn-danger flex-1" disabled={busy} onClick={() => void review('REJECT')}>
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
                <p className="text-[10px] text-text-muted mt-2">If not reviewed within 1 hour of submission, the system auto-approves.</p>
              </div>
            )}
            {(selected.status === 'APPROVED' || selected.status === 'REJECTED') && selected.review_comment && (
              <div className={`rounded-xl px-3.5 py-3 text-xs ${selected.status === 'APPROVED' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
                <b>Review comment:</b> {selected.review_comment}
                <p className="opacity-80 mt-1">
                  {selected.status === 'APPROVED' ? `Approved ${fmtDateTime(selected.approved_at)}` : `Rejected ${fmtDateTime(selected.rejected_at)}`} by {selected.reviewed_by_name || '—'}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
