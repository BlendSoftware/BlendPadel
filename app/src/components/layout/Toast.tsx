import { useEffect, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import type { Toast, ToastType } from '@/stores/toast-store'

// ─── Config per type ──────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { icon: React.ReactNode; barClass: string; iconClass: string; label: string }
> = {
  success: {
    icon: <CheckCircle size={18} aria-hidden="true" />,
    barClass: 'bg-padel-green',
    iconClass: 'text-padel-green',
    label: 'Éxito',
  },
  error: {
    icon: <XCircle size={18} aria-hidden="true" />,
    barClass: 'bg-trust-low',
    iconClass: 'text-trust-low',
    label: 'Error',
  },
  warning: {
    icon: <AlertTriangle size={18} aria-hidden="true" />,
    barClass: 'bg-trust-medium',
    iconClass: 'text-trust-medium',
    label: 'Advertencia',
  },
  info: {
    icon: <Info size={18} aria-hidden="true" />,
    barClass: 'bg-sky-500',
    iconClass: 'text-sky-400',
    label: 'Info',
  },
}

// ─── Single toast item ────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = TOAST_CONFIG[toast.type]
  const duration = toast.duration ?? 5000
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration)

    // Animate progress bar
    if (progressRef.current) {
      progressRef.current.style.transition = `width ${duration}ms linear`
      // Trigger reflow so transition starts from 100%
      void progressRef.current.offsetWidth
      progressRef.current.style.width = '0%'
    }

    return () => clearTimeout(timer)
  }, [toast.id, duration, onDismiss])

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label={`${config.label}: ${toast.message}`}
      className="relative overflow-hidden rounded-xl border border-border bg-bg-card shadow-lg
                 animate-[slideDown_200ms_ease-out]"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={config.iconClass}>{config.icon}</span>
        <p className="flex-1 text-sm text-text-primary leading-snug">{toast.message}</p>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 -mt-2
                     text-text-secondary hover:text-text-primary transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
          aria-label="Cerrar notificación"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className={`h-0.5 w-full ${config.barClass}`}
        style={{ width: '100%' }}
        aria-hidden="true"
      />
    </div>
  )
}

// ─── Toast container ──────────────────────────────────────────────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notificaciones"
      className="fixed top-4 left-0 right-0 z-[9999] flex flex-col gap-2 px-4 pointer-events-none"
    >
      <div className="mx-auto w-full max-w-[480px] flex flex-col gap-2 pointer-events-auto">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  )
}
