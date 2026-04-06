import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

const WINDOW_HOURS = 6
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000

interface ConfirmCountdownProps {
  submittedAt: string
}

function getTimeLeft(submittedAt: string): number {
  const deadline = new Date(submittedAt).getTime() + WINDOW_MS
  return Math.max(0, deadline - Date.now())
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'Tiempo agotado'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

export function ConfirmCountdown({ submittedAt }: ConfirmCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(submittedAt))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(submittedAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [submittedAt])

  const progress = Math.min(1, timeLeft / WINDOW_MS)
  const isUrgent = timeLeft < 60 * 60 * 1000 // < 1 hour
  const expired = timeLeft === 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock
          size={16}
          aria-hidden="true"
          className={expired ? 'text-trust-low' : isUrgent ? 'text-trust-medium' : 'text-text-secondary'}
        />
        <span className="text-sm font-medium text-text-secondary">
          Tiempo para confirmar
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 bg-bg-input rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Tiempo restante"
      >
        <div
          className={[
            'h-full rounded-full transition-all duration-1000',
            expired
              ? 'bg-trust-low w-0'
              : isUrgent
              ? 'bg-trust-medium'
              : 'bg-padel-green',
          ].join(' ')}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <p
        className={[
          'text-xl font-bold tabular-nums',
          expired ? 'text-trust-low' : isUrgent ? 'text-trust-medium' : 'text-text-primary',
        ].join(' ')}
        aria-live="polite"
      >
        {formatTimeLeft(timeLeft)}
      </p>

      {expired && (
        <p className="text-xs text-text-secondary">
          La ventana de confirmación venció — el resultado se confirmó automáticamente.
        </p>
      )}

      {!expired && (
        <p className="text-xs text-text-secondary">
          Si no confirmás ni disputás dentro de este tiempo, el resultado se confirma automáticamente.
        </p>
      )}
    </div>
  )
}
