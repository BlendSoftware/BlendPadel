import { useEffect, useRef } from 'react'
import { X, Clock, MapPin, Users, Zap, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { RadarMatch } from '@/types/radar'

interface MatchDetailSheetProps {
  match: RadarMatch | null
  onClose: () => void
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatELO(elo: number): string {
  return elo.toLocaleString('es-AR')
}

export function MatchDetailSheet({ match, onClose }: MatchDetailSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    if (!match) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [match, onClose])

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (match) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [match])

  const slotsLeft = match ? match.players_needed - match.players_confirmed : 0
  const isUrgent = slotsLeft === 1

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          match ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={[
          'fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px]',
          'bg-bg-card rounded-t-2xl border-t border-border',
          'transition-transform duration-300 ease-out',
          match ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={match ? `Detalle del partido: ${match.title}` : 'Detalle del partido'}
      >
        {match && (
          <>
            {/* Handle + close */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="w-10 h-1 bg-border rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <div className="w-8" /> {/* spacer */}
              <button
                onClick={onClose}
                className="flex items-center justify-center min-h-11 min-w-11 text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
                aria-label="Cerrar"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-6">
              {/* Title + urgency */}
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-text-primary leading-tight">
                    {match.title}
                  </h2>
                  {isUrgent && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 mt-0.5">
                      <Zap size={11} aria-hidden="true" />
                      Falta uno para cerrar!
                    </span>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {/* Time */}
                <div className="bg-bg-dark rounded-xl p-3 flex items-center gap-2">
                  <Clock size={16} className="text-padel-green flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-text-secondary">Hora</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatTime(match.scheduled_at)}
                    </p>
                  </div>
                </div>

                {/* Distance */}
                <div className="bg-bg-dark rounded-xl p-3 flex items-center gap-2">
                  <MapPin size={16} className="text-padel-green flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-text-secondary">Distancia</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {match.distance_km.toFixed(1)} km
                    </p>
                  </div>
                </div>

                {/* Players */}
                <div className="bg-bg-dark rounded-xl p-3 flex items-center gap-2">
                  <Users size={16} className="text-padel-green flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-text-secondary">Jugadores</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {match.players_confirmed}/{match.max_players}
                      <span className="text-xs text-text-secondary ml-1">
                        ({slotsLeft} libre{slotsLeft !== 1 ? 's' : ''})
                      </span>
                    </p>
                  </div>
                </div>

                {/* ELO */}
                <div className="bg-bg-dark rounded-xl p-3 flex items-center gap-2">
                  <span className="text-padel-green font-bold text-xs flex-shrink-0" aria-hidden="true">
                    ELO
                  </span>
                  <div>
                    <p className="text-xs text-text-secondary">Promedio</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatELO(match.elo_avg)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 mb-5 text-sm text-text-secondary">
                <MapPin size={14} aria-hidden="true" />
                <span>{match.location_name}</span>
              </div>

              {/* CTA */}
              <Button
                fullWidth
                size="lg"
                className="flex items-center justify-center gap-2"
                onClick={() => {
                  // TODO EPIC 16: navigate to matchmaking join flow
                }}
              >
                Quiero jugar
                <ChevronRight size={18} aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
