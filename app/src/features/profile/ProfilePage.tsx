import { useEffect } from 'react'
import {
  Camera,
  ChevronRight,
  Key,
  LogOut,
  MapPin,
  Pencil,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EloChart } from './components/EloChart'
import { MatchHistoryList } from './components/MatchHistoryList'
import { CategoryBadge } from '@/components/ui/CategoryBadge'

// ─── Trust helpers ─────────────────────────────────────────────────────────────

type TrustLabel = 'Excelente' | 'Bueno' | 'Bajo'
type BadgeVariant = 'trust-high' | 'trust-medium' | 'trust-low'

function trustLabelFromScore(score: number): TrustLabel {
  if (score >= 90) return 'Excelente'
  if (score >= 70) return 'Bueno'
  return 'Bajo'
}

function trustVariant(label: TrustLabel): BadgeVariant {
  if (label === 'Excelente') return 'trust-high'
  if (label === 'Bueno') return 'trust-medium'
  return 'trust-low'
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  const profile = useProfileStore((s) => s.profile)
  const eloHistory = useProfileStore((s) => s.eloHistory)
  const matchHistory = useProfileStore((s) => s.matchHistory)
  const hasMoreMatches = useProfileStore((s) => s.hasMoreMatches)
  const loading = useProfileStore((s) => s.loading)
  const error = useProfileStore((s) => s.error)
  const fetchProfile = useProfileStore((s) => s.fetchProfile)
  const fetchEloHistory = useProfileStore((s) => s.fetchEloHistory)
  const fetchMatchHistory = useProfileStore((s) => s.fetchMatchHistory)

  useEffect(() => {
    fetchProfile()
    fetchEloHistory()
    fetchMatchHistory(undefined, true)
  }, [fetchProfile, fetchEloHistory, fetchMatchHistory])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleLoadMoreMatches() {
    fetchMatchHistory(undefined, false)
  }

  // Loading state
  if (loading && !profile) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Mi perfil" />
        <div className="flex items-center justify-center flex-1 py-20">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Mi perfil" />
        <div className="px-4 py-8 text-center">
          <p className="text-text-secondary text-sm mb-4">{error}</p>
          <Button variant="outline" onClick={() => fetchProfile()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (!profile) return null

  const lastElo = eloHistory.length >= 2 ? eloHistory[eloHistory.length - 1] : null
  const eloDelta = lastElo?.delta ?? 0
  const isCalibrating =
    profile.calibration_matches_remaining !== undefined &&
    profile.calibration_matches_remaining > 0
  // BUG 10 FIX: Handle undefined last_name gracefully
  const fullName = [profile.name, profile.last_name].filter(Boolean).join(' ').trim() || profile.name

  return (
    <div className="flex flex-col min-h-full page-enter">
      {/* BUG 16 FIX: Use SlidersHorizontal for preferences (gear → settings, sliders → preferences) */}
      <Header
        title="Mi perfil"
        right={
          <button
            onClick={() => navigate('/profile/preferences')}
            className="flex items-center justify-center min-h-11 min-w-11 text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
            aria-label="Preferencias de matchmaking"
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
          </button>
        }
      />

      <div className="px-4 pt-6 pb-6 space-y-4">
        {/* Hero */}
        <Card>
          <div className="flex flex-col items-center gap-3 py-2">
            {/* Avatar with camera overlay */}
            <button
              onClick={() => navigate('/profile/avatar')}
              className="relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-full"
              aria-label="Cambiar avatar"
            >
              <Avatar src={profile.avatar_url} name={fullName} size="xl" />
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" aria-hidden="true" />
              </div>
            </button>

            {/* Name */}
            {/* BUG 11 FIX: Show email instead of username (username may be empty) */}
            <div className="text-center">
              <p className="text-xl font-bold text-text-primary">{fullName}</p>
              {profile.email && (
                <p className="text-text-secondary text-sm">{profile.email}</p>
              )}
            </div>

            {/* ELO big display */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span className="text-4xl font-black text-padel-green tabular-nums">
                  {profile.elo}
                </span>
                {eloDelta !== 0 && (
                  <span
                    className={[
                      'flex items-center gap-0.5 text-sm font-semibold',
                      eloDelta > 0 ? 'text-trust-high' : 'text-trust-low',
                    ].join(' ')}
                  >
                    {eloDelta > 0 ? (
                      <TrendingUp size={14} aria-hidden="true" />
                    ) : (
                      <TrendingDown size={14} aria-hidden="true" />
                    )}
                    {eloDelta > 0 ? `+${eloDelta}` : eloDelta}
                  </span>
                )}
              </div>
              <CategoryBadge elo={profile.elo} showFull />
            </div>

            {profile.trust_score !== undefined && (
              <Badge variant={trustVariant(trustLabelFromScore(profile.trust_score))}>
                Confianza: {trustLabelFromScore(profile.trust_score)}
              </Badge>
            )}
          </div>
        </Card>

        {/* Calibration or rank status */}
        {isCalibrating ? (
          <Card>
            <div className="text-center py-1">
              <p className="text-text-secondary text-sm">
                En calibración — te faltan{' '}
                <span className="text-text-primary font-semibold">
                  {profile.calibration_matches_remaining}
                </span>{' '}
                {profile.calibration_matches_remaining === 1 ? 'partido' : 'partidos'} para aparecer
                en el ranking
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <div className="text-center">
                <p className="text-2xl font-bold text-text-primary">
                  {profile.validated_match_count}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">Partidos jugados</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-2xl font-bold text-padel-green">{profile.elo}</p>
                <p className="text-xs text-text-secondary mt-0.5">ELO actual</p>
              </div>
            </Card>
          </div>
        )}

        {/* ELO History chart */}
        {eloHistory.length > 0 && (
          <Card>
            <p className="text-sm font-semibold text-text-primary mb-3">Historial ELO</p>
            <EloChart entries={eloHistory} />
          </Card>
        )}

        {/* Quick actions */}
        <div className="space-y-1">
          {/* BUG 16 FIX: Distinct icons for edit profile vs preferences */}
          <ActionRow
            icon={<Pencil size={18} aria-hidden="true" />}
            label="Editar perfil"
            onClick={() => navigate('/profile/edit')}
          />
          <ActionRow
            icon={<SlidersHorizontal size={18} aria-hidden="true" />}
            label="Preferencias de matchmaking"
            onClick={() => navigate('/profile/preferences')}
          />
          <ActionRow
            icon={<MapPin size={18} aria-hidden="true" />}
            label="Mis Canchas"
            onClick={() => navigate('/venues')}
          />
          <ActionRow
            icon={<Users size={18} aria-hidden="true" />}
            label="Mis Parejas"
            onClick={() => navigate('/partnerships')}
          />
          <ActionRow
            icon={<Key size={18} aria-hidden="true" />}
            label="Cambiar contraseña"
            onClick={() => navigate('/change-password')}
          />
        </div>

        {/* Match history */}
        <div>
          <p className="text-sm font-semibold text-text-primary mb-3">Últimos partidos</p>
          <MatchHistoryList
            matches={matchHistory}
            hasMore={hasMoreMatches}
            loading={loading && matchHistory.length > 0}
            onLoadMore={handleLoadMoreMatches}
          />
        </div>

        {/* Logout */}
        <div className="pt-2">
          <Button variant="danger" fullWidth onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Action row sub-component ─────────────────────────────────────────────────

interface ActionRowProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function ActionRow({ icon, label, onClick }: ActionRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-bg-card border border-border rounded-xl px-4 min-h-[52px] hover:border-border/80 hover:bg-bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
    >
      <span className="text-text-secondary shrink-0">{icon}</span>
      <span className="flex-1 text-left text-sm text-text-primary">{label}</span>
      <ChevronRight size={16} className="text-text-secondary shrink-0" aria-hidden="true" />
    </button>
  )
}
