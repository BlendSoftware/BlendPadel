import { MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface RadarEmptyStateProps {
  radiusKm: number
  onExpandRadius: () => void
  onCreateMatch: () => void
}

export function RadarEmptyState({ radiusKm, onExpandRadius, onCreateMatch }: RadarEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-full bg-bg-card border border-border flex items-center justify-center">
          <MapPin size={36} className="text-text-secondary opacity-50" aria-hidden="true" />
        </div>
        {/* Pulse ring animation */}
        <div className="absolute inset-0 rounded-full border border-padel-green/20 animate-ping" />
      </div>

      <div>
        <p className="text-text-primary font-semibold text-base mb-1">
          No hay partidos en {radiusKm} km
        </p>
        <p className="text-text-secondary text-sm max-w-xs">
          No encontramos partidos cerca tuyo con el filtro actual. Ampliá el radio o creá el tuyo.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button
          variant="outline"
          size="md"
          fullWidth
          onClick={onExpandRadius}
        >
          Ampliar radio de búsqueda
        </Button>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={onCreateMatch}
        >
          <Plus size={16} aria-hidden="true" />
          Crear partido
        </Button>
      </div>
    </div>
  )
}
