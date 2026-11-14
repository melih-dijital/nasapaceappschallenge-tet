// FAZ 10 §3.7 — Sayfa/modül düzeyinde hata sınırı (ErrorBoundary): çökme uygulamayı düşürmez.
import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t as translate } from '@/ui/i18n'

interface ErrorBoundaryProps {
  children: ReactNode
  resetKey?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unknown error',
    }
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: null })
    }
  }

  override componentDidCatch(): void {
    // Konsol gürültüsü bırakmadan yalıtılmış durum gösterilir
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: null })
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        role="alert"
        data-testid="module-error-boundary"
        className="mx-auto max-w-xl rounded-xl border border-status-warning/50 bg-status-warning/10 p-6 text-sm"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-status-warning" />
          <div className="space-y-2">
            <h2 className="font-semibold text-foreground">{translate('errorBoundary.title')}</h2>
            <p className="text-xs text-muted-foreground">{translate('errorBoundary.desc')}</p>
            {this.state.errorMessage && (
              <p className="rounded bg-background/70 px-2 py-1 font-mono text-[11px] text-status-warning">
                {this.state.errorMessage}
              </p>
            )}
            <Button type="button" size="sm" variant="outline" onClick={this.handleReset}>
              <RotateCcw aria-hidden="true" className="size-3.5" />
              <span>{translate('errorBoundary.retry')}</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
