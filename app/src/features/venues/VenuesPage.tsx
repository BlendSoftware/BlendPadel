import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Plus, BadgeCheck, Navigation, AlertCircle } from 'lucide-react'
import { useVenueStore } from '@/stores/venue-store'
import { Spinner } from '@/components/ui/Spinner'
import styles from '@/features/profile/SubPage.module.css'
import localStyles from './VenuesPage.module.css'

const DEFAULT_RADIUS_KM = 15

function formatDistance(meters?: number): string {
  if (meters === undefined || meters === null) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function VenuesPage() {
  const navigate     = useNavigate()
  const venues       = useVenueStore((s) => s.venues)
  const isLoading    = useVenueStore((s) => s.isLoading)
  const error        = useVenueStore((s) => s.error)
  const fetchNearby  = useVenueStore((s) => s.fetchNearby)
  const clearError   = useVenueStore((s) => s.clearError)

  const [locationError, setLocationError] = useState<string | null>(null)

  useEffect(() => {
    clearError()
    if (!navigator.geolocation) { setLocationError('Tu navegador no soporta geolocalización'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchNearby(pos.coords.latitude, pos.coords.longitude, DEFAULT_RADIUS_KM),
      ()    => setLocationError('No pudimos acceder a tu ubicación. Habilitá los permisos de ubicación.'),
    )
  }, [fetchNearby, clearError])

  const displayError = error ?? locationError

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <h1 className={styles.headerTitle}>Mis canchas</h1>
        <div className={styles.headerRight}>
          <button
            onClick={() => navigate('/venues/new')}
            className={localStyles.addBtn}
            aria-label="Sugerir cancha"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* Loading */}
        {isLoading && venues.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Spinner size="lg" />
          </div>
        )}

        {/* Error */}
        {displayError && !isLoading && (
          <div className={styles.errorAlert} role="alert">
            <AlertCircle size={16} className={styles.errorIcon} />
            <p className={styles.errorText}>{displayError}</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !displayError && venues.length === 0 && (
          <div className={localStyles.emptyState}>
            <div className={localStyles.emptyIcon}><MapPin size={28} /></div>
            <p className={localStyles.emptyTitle}>No hay canchas cerca</p>
            <p className={localStyles.emptySubtitle}>Sugerí una cancha que conozcas para que otros jugadores la encuentren</p>
            <button className={styles.submitBtn} onClick={() => navigate('/venues/new')}>
              <Plus size={15} />
              Sugerir cancha
            </button>
          </div>
        )}

        {/* Venue list */}
        {venues.map((venue) => (
          <div key={venue.id} className={localStyles.venueCard}>
            {/* Accent strip */}
            <div className={localStyles.venueAccent} />

            <div className={localStyles.venueIconWrap}>
              <MapPin size={18} />
            </div>

            <div className={localStyles.venueBody}>
              <div className={localStyles.venueNameRow}>
                <p className={localStyles.venueName}>{venue.name}</p>
                {venue.verified && (
                  <span className={localStyles.verifiedBadge}>
                    <BadgeCheck size={11} />
                    Verificada
                  </span>
                )}
              </div>

              {venue.address && (
                <p className={localStyles.venueAddress}>{venue.address}</p>
              )}

              <div className={localStyles.venueMeta}>
                <span>{venue.court_count} {venue.court_count === 1 ? 'cancha' : 'canchas'}</span>
                {venue.distance_meters !== undefined && (
                  <span className={localStyles.venueDistance}>
                    <Navigation size={10} />
                    {formatDistance(venue.distance_meters)}
                  </span>
                )}
                {venue.phone && (
                  <a
                    href={`tel:${venue.phone}`}
                    className={localStyles.venuePhone}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {venue.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Suggest CTA bottom */}
        {venues.length > 0 && (
          <button
            className={`${styles.submitBtn} ${styles.submitBtnSecondary}`}
            onClick={() => navigate('/venues/new')}
          >
            <Plus size={15} />
            Sugerir cancha
          </button>
        )}
      </div>
    </div>
  )
}
