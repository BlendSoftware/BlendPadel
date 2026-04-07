import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Zap } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { FlareCard } from './components/FlareCard'
import { MatchCard } from './components/MatchCard'
import { useMatchmakingStore } from '@/stores/matchmaking-store'
import { useMatchStore, filterMatchesByTab } from '@/stores/match-store'
import { useAuthStore } from '@/stores/auth-store'
import type { Flare } from './types'
import type { MatchTab } from '@/stores/match-store'

// ─── My Flare section ─────────────────────────────────────────────────────────

function MyFlareSection() {
  const navigate = useNavigate()
  const myFlare = useMatchmakingStore((s) => s.myFlare)
  const isLoading = useMatchmakingStore((s) => s.isLoading)
  const cancelFlare = useMatchmakingStore((s) => s.cancelFlare)

  const handleCancel = async () => {
    if (!myFlare) return
    if (!window.confirm('¿Seguro que querés cancelar tu desafío?')) return
    await cancelFlare(myFlare.id)
  }

  if (myFlare) {
    return (
      <div className="bg-padel-green/10 border border-padel-green/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-padel-green" aria-hidden="true" />
          <p className="text-sm font-semibold text-padel-green">Tu desafío activo</p>
        </div>
        <p className="text-sm text-text-secondary line-clamp-2">{myFlare.message}</p>
        <p className="text-xs text-text-secondary">
          {new Date(myFlare.scheduled_at).toLocaleDateString('es-AR', {
            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
          })}
        </p>
        <Button variant="danger" size="sm" loading={isLoading} onClick={handleCancel}>
          Cancelar desafío
        </Button>
      </div>
    )
  }

  return (
    <Button variant="outline" fullWidth onClick={() => navigate('/matchmaking/create-flare')}>
      <Zap size={16} aria-hidden="true" />
      Crear desafío
    </Button>
  )
}

// ─── Flare wall ───────────────────────────────────────────────────────────────

function FlareWall() {
  const navigate = useNavigate()
  const flares = useMatchmakingStore((s) => s.flares)
  const isLoading = useMatchmakingStore((s) => s.isLoading)
  const error = useMatchmakingStore((s) => s.error)
  const fetchFlares = useMatchmakingStore((s) => s.fetchFlares)
  const user = useAuthStore((s) => s.user)

  // Filter out own flares from the wall (backend may use user_id or player_id)
  const otherFlares = flares.filter((f) => f.user_id !== user?.id && f.player_id !== user?.id)

  const handleRespond = (flare: Flare) => {
    navigate(`/matchmaking/flares/${flare.id}/respond`)
  }

  if (isLoading && flares.length === 0) {
    return <SkeletonList count={3} variant="flare" />
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-trust-low">{error}</p>
        <Button variant="ghost" size="sm" onClick={fetchFlares}>
          <RefreshCw size={14} aria-hidden="true" />
          Reintentar
        </Button>
      </div>
    )
  }

  if (otherFlares.length === 0) {
    return (
      <EmptyState
        icon={<Zap size={36} />}
        title="Sin desafíos en tu zona"
        subtitle="Creá uno y encontrá compañeros de partido"
        action={
          <Button size="sm" onClick={() => navigate('/matchmaking/create-flare')}>
            <Plus size={14} aria-hidden="true" />
            Crear desafío
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {otherFlares.map((flare) => (
        <FlareCard
          key={flare.id}
          flare={flare}
          onRespond={handleRespond}
          isResponding={false}
        />
      ))}
    </div>
  )
}

// ─── My matches section ───────────────────────────────────────────────────────

const MATCH_TABS: { key: MatchTab; label: string }[] = [
  { key: 'upcoming', label: 'Próximos' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'history', label: 'Historial' },
]

function MyMatchesSection() {
  const activeTab = useMatchStore((s) => s.activeTab)
  const matches = useMatchStore((s) => s.matches)
  const isLoading = useMatchStore((s) => s.isLoading)
  const fetchMatches = useMatchStore((s) => s.fetchMatches)
  const setActiveTab = useMatchStore((s) => s.setActiveTab)

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleTabChange = (tab: MatchTab) => {
    setActiveTab(tab)
  }

  // Filter matches by the active tab
  const filteredMatches = filterMatchesByTab(matches, activeTab)

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-bg-card rounded-xl p-1" role="tablist">
        {MATCH_TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            className={[
              'flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors min-h-11',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
              activeTab === key
                ? 'bg-padel-green text-neutral-950'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
            onClick={() => handleTabChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && matches.length === 0 ? (
        <SkeletonList count={3} variant="match" />
      ) : filteredMatches.length === 0 ? (
        <EmptyState
          icon={<Plus size={32} />}
          title="Sin partidos"
          subtitle={
            activeTab === 'upcoming'
              ? 'Creá un partido o respondé un desafío'
              : activeTab === 'pending'
              ? 'No tenés partidos pendientes'
              : 'Tu historial aparecerá acá'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Top-level tabs ───────────────────────────────────────────────────────────

type MainTab = 'matchmaking' | 'my-matches'

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'matchmaking', label: 'Desafíos' },
  { key: 'my-matches', label: 'Mis partidos' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MatchmakingPage() {
  const navigate = useNavigate()
  const fetchFlares = useMatchmakingStore((s) => s.fetchFlares)
  const fetchMyFlare = useMatchmakingStore((s) => s.fetchMyFlare)

  const [mainTab, setMainTab] = useState<MainTab>('matchmaking')

  useEffect(() => {
    fetchFlares()
    fetchMyFlare()
  }, [fetchFlares, fetchMyFlare])

  const handleRefresh = () => {
    if (mainTab === 'matchmaking') fetchFlares()
  }

  return (
    <div className="flex flex-col min-h-full page-enter">
      <Header
        title="Partidos"
        right={
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="flex items-center justify-center min-h-11 min-w-11 text-text-secondary hover:text-padel-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
              aria-label="Actualizar"
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
            <button
              onClick={() => navigate('/matchmaking/new')}
              className="flex items-center justify-center min-h-11 min-w-11 text-text-secondary hover:text-padel-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
              aria-label="Crear partido directo"
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>
        }
      />

      <div className="px-4 pt-4 space-y-5 pb-24">
        {/* Main tab switcher */}
        <div className="flex gap-1 bg-bg-card rounded-xl p-1" role="tablist">
          {MAIN_TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={mainTab === key}
              className={[
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors min-h-11',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
                // BUG 7 FIX: Use explicit dark color for active tab text on green background
              mainTab === key
                  ? 'bg-padel-green text-neutral-950'
                  : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
              onClick={() => setMainTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {mainTab === 'matchmaking' ? (
          <div className="space-y-5">
            <MyFlareSection />
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Desafíos en tu zona
              </p>
              <FlareWall />
            </div>
          </div>
        ) : (
          <MyMatchesSection />
        )}
      </div>
    </div>
  )
}
