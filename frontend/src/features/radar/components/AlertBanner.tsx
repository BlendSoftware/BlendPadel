import { AlertTriangle, X, Clock, MapPin } from 'lucide-react'
import type { RadarAlert } from '@/types/radar'

interface AlertBannerProps {
  alerts: RadarAlert[]
  onDismiss?: () => void
  onAlertClick?: (alert: RadarAlert) => void
}

function minutesUntil(scheduledAt: string): number {
  return Math.max(0, Math.round((new Date(scheduledAt).getTime() - Date.now()) / 60000))
}

export function AlertBanner({ alerts, onDismiss, onAlertClick }: AlertBannerProps) {
  if (alerts.length === 0) return null

  const topAlert = alerts.reduce((prev, curr) =>
    minutesUntil(curr.scheduled_at) < minutesUntil(prev.scheduled_at) ? curr : prev,
  )
  const minsLeft = minutesUntil(topAlert.scheduled_at)
  const title = `Partido de ${topAlert.captain_name}`

  return (
    <div
      className="mx-3 mb-2 rounded-xl border border-rose-500/40 bg-rose-950/80 backdrop-blur-sm animate-in slide-in-from-top-2 duration-300"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2 p-3">
        <div className="flex-shrink-0 mt-0.5">
          <AlertTriangle
            size={16}
            className="text-rose-400 animate-pulse"
            aria-hidden="true"
          />
        </div>

        <button
          className="flex-1 text-left min-h-0 focus-visible:outline-none"
          onClick={() => onAlertClick?.(topAlert)}
          aria-label={`Partido urgente: ${title}`}
        >
          <p className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-0.5">
            Falta uno para cerrar!
          </p>
          <p className="text-sm font-semibold text-text-primary leading-snug">
            {title}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-rose-400">
              <Clock size={11} aria-hidden="true" />
              En {minsLeft} min
            </span>
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <MapPin size={11} aria-hidden="true" />
              {(topAlert.distance_meters / 1000).toFixed(1)} km
            </span>
          </div>
        </button>

        {alerts.length > 1 && (
          <span className="flex-shrink-0 bg-rose-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {alerts.length}
          </span>
        )}

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 flex items-center justify-center min-h-11 min-w-11 -mr-2 -mt-1 text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg"
            aria-label="Cerrar alerta"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
