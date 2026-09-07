import type { LucideIcon } from 'lucide-react'

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  hint,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  hint?: string
}) {
  const tones: Record<string, string> = {
    primary: 'text-primary bg-primary-light',
    success: 'text-success bg-success-bg',
    warning: 'text-warning bg-warning-bg',
    danger: 'text-danger bg-danger-bg',
    info: 'text-info bg-info-bg',
  }
  return (
    <div className="card p-4 hover:border-primary transition-colors duration-200 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="text-2xl font-bold text-text tabular-nums mt-1.5">{value}</p>
      {hint && <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>}
    </div>
  )
}
