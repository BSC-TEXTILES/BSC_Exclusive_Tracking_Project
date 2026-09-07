import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X, Loader2, Download, Trash2, FileText, FileSpreadsheet, Music, ImageIcon, File as FileIcon } from 'lucide-react'
import { post, del, apiUrl } from '../lib/api'
import type { Evidence } from '../lib/types'
import { fileSize, isAudio, isImage, isPdf, isCsv } from '../lib/format'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/csv,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,audio/x-m4a,audio/aac'

function EvidenceIcon({ mime }: { mime: string }) {
  if (isImage(mime)) return <ImageIcon className="w-4 h-4" />
  if (isPdf(mime)) return <FileText className="w-4 h-4" />
  if (isCsv(mime)) return <FileSpreadsheet className="w-4 h-4" />
  if (isAudio(mime)) return <Music className="w-4 h-4" />
  return <FileIcon className="w-4 h-4" />
}

export default function EvidenceUploader({
  checkpointId,
  submissionId,
  evidence,
  onChange,
  disabled,
}: {
  checkpointId: string
  submissionId: string | null
  evidence: Evidence[]
  onChange: (items: Evidence[]) => void
  disabled?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return
      setError('')
      setUploading(true)
      const added: Evidence[] = []
      try {
        for (const file of list) {
          const fd = new FormData()
          fd.append('file', file)
          if (submissionId) fd.append('submissionId', submissionId)
          else fd.append('checkpointId', checkpointId)
          const uploaded = await post<Evidence & { url: string }>('/api/evidence', fd)
          added.push({ ...uploaded, id: uploaded.id, originalName: uploaded.originalName, mimeType: uploaded.mimeType, fileSize: uploaded.fileSize, storagePath: uploaded.url, publicUrl: null, createdAt: uploaded.createdAt })
        }
        onChange([...evidence, ...added])
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [checkpointId, submissionId, evidence, onChange]
  )

  const remove = async (id: string) => {
    try {
      await del(`/api/evidence/${id}`)
      onChange(evidence.filter((e) => e.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const urlFor = (ev: Evidence) =>
    ev.publicUrl || apiUrl(`/api/evidence/${ev.id}`)

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
      />
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!disabled) void uploadFiles(e.dataTransfer.files) }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${dragOver ? 'border-primary bg-primary-faint' : 'border-border hover:border-primary hover:bg-primary-faint/50'}`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-primary text-sm font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
          </div>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto rounded-xl bg-primary-light text-primary flex items-center justify-center mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-text">
              {disabled ? 'Evidence locked' : 'Click or drop files to upload evidence'}
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              Images (JPG, PNG, WEBP, GIF) · PDF · CSV · Audio (MP3, WAV, M4A, OGG, AAC) — up to 25 MB each
            </p>
          </>
        )}
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}

      {evidence.length > 0 && (
        <ul className="mt-3 space-y-2">
          {evidence.map((ev) => (
            <li key={ev.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-alt border border-border">
              <span className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0">
                <EvidenceIcon mime={ev.mimeType} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text truncate">{ev.originalName}</p>
                <p className="text-[10px] text-text-muted">{ev.mimeType} · {fileSize(ev.fileSize)}</p>
              </div>
              {isAudio(ev.mimeType) && (
                <audio controls preload="none" className="h-8 w-40 sm:w-56" src={urlFor(ev)} />
              )}
              <a
                href={urlFor(ev)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
                title="Open file"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              {!disabled && (
                <button onClick={() => void remove(ev.id)} className="btn btn-ghost btn-sm text-danger" title="Remove">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
