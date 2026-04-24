import { useState } from 'react'
import { MapPin, Navigation, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { UserLocation } from '@/types/radar'

interface LocationDeniedScreenProps {
  onLocationSet: (loc: UserLocation) => void
  onUseMendoza: () => void
}

// Mendoza default — Ciudad de Mendoza centro.
const MENDOZA: UserLocation = { lat: -33.037, lng: -68.655 }

export function LocationDeniedScreen({ onLocationSet, onUseMendoza }: LocationDeniedScreenProps) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setError('Latitud inválida (debe ser entre -90 y 90)')
      return
    }
    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setError('Longitud inválida (debe ser entre -180 y 180)')
      return
    }
    setError(null)
    onLocationSet({ lat: parsedLat, lng: parsedLng })
  }

  function handleRetryGeo() {
    // Try geolocation again — if denied, won't work, but user may have re-enabled in browser settings
    navigator.geolocation.getCurrentPosition(
      (pos) => onLocationSet({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('Permiso aún denegado. Habilitalo en la configuración del navegador.'),
      { timeout: 8000 },
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 px-6 text-center min-h-64">
      {/* Icon */}
      <div className="h-20 w-20 rounded-full bg-amber-950/40 border border-amber-500/30 flex items-center justify-center">
        <MapPin size={36} className="text-amber-400" aria-hidden="true" />
      </div>

      {/* Explanation */}
      <div>
        <h2 className="text-text-primary font-bold text-lg mb-2">
          Necesitamos tu ubicación
        </h2>
        <p className="text-text-secondary text-sm max-w-sm leading-relaxed">
          Para mostrarte los partidos más cercanos, el Radar necesita saber dónde estás.
          Activá la ubicación en tu navegador o ingresá tus coordenadas manualmente.
        </p>
      </div>

      {/* Retry button */}
      <Button
        variant="primary"
        size="md"
        onClick={handleRetryGeo}
        className="w-full max-w-xs"
      >
        <Navigation size={16} aria-hidden="true" />
        Reintentar con ubicación
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-3 w-full max-w-xs">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-secondary">o ingresá manualmente</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Manual input */}
      <form onSubmit={handleManualSubmit} className="w-full max-w-xs space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="lat-input" className="sr-only">Latitud</label>
            <input
              id="lat-input"
              type="number"
              step="any"
              placeholder="Latitud (ej: -33.35)"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-bg-input border border-border text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="lng-input" className="sr-only">Longitud</label>
            <input
              id="lng-input"
              type="number"
              step="any"
              placeholder="Longitud (ej: -68.33)"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-bg-input border border-border text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-400" role="alert">
            <AlertCircle size={13} aria-hidden="true" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="outline"
          size="md"
          fullWidth
          disabled={!lat || !lng}
        >
          Usar estas coordenadas
        </Button>
      </form>

      {/* Mendoza default */}
      <button
        onClick={onUseMendoza}
        className="text-xs text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded px-2"
      >
        Usar Mendoza centro ({MENDOZA.lat}, {MENDOZA.lng})
      </button>
    </div>
  )
}
