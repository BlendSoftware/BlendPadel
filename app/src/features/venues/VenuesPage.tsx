import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Plus, BadgeCheck, Navigation } from 'lucide-react'
import { useVenueStore } from '@/stores/venue-store'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'

const DEFAULT_RADIUS_KM = 15

function formatDistance(meters?: number): string {
  if (meters === undefined || meters === null) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function VenuesPage() {
  const navigate = useNavigate()
  const venues = useVenueStore((s) => s.venues)
  const isLoading = useVenueStore((s) => s.isLoading)
  const error = useVenueStore((s) => s.error)
  const fetchNearby = useVenueStore((s) => s.fetchNearby)
  const clearError = useVenueStore((s) => s.clearError)

  const [locationError, setLocationError] = useState<string | null>(null)

  useEffect(() => {
    clearError()
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchNearby(pos.coords.latitude, pos.coords.longitude, DEFAULT_RADIUS_KM)
      },
      () => {
        setLocationError('No pudimos acceder a tu ubicación. Habilitá los permisos de ubicación.')
      },
    )
  }, [fetchNearby, clearError])

  const displayError = error ?? locationError

  return (
    <div className="flex flex-col min-h-full page-enter">
      <Header
        title="Canchas cercanas"
        showBack
        right={
          <button
            onClick={() => navigate('/venues/new')}
            className="flex items-center justify-center min-h-11 min-w-11 text-padel-green hover:text-padel-green-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
            aria-label="Sugerir cancha"
          >
            <Plus size={22} aria-hidden="true" />
          </button>
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-3">
        {/* Loading */}
        {isLoading && venues.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error */}
        {displayError && !isLoading && (
          <div className="text-center py-8">
            <p className="text-text-secondary text-sm mb-4">{displayError}</p>
            {error && (
              <Button variant="outline" onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  (pos) => fetchNearby(pos.coords.latitude, pos.coords.longitude, DEFAULT_RADIUS_KM),
                  () => setLocationError('No pudimos acceder a tu ubicación'),
                )
              }}>
                Reintentar
              </Button>
            )}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !displayError && venues.length === 0 && (
          <EmptyState
            icon={<MapPin size={48} />}
            title="No hay canchas cerca"
            subtitle="Sugerí una cancha que conozcas para que otros jugadores la encuentren"
            action={
              <Button onClick={() => navigate('/venues/new')}>
                <Plus size={16} aria-hidden="true" />
                Sugerir cancha
              </Button>
            }
          />
        )}

        {/* Venue list */}
        {venues.map((venue) => (
          <Card key={venue.id}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-padel-green/10 text-padel-green">
                <MapPin size={20} aria-hidden="true" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {venue.name}
                  </p>
                  {venue.verified && (
                    <Badge variant="green">
                      <BadgeCheck size={12} aria-hidden="true" />
                      Verificada
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-text-secondary mt-0.5 truncate">
                  {venue.address}
                </p>

                <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                  <span>{venue.court_count} {venue.court_count === 1 ? 'cancha' : 'canchas'}</span>
                  {venue.distance_meters !== undefined && (
                    <span className="flex items-center gap-1">
                      <Navigation size={12} aria-hidden="true" />
                      {formatDistance(venue.distance_meters)}
                    </span>
                  )}
                  {venue.phone && (
                    <a
                      href={`tel:${venue.phone}`}
                      className="text-padel-green hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {venue.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {/* Suggest CTA at bottom */}
        {venues.length > 0 && (
          <div className="pt-2">
            <Button variant="outline" fullWidth onClick={() => navigate('/venues/new')}>
              <Plus size={16} aria-hidden="true" />
              Sugerir cancha
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
