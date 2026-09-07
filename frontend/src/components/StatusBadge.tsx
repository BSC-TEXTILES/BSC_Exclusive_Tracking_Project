import { statusLabel } from '../lib/format'

const STYLES: Record<string, string> = {
  APPROVED: 'bg-success-bg text-success border-success/20',
  SUBMITTED: 'bg-info-bg text-info border-info/20',
  REJECTED: 'bg-danger-bg text-danger border-danger/20',
  DRAFT: 'bg-warning-bg text-warning border-warning/20',
  PENDING: 'bg-surface-alt text-text-muted border-border',
  NOT_APPLICABLE: 'bg-surface-alt text-text-muted border-border',
  OVERDUE: 'bg-danger-bg text-danger border-danger/20',
  ESCALATED: 'bg-warning-bg text-warning border-warning/20',
}

export default function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status || 'PENDING').toUpperCase()
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap border rounded-full ${STYLES[key] || STYLES.PENDING}`}
    >
      {statusLabel(status)}
    </span>
  )
}
