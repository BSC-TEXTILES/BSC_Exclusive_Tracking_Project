export function statusLabel(status: string | null | undefined): string {
  if (!status || status === 'PENDING') return 'Pending'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export function complianceLabel(v: string | null | undefined): string {
  switch (v) {
    case 'FULLY_FOLLOWED':
      return 'Fully followed'
    case 'PARTIALLY_FOLLOWED':
      return 'Partially followed'
    case 'NOT_FOLLOWED':
      return 'Not followed'
    case 'NO_TRANSACTION':
      return 'No transaction'
    case 'YET_TO_IMPLEMENT':
      return 'Yet to implement'
    default:
      return v || '—'
  }
}

export function accuracyLabel(v: string | null | undefined): string {
  switch (v) {
    case 'FULLY_ACCURATE':
      return 'Fully accurate'
    case 'PARTLY_ACCURATE':
      return 'Partly accurate'
    case 'INACCURATE':
      return 'Inaccurate'
    case 'NA':
      return 'N/A'
    default:
      return v || '—'
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return 'never'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/')
}
export function isAudio(mime: string): boolean {
  return mime.startsWith('audio/')
}
export function isPdf(mime: string): boolean {
  return mime === 'application/pdf'
}
export function isCsv(mime: string): boolean {
  return mime === 'text/csv' || mime === 'application/vnd.ms-excel'
}

export function todayStr(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}
