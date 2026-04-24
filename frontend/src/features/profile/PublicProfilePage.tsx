import { useEffect } from 'react'
import { Swords, UserX } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/stores/profile-store'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { MatchHistoryList } from './components/MatchHistoryList'

type TrustLabel = 'Excelente' | 'Bueno' | 'Bajo'
type BadgeVariant = 'trust-high' | 'trust-medium' | 'trust-low'

function trustVariant(label: TrustLabel): BadgeVariant {
  if (label === 'Excelente') return 'trust-high'
  if (label === 'Bueno') return 'trust-medium'
  return 'trust-low'
}

export function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const publicProfile = useProfileStore((s) => s.publicProfile)
  const matchHistory = useProfileStore((s) => s.matchHistory)
  const hasMoreMatches = useProfileStore((s) => s.hasMoreMatches)
  const loading = useProfileStore((s) => s.loading)
  const notFound = useProfileStore((s) => s.notFound)
  const error = useProfileStore((s) => s.error)
  const fetchPublicProfile = useProfileStore((s) => s.fetchPublicProfile)
  const fetchMatchHistory = useProfileStore((s) => s.fetchMatchHistory)
  const clearPublicProfile = useProfileStore((s) => s.clearPublicProfile)

  const playerId = id ?? null

  useEffect(() => {
    if (!playerId) return

    fetchPublicProfile(playerId)
    fetchMatchHistory(playerId, true)

    return () => {
      clearPublicProfile()
    }
  }, [playerId, fetchPublicProfile, fetchMatchHistory, clearPublicProfile])

  function handleLoadMore() {
    if (playerId) fetchMatchHistory(playerId, false)
  }

  // Loading
  if (loading && !publicProfile) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Perfil" showBack />
        <div className="flex items-center justify-center flex-1 py-20">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  // 404 / banned
  if (notFound) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Perfil" showBack />
        <div className="flex flex-col items-center justify-center flex-1 py-20 px-4 text-center gap-4">
          <UserX size={48} className="text-text-secondary" aria-hidden="true" />
          <div>
            <p className="text-text-primary font-semibold text-lg">Jugador no encontrado</p>
            <p className="text-text-secondary text-sm mt-1">
              Este perfil no existe o fue desactivado.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  // Generic error
  if (error && !publicProfile) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Perfil" showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-text-secondary text-sm mb-4">{error}</p>
          <Button variant="outline" onClick={() => playerId && fetchPublicProfile(playerId)}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (!publicProfile) return null

  const fullName = publicProfile.name

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Perfil" showBack />

      <div className="px-4 pt-6 pb-6 space-y-4">
        {/* Hero */}
        <Card>
          <div className="flex flex-col items-center gap-3 py-2">
            <Avatar name={fullName} size="xl" />

            <div className="text-center">
              <p className="text-xl font-bold text-text-primary">{fullName}</p>
            </div>

            {/* ELO */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl font-black text-padel-green tabular-nums">
                {publicProfile.elo}
              </span>
              <CategoryBadge elo={publicProfile.elo} showFull />
            </div>

            {/* trust_label comes directly from the API other-view response */}
            <Badge variant={trustVariant(publicProfile.trust_label)}>
              Confianza: {publicProfile.trust_label}
            </Badge>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <div className="text-center">
              <p className="text-2xl font-bold text-text-primary">
                {publicProfile.validated_match_count}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">Partidos jugados</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-2xl font-bold text-padel-green">{publicProfile.elo}</p>
              <p className="text-xs text-text-secondary mt-0.5">ELO</p>
            </div>
          </Card>
        </div>

        {/* Challenge button */}
        <Button
          variant="primary"
          fullWidth
          onClick={() => navigate('/matchmaking')}
        >
          <Swords size={16} aria-hidden="true" />
          Desafiar a {publicProfile.name}
        </Button>

        {/* Match history (last 5) */}
        <div>
          <p className="text-sm font-semibold text-text-primary mb-3">Últimos partidos</p>
          <MatchHistoryList
            matches={matchHistory.slice(0, 5)}
            hasMore={hasMoreMatches && matchHistory.length < 5}
            loading={loading && matchHistory.length > 0}
            onLoadMore={handleLoadMore}
          />
        </div>
      </div>
    </div>
  )
}
