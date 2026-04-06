import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RefreshCw, AlertOctagon } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

// ─── ErrorBoundary class component ───────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-dvh bg-bg-dark flex items-center justify-center px-6">
          <div className="w-full max-w-[480px] flex flex-col items-center gap-6 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-trust-low/10 border border-trust-low/20">
              <AlertOctagon size={28} className="text-trust-low" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-text-primary">Algo salió mal</h1>
              <p className="text-sm text-text-secondary">
                Ocurrió un error inesperado. Podés reintentar o recargar la aplicación.
              </p>
              {this.state.error && (
                <p className="text-xs text-text-secondary/60 font-mono bg-bg-card rounded-lg px-3 py-2 text-left break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl
                           bg-padel-green text-bg-dark font-semibold text-sm
                           hover:bg-padel-green-dark active:scale-95 transition-all
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg-dark"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Reintentar
              </button>

              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl
                           bg-transparent border border-border text-text-secondary text-sm font-medium
                           hover:text-text-primary hover:border-border/80 transition-colors
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg-dark"
              >
                Recargar aplicación
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
