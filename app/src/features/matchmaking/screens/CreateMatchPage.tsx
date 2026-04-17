import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { PlayerSearchPicker } from '../components/PlayerSearchPicker'
import { ProjectionCard } from '@/features/rankings/ProjectionCard'
import { useMatchStore } from '@/stores/match-store'
import { useAuthStore } from '@/stores/auth-store'
import { useVenueStore } from '@/stores/venue-store'
import type { PlayerSearchResult, MatchType } from '../types'

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function minDatetime(): string {
  return toLocalDatetimeValue(new Date(Date.now() + 30 * 60 * 1000))
}

export function CreateMatchPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isActionLoading = useMatchStore((s) => s.isActionLoading)
  const error = useMatchStore((s) => s.error)
  const createMatch = useMatchStore((s) => s.createMatch)
  const clearError = useMatchStore((s) => s.clearError)
  const venues = useVenueStore((s) => s.venues)
  const venuesLoading = useVenueStore((s) => s.isLoading)
  const fetchNearby = useVenueStore((s) => s.fetchNearby)

  const [matchType, setMatchType] = useState<MatchType>('male')
  const [scheduledAt, setScheduledAt] = useState('')
  const currentUserAsPlayer: PlayerSearchResult | null = user
    ? { id: user.id, name: user.name || 'Yo', elo: user.elo ?? 0, avatar_url: user.avatar_url }
    : null
  const [teamA, setTeamA] = useState<PlayerSearchResult[]>([])
  const [teamB, setTeamB] = useState<PlayerSearchResult[]>([])
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [venueId, setVenueId] = useState('')
  const [gettingLocation, setGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // BUG 17 FIX: Only show store error after user has submitted at least once
  const [hasSubmitted, setHasSubmitted] = useState(false)

  // Auto-fill current user in Team A when user data becomes available
  useEffect(() => {
    if (currentUserAsPlayer && teamA.length === 0) {
      setTeamA([currentUserAsPlayer])
    }
    clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const currentUserId = user?.id ?? ''
  const excludeA = [currentUserId, ...teamB.map((p) => p.id)].filter(Boolean) as string[]
  const excludeB = [currentUserId, ...teamA.map((p) => p.id)].filter(Boolean) as string[]

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
        setGettingLocation(false)
        void fetchNearby(pos.coords.latitude, pos.coords.longitude, 15)
      },
      () => {
        setLocationError('No se pudo obtener la ubicación')
        setGettingLocation(false)
      },
    )
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!scheduledAt) errors.scheduledAt = 'La fecha es obligatoria'
    else if (new Date(scheduledAt) <= new Date()) errors.scheduledAt = 'La fecha debe ser futura'
    if (teamA.length !== 2) errors.teamA = 'El equipo A necesita exactamente 2 jugadores'
    if (teamB.length !== 2) errors.teamB = 'El equipo B necesita exactamente 2 jugadores'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setHasSubmitted(true)
    clearError()
    if (!validate()) return
    try {
      const match = await createMatch({
        team_a: teamA.map((p) => p.id),
        team_b: teamB.map((p) => p.id),
        scheduled_at: new Date(scheduledAt).toISOString(),
        latitude: lat,
        longitude: lng,
        match_type: matchType,
        venue_id: venueId || undefined,
      })
      navigate(`/matches/${match.id}`)
    } catch {
      // error in store
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Crear partido" showBack />

      <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-6 pb-8">
        {/* BUG 17 FIX: Only show error after user has submitted */}
        {hasSubmitted && error && (
          <div role="alert" className="bg-trust-low/10 border border-trust-low/30 rounded-xl p-3 text-sm text-trust-low">
            {error}
          </div>
        )}

        {/* Date/time */}
        <div className="flex flex-col gap-1">
          <label htmlFor="match-date" className="text-sm font-medium text-text-secondary">
            Fecha y hora
          </label>
          <input
            id="match-date"
            type="datetime-local"
            min={minDatetime()}
            value={scheduledAt}
            onChange={(e) => {
              setScheduledAt(e.target.value)
              setFieldErrors((prev) => ({ ...prev, scheduledAt: '' }))
            }}
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
          <p className="text-sm font-medium text-text-secondary">Ubicacion (opcional)</p>
          <Button type="button" variant="secondary" fullWidth loading={gettingLocation} onClick={handleGetLocation}>
            <MapPin size={16} aria-hidden="true" />
            Usar mi ubicacion para cargar clubes cercanos
          </Button>

          <div className="space-y-1">
            <label htmlFor="venue" className="text-xs text-text-secondary">Club o cancha</label>
            <select
              id="venue"
              value={venueId}
              onChange={(e) => {
                const selectedId = e.target.value
                setVenueId(selectedId)
                const selectedVenue = venues.find((v) => v.id === selectedId)
                if (selectedVenue) {
                  setLat(selectedVenue.lat)
                  setLng(selectedVenue.lng)
                }
              }}
              className="w-full rounded-xl bg-bg-input text-text-primary border border-border transition-colors min-h-11 px-4 py-2.5 text-sm focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green"
            >
              <option value="">Elegi el club o cancha</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name} - {venue.address}
                </option>
              ))}
            </select>
            {venuesLoading && <p className="text-xs text-text-secondary">Cargando clubes cercanos...</p>}
          </div>

          {lat !== null && (
            <p className="text-xs text-text-secondary">Ubicacion detectada para busqueda: {lat.toFixed(4)}, {lng?.toFixed(4)}</p>
          )}
          {locationError && <p role="alert" className="text-xs text-trust-low">{locationError}</p>}
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

        {/* Team A */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Equipo A</p>
            {fieldErrors.teamA && (
              <p role="alert" className="text-xs text-trust-low">{fieldErrors.teamA}</p>
            )}
          </div>
          <PlayerSearchPicker
            selectedPlayers={teamA}
            maxPlayers={2}
            onAdd={(p) => setTeamA((prev) => [...prev, p])}
            onRemove={(id) => setTeamA((prev) => prev.filter((p) => p.id !== id))}
            label=""
            excludeIds={excludeA}
            matchType={matchType}
          />
        </div>

        {/* Team B */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Equipo B</p>
            {fieldErrors.teamB && (
              <p role="alert" className="text-xs text-trust-low">{fieldErrors.teamB}</p>
            )}
          </div>
          <PlayerSearchPicker
            selectedPlayers={teamB}
            maxPlayers={2}
            onAdd={(p) => setTeamB((prev) => [...prev, p])}
            onRemove={(id) => setTeamB((prev) => prev.filter((p) => p.id !== id))}
            label=""
            excludeIds={excludeB}
            matchType={matchType}
          />
        </div>

        {/* ELO projection — show when both teams have 2 calibrated players */}
        {teamA.length === 2 && teamB.length === 2 &&
         teamA.every((p) => p.elo > 0) && teamB.every((p) => p.elo > 0) && (
          <ProjectionCard
            teamA={teamA.map((p) => p.elo)}
            teamB={teamB.map((p) => p.elo)}
          />
        )}

        {/* Submit */}
        <div className="pt-2">
          <p className="text-xs text-text-secondary text-center mb-4">
            Vas a ser el capitán del Equipo A. El capitán del Equipo B debe confirmar el resultado.
          </p>
          <Button type="submit" fullWidth size="lg" loading={isActionLoading}>
            Crear partido
          </Button>
        </div>
      </form>
    </div>
  )
}
