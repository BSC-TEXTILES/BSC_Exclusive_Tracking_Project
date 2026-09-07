import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    const msg = error?.message || ''
    const isChunkError =
      msg.includes('dynamically imported module') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Loading chunk') ||
      msg.includes('Importing a module script failed')

    // Automatically reload once on chunk/module fetch failures
    if (isChunkError && typeof window !== 'undefined') {
      const key = 'eb_auto_reload_' + window.location.pathname
      const last = sessionStorage.getItem(key)
      const now = Date.now()
      if (!last || now - parseInt(last, 10) > 10000) {
        sessionStorage.setItem(key, String(now))
        window.location.reload()
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const msg = this.state.error?.message || ''
      const isChunkError =
        msg.includes('dynamically imported module') ||
        msg.includes('Failed to fetch') ||
        msg.includes('Loading chunk')

      return (
        <div className="min-h-[260px] flex items-center justify-center p-6">
          <div className="text-center max-w-md card p-6 shadow-xl border border-border">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-text mb-1">
              {isChunkError ? 'Module Update Available' : 'Something went wrong'}
            </h3>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              {isChunkError
                ? 'A new update or module synchronization was detected. Please reload to load the latest verified resources.'
                : this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            </p>
            <div className="flex items-center justify-center gap-2.5">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Application
              </button>
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-text bg-surface-alt hover:bg-border px-3.5 py-2 rounded-xl border border-border transition-colors"
              >
                Retry View
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
