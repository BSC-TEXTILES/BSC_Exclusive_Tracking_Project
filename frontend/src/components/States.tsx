import { Loader2 } from 'lucide-react'

export function Spinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-text-muted">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <span className="ml-2 text-sm">{text}</span>
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="py-12 text-center">
      {icon && <div className="text-text-muted flex justify-center mb-2">{icon}</div>}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-sm font-medium text-danger">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-outline btn-sm mt-3">
          Retry
        </button>
      )}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
