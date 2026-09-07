import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, ArrowUpRight, Eye, Music, FileText, FileSpreadsheet, Image as ImageIcon, Paperclip } from 'lucide-react'
import { get, post, apiUrl } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import { complianceLabel, accuracyLabel, fmtDateTime, fileSize, isAudio, isImage, isPdf, isCsv } from '../../lib/format'

interface Approval {
  id: string
  user_id: string
  user_name: string
  employee_code: string
  checkpoint_title: string
  module_name: string
  submission_date: string
  status: string
  submitted_at: string | null
  compliance_status: string | null
  accuracy_status: string | null
  comments: string | null
  corrective_action: string | null
  evidence_count: number
  approval_status: string | null
  supervisor_comments: string | null
}

interface EvidenceRow { id: string; original_name: string; mime_type: string; file_size: number; created_at: string }

function EvIcon({ mime }: { mime: string }) {
  if (isImage(mime)) return <ImageIcon className="w-4 h-4" />
  if (isPdf(mime)) return <FileText className="w-4 h-4" />
  if (isCsv(mime)) return <FileSpreadsheet className="w-4 h-4" />
  if (isAudio(mime)) return <Music className="w-4 h-4" />
  return <Paperclip className="w-4 h-4" />
}

export default function SupervisorApprovals() {
  const [items, setItems] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Approval | null>(null)
  const [evidence, setEvidence] = useState<EvidenceRow[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ approvals: Approval[] }>(`/api/supervisor/approvals${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then((d) => setItems(d.approvals))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [statusFilter])

  const openDetail = async (a: Approval) => {
    setSelected(a)
    setEvidence([])
    setComment('')
    setMsg('')
    try {
      const d = await get<{ evidence: EvidenceRow[] }>(`/api/admin/evidence?submissionId=${encodeURIComponent(a.id)}`)
      setEvidence(d.evidence)
    } catch { /* ignore */ }
  }

  const act = async (action: 'APPROVE' | 'REJECT' | 'ESCALATE') => {
    if (!selected) return
    if (action === 'REJECT' && !comment.trim()) {
      setMsg('Please add a comment explaining the rejection')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await post(`/api/supervisor/approvals/${selected.id}`, { action, comments: comment.trim() || null })
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
      <PageHeader title="Approvals" subtitle="Review your team's compliance submissions" />

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <select className="input w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All requests</option>
          <option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option>ESCALATED</option>
        </select>
        <span className="text-xs text-text-muted">{items.length} submission(s)</span>
      </div>

      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-primary transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-text">{a.checkpoint_title}</h3>
                <StatusBadge status={a.status} />
                {a.approval_status === 'ESCALATED' && <span className="px-2 py-0.5 rounded-full bg-warning-bg text-warning text-[10px] font-bold">ESCALATED</span>}
              </div>
              <p className="text-xs text-text-muted mt-1">
                {a.user_name} ({a.employee_code}) · {a.module_name} · {new Date(a.submission_date).toLocaleDateString('en-IN')}
                {a.submitted_at && <> · submitted {fmtDateTime(a.submitted_at)}</>}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                {complianceLabel(a.compliance_status)} · {accuracyLabel(a.accuracy_status)}
                {a.evidence_count > 0 && <> · <b className="text-primary">{a.evidence_count}</b> evidence</>}
              </p>
            </div>
            <button className="btn btn-outline btn-sm shrink-0" onClick={() => void openDetail(a)}>
              <Eye className="w-3.5 h-3.5" /> Review
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="card p-10 text-center text-sm text-text-muted">No approval requests found.</div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.user_name} — ${selected.checkpoint_title}` : ''} wide>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
              <span className="font-bold text-text">{selected.module_name}</span> · {new Date(selected.submission_date).toLocaleDateString('en-IN')}
              <StatusBadge status={selected.status} />
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
                <p className="text-xs text-text-muted bg-surface-alt rounded-lg px-3 py-3">No evidence attached.</p>
              ) : (
                <ul className="space-y-2">
                  {evidence.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-alt border border-border">
                      <span className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0"><EvIcon mime={e.mime_type} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-text truncate">{e.original_name}</p>
                        <p className="text-[10px] text-text-muted">{e.mime_type} · {fileSize(e.file_size)}</p>
                      </div>
                      {isAudio(e.mime_type) && <audio controls preload="none" className="h-8 w-36" src={apiUrl(`/api/evidence/${e.id}`)} />}
                      <a href={apiUrl(`/api/evidence/${e.id}`)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Open</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {['SUBMITTED', 'PENDING'].includes(selected.status) && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-bold text-text mb-2">Decision</p>
                {msg && <p className="text-xs text-danger font-semibold mb-2">{msg}</p>}
                <textarea className="input resize-y mb-3" placeholder="Comments (required for rejection)..." value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1" disabled={busy} onClick={() => void act('APPROVE')}><CheckCircle2 className="w-4 h-4" /> Approve</button>
                  <button className="btn btn-danger flex-1" disabled={busy} onClick={() => void act('REJECT')}><XCircle className="w-4 h-4" /> Reject</button>
                  <button className="btn btn-outline" disabled={busy} onClick={() => void act('ESCALATE')}><ArrowUpRight className="w-4 h-4" /> Escalate</button>
                </div>
              </div>
            )}
            {selected.status === 'APPROVED' && selected.supervisor_comments && (
              <p className="text-xs text-success bg-success-bg rounded-lg px-3 py-2.5">Approved — {selected.supervisor_comments}</p>
            )}
            {selected.status === 'REJECTED' && selected.supervisor_comments && (
              <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2.5">Rejected — {selected.supervisor_comments}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
