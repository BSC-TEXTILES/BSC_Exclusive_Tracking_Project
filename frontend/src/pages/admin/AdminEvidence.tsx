import { useEffect, useState } from 'react'
import { Search, Trash2, Music, FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon } from 'lucide-react'
import { get, del, apiUrl } from '../../lib/api'
import { Spinner, ErrorState, PageHeader } from '../../components/States'
import StatusBadge from '../../components/StatusBadge'
import { fmtDateTime, fileSize, isAudio, isImage, isPdf, isCsv } from '../../lib/format'

interface EvidenceRow {
  id: string
  original_name: string
  mime_type: string
  file_size: number
  created_at: string
  user_name: string
  checkpoint_title: string
  module_name: string
  submission_status: string
}

function TypeIcon({ mime }: { mime: string }) {
  if (isImage(mime)) return <ImageIcon className="w-4 h-4" />
  if (isPdf(mime)) return <FileText className="w-4 h-4" />
  if (isCsv(mime)) return <FileSpreadsheet className="w-4 h-4" />
  if (isAudio(mime)) return <Music className="w-4 h-4" />
  return <FileIcon className="w-4 h-4" />
}

export default function AdminEvidence() {
  const [items, setItems] = useState<EvidenceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    get<{ evidence: EvidenceRow[] }>(`/api/admin/evidence${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then((d) => setItems(d.evidence))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [search])

  const remove = async (id: string) => {
    if (!window.confirm('Delete this evidence file? The file will be removed from storage.')) return
    try {
      await del(`/api/admin/evidence/${id}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const typeStats = items.reduce<Record<string, number>>((acc, e) => {
    const t = isImage(e.mime_type) ? 'Images' : isPdf(e.mime_type) ? 'PDF' : isCsv(e.mime_type) ? 'CSV' : isAudio(e.mime_type) ? 'Audio' : 'Other'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader title="Evidence Files" subtitle="All uploaded evidence across the system" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {Object.entries(typeStats).map(([t, c]) => (
          <div key={t} className="card p-4 text-center">
            <p className="text-xl font-extrabold text-primary tabular-nums">{c}</p>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mt-0.5">{t}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search file or user..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>File</th><th>Type</th><th>Size</th><th>Uploaded By</th><th>Checkpoint</th><th>Submission</th><th>Uploaded</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td className="max-w-[220px]">
                  <p className="font-semibold text-text truncate">{e.original_name}</p>
                </td>
                <td>
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <TypeIcon mime={e.mime_type} /> {e.mime_type.split('/')[0]}
                  </span>
                </td>
                <td>{fileSize(e.file_size)}</td>
                <td>{e.user_name}</td>
                <td className="max-w-[180px] truncate">{e.checkpoint_title}</td>
                <td><StatusBadge status={e.submission_status} /></td>
                <td className="whitespace-nowrap text-xs text-text-secondary">{fmtDateTime(e.created_at)}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <a href={apiUrl(`/api/evidence/${e.id}`)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Open</a>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(e.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-text-muted">No evidence files found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
