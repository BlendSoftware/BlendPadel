import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { useMatchmakingStore } from '@/stores/matchmaking-store'
import type { MatchType } from '../types'

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// Minimum datetime: 30 minutes from now
function minDatetime(): string {
  return toLocalDatetimeValue(new Date(Date.now() + 30 * 60 * 1000))
}

export function CreateFlarePage() {
  const navigate = useNavigate()
  const isLoading = useMatchmakingStore((s) => s.isLoading)
  const error = useMatchmakingStore((s) => s.error)
  const createFlare = useMatchmakingStore((s) => s.createFlare)
  const clearError = useMatchmakingStore((s) => s.clearError)

  const [matchType, setMatchType] = useState<MatchType>('male')
  const [scheduledAt, setScheduledAt] = useState('')
  const [message, setMessage] = useState('')
  const [useLocation, setUseLocation] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [locationError, setLocationError] = useState('')
  const [gettingLocation, setGettingLocation] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ scheduledAt?: string; message?: string }>({})
  // BUG 17 FIX: Only show store error after user has submitted at least once
  const [hasSubmitted, setHasSubmitted] = useState(false)

  // Clear stale errors from previous sessions on mount
  useEffect(() => {
    clearError()
  }, [clearError])

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Tu dispositivo no soporta geolocalización')
      return
    }
    setGettingLocation(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setUseLocation(true)
        setGettingLocation(false)
      },
      () => {
        setLocationError('No se pudo obtener la ubicación. Verificá los permisos.')
        setGettingLocation(false)
      },
    )
  }

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {}
    if (!scheduledAt) {
      errors.scheduledAt = 'La fecha y hora son obligatorias'
    } else if (new Date(scheduledAt) <= new Date()) {
      errors.scheduledAt = 'La fecha debe ser futura'
    }
    if (message.trim().length < 5) {
      errors.message = 'El mensaje debe tener al menos 5 caracteres'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setHasSubmitted(true)
    clearError()
    if (!validate()) return
    try {
      await createFlare({
        scheduled_at: new Date(scheduledAt).toISOString(),
        latitude: lat,
        longitude: lng,
        message: message.trim(),
        match_type: matchType,
      })
      navigate('/matchmaking')
    } catch {
      // error set in store
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Crear desafío" showBack />

      <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-5 pb-8">
        {/* BUG 17 FIX: Only show error after user has submitted */}
        {hasSubmitted && error && (
          <div role="alert" className="bg-trust-low/10 border border-trust-low/30 rounded-xl p-3 text-sm text-trust-low">
            {error}
          </div>
        )}

        {/* Date/time */}
        <div className="flex flex-col gap-1">
          <label htmlFor="scheduled-at" className="text-sm font-medium text-text-secondary">
            Fecha y hora
          </label>
          <input
            id="scheduled-at"
            type="datetime-local"
            min={minDatetime()}
            value={scheduledAt}
            onChange={(e) => {
              setScheduledAt(e.target.value)
              setFieldErrors((prev) => ({ ...prev, scheduledAt: undefined }))
            }}
            aria-invalid={!!fieldErrors.scheduledAt}
            className={[
              'w-full rounded-xl bg-bg-input text-text-primary border transition-colors min-h-11 px-4 py-2.5 text-sm',
              'focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green',
              fieldErrors.scheduledAt ? 'border-trust-low' : 'border-border',
            ].join(' ')}
          />
          {fieldErrors.scheduledAt && (
            <p role="alert" className="text-xs text-trust-low">{fieldErrors.scheduledAt}</p>
          )}
        </div>

        {/* Location */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">Ubicación (opcional)</p>
          {useLocation && lat !== null ? (
            <div className="flex items-center gap-3 bg-bg-input border border-border rounded-xl px-4 py-3">
              <MapPin size={16} className="text-padel-green shrink-0" aria-hidden="true" />
              <span className="text-sm text-text-primary flex-1">
                {lat.toFixed(4)}, {lng?.toFixed(4)}
              </span>
              <button
                type="button"
                onClick={() => { setLat(null); setLng(null); setUseLocation(false) }}
                className="text-xs text-text-secondary hover:text-trust-low transition-colors min-h-11 px-2"
              >
                Quitar
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              loading={gettingLocation}
              onClick={handleGetLocation}
            >
              <MapPin size={16} aria-hidden="true" />
              Usar mi ubicación
            </Button>
          )}
          {locationError && (
            <p role="alert" className="text-xs text-trust-low">{locationError}</p>
          )}
        </div>

        {/* Match type */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">Tipo de partido</p>
          <div className="flex gap-2">
            {([
              { value: 'male', label: 'Masculino' },
              { value: 'female', label: 'Femenino' },
              { value: 'mixed', label: 'Mixto' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMatchType(opt.value)}
                className={[
                  'flex-1 min-h-11 rounded-full text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
                  matchType === opt.value
                    ? 'bg-padel-green text-bg-dark'
                    : 'bg-bg-input text-text-secondary border border-border hover:text-text-primary',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="flex flex-col gap-1">
          <label htmlFor="flare-message" className="text-sm font-medium text-text-secondary">
            Mensaje
          </label>
          <textarea
            id="flare-message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setFieldErrors((prev) => ({ ...prev, message: undefined }))
            }}
            placeholder="¿Qué nivel buscás? ¿Algún club preferido?"
            rows={3}
            maxLength={280}
            aria-invalid={!!fieldErrors.message}
            className={[
              'w-full rounded-xl bg-bg-input text-text-primary placeholder:text-text-secondary border transition-colors px-4 py-3 text-sm resize-none',
              'focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green',
              fieldErrors.message ? 'border-trust-low' : 'border-border',
            ].join(' ')}
          />
          <div className="flex justify-between">
            {fieldErrors.message
              ? <p role="alert" className="text-xs text-trust-low">{fieldErrors.message}</p>
              : <span />
            }
            <p className="text-xs text-text-secondary">{message.length}/280</p>
          </div>
        </div>

        <Button type="submit" fullWidth loading={isLoading} size="lg">
          Publicar desafío
        </Button>
      </form>
    </div>
  )
}
