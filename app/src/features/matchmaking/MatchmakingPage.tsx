import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Zap, X } from 'lucide-react'
import { SkeletonList } from '@/components/ui/Skeleton'
import { FlareCard } from './components/FlareCard'
import { MatchCard } from './components/MatchCard'
import { useMatchmakingStore } from '@/stores/matchmaking-store'
import { useMatchStore, filterMatchesByTab } from '@/stores/match-store'
import { useAuthStore } from '@/stores/auth-store'
import type { Flare } from './types'
import type { MatchTab } from '@/stores/match-store'

import styles from './MatchmakingPage.module.css'

// ─── My Flare section ─────────────────────────────────────────────────────────

function MyFlareSection() {
  const navigate   = useNavigate()
  const myFlare    = useMatchmakingStore((s) => s.myFlare)
  const isLoading  = useMatchmakingStore((s) => s.isLoading)
  const cancelFlare = useMatchmakingStore((s) => s.cancelFlare)

  const handleCancel = async () => {
    if (!myFlare) return
    if (!window.confirm('¿Seguro que querés cancelar tu desafío?')) return
    await cancelFlare(myFlare.id)
  }

  if (myFlare) {
    const dateStr = new Date(myFlare.scheduled_at).toLocaleDateString('es-AR', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })

    return (
      <div className={styles.myFlareCard}>
        <div className={styles.myFlareHeader}>
          <span className={styles.myFlareDot} />
          <p className={styles.myFlareTitle}>Tu desafío activo</p>
        </div>
        <p className={styles.myFlareMsg}>{myFlare.message}</p>
        <p className={styles.myFlareDate}>{dateStr}</p>
        <button
          className={styles.cancelBtn}
          onClick={handleCancel}
          disabled={isLoading}
        >
          <X size={13} />
          Cancelar desafío
        </button>
      </div>
    )
  }

  return (
    <button className={styles.ctaCard} onClick={() => navigate('/matchmaking/create-flare')}>
      <div className={styles.ctaContent}>
        <p className={styles.ctaLabel}>Nuevo desafío</p>
        <h2 className={styles.ctaTitle}>CREAR<br />DESAFÍO</h2>
        <p className={styles.ctaDesc}>Convocá rivales de tu nivel ELO</p>
      </div>
      <div className={styles.ctaBtn}>
        <Zap size={22} strokeWidth={2.5} />
      </div>
    </button>
  )
}

// ─── Flare wall ───────────────────────────────────────────────────────────────

function FlareWall() {
  const navigate    = useNavigate()
  const flares      = useMatchmakingStore((s) => s.flares)
  const isLoading   = useMatchmakingStore((s) => s.isLoading)
  const error       = useMatchmakingStore((s) => s.error)
  const fetchFlares = useMatchmakingStore((s) => s.fetchFlares)
  const user        = useAuthStore((s) => s.user)

  const otherFlares = flares.filter((f) => f.user_id !== user?.id && f.player_id !== user?.id)

  const handleRespond = (flare: Flare) => {
    navigate(`/matchmaking/flares/${flare.id}/respond`)
  }

  if (isLoading && flares.length === 0) {
    return <SkeletonList count={3} variant="flare" />
  }

  if (error) {
    return (
      <div className={styles.errorWrap}>
        <p className={styles.errorText}>{error}</p>
        <button className={styles.retryBtn} onClick={fetchFlares}>
          <RefreshCw size={13} /> Reintentar
        </button>
      </div>
    )
  }

  if (otherFlares.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <div className={styles.emptyIconWrap}>
          <Zap size={32} />
        </div>
        <p className={styles.emptyTitle}>Sin desafíos en tu zona</p>
        <p className={styles.emptySubtitle}>Creá uno y encontrá compañeros de partido</p>
        <button className={styles.emptyAction} onClick={() => navigate('/matchmaking/create-flare')}>
          <Plus size={14} /> Crear desafío
        </button>
      </div>
    )
  }

  return (
    <div className={styles.flareList}>
      {otherFlares.map((flare) => (
        <FlareCard key={flare.id} flare={flare} onRespond={handleRespond} />
      ))}
    </div>
  )
}

// ─── My Matches section ───────────────────────────────────────────────────────

const MATCH_TABS: { key: MatchTab; label: string }[] = [
  { key: 'upcoming',  label: 'Próximos' },
  { key: 'pending',   label: 'Pendientes' },
  { key: 'history',   label: 'Historial' },
]

function MyMatchesSection() {
  const activeTab     = useMatchStore((s) => s.activeTab)
  const matches       = useMatchStore((s) => s.matches)
  const isLoading     = useMatchStore((s) => s.isLoading)
  const fetchMatches  = useMatchStore((s) => s.fetchMatches)
  const setActiveTab  = useMatchStore((s) => s.setActiveTab)

  useEffect(() => { fetchMatches() }, [fetchMatches])

  const filteredMatches = filterMatchesByTab(matches, activeTab)

  const emptySubtitle =
    activeTab === 'upcoming'  ? 'Creá un partido o respondé un desafío' :
    activeTab === 'pending'   ? 'No tenés partidos pendientes de resultado' :
    'Tu historial de partidos aparecerá acá'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tab bar */}
      <div className={styles.subTabs}>
        {MATCH_TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`${styles.subTab} ${activeTab === key ? styles.subTabActive : ''}`}
            onClick={() => setActiveTab(key)}
            role="tab"
            aria-selected={activeTab === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && matches.length === 0 ? (
        <SkeletonList count={3} variant="match" />
      ) : filteredMatches.length === 0 ? (
        <div className={styles.emptyWrap}>
          <div className={styles.emptyIconWrap}>
            <Plus size={28} />
          </div>
          <p className={styles.emptyTitle}>Sin partidos</p>
          <p className={styles.emptySubtitle}>{emptySubtitle}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type MainTab = 'matchmaking' | 'my-matches'

export function MatchmakingPage() {
  const navigate      = useNavigate()
  const fetchFlares   = useMatchmakingStore((s) => s.fetchFlares)
  const fetchMyFlare  = useMatchmakingStore((s) => s.fetchMyFlare)
  const isLoading     = useMatchmakingStore((s) => s.isLoading)

  const [mainTab, setMainTab]   = useState<MainTab>('matchmaking')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchFlares()
    fetchMyFlare()
  }, [fetchFlares, fetchMyFlare])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    if (mainTab === 'matchmaking') await fetchFlares()
    setTimeout(() => setRefreshing(false), 700)
  }, [mainTab, fetchFlares])

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Partidos</h1>
        <div className={styles.topActions}>
          <button
            className={`${styles.iconBtn} ${refreshing ? styles.spinning : ''}`}
            onClick={handleRefresh}
            aria-label="Actualizar"
            title="Actualizar"
          >
            <RefreshCw size={17} />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
            onClick={() => navigate('/matchmaking/new')}
            aria-label="Crear partido"
            title="Crear partido"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* ── Main tabs ── */}
        <div className={styles.mainTabs} role="tablist">
          <button
            className={`${styles.mainTab} ${mainTab === 'matchmaking' ? styles.mainTabActive : ''}`}
            role="tab"
            aria-selected={mainTab === 'matchmaking'}
            onClick={() => setMainTab('matchmaking')}
          >
            Desafíos
          </button>
          <button
            className={`${styles.mainTab} ${mainTab === 'my-matches' ? styles.mainTabActive : ''}`}
            role="tab"
            aria-selected={mainTab === 'my-matches'}
            onClick={() => setMainTab('my-matches')}
          >
            Mis partidos
          </button>
        </div>

        {/* ── Content ── */}
        {mainTab === 'matchmaking' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <MyFlareSection />
            <div>
              <p className={styles.sectionLabel}>Desafíos en tu zona</p>
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
