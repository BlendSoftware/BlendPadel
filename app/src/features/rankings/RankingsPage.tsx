import { useEffect, useState, useTransition } from 'react'
import { MapPin, RefreshCw, AlertCircle, Trophy, Check } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useRankingsStore } from '@/stores/rankings-store'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar } from '@/components/ui/Avatar'
import { CategoryBadge } from '@/components/ui/CategoryBadge'

import styles from './RankingsPage.module.css'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonEntries() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={`${styles.shimmer}`} style={{ width: 28, height: 28, borderRadius: 8 }} />
          <div className={`${styles.shimmer}`} style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className={styles.shimmer} style={{ width: '55%', height: 12 }} />
            <div className={styles.shimmer} style={{ width: '35%', height: 9 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <div className={styles.shimmer} style={{ width: 48, height: 20 }} />
            <div className={styles.shimmer} style={{ width: 60, height: 12 }} />
          </div>
        </div>
      ))}
    </>
  )
}

// ─── Rank Entry ───────────────────────────────────────────────────────────────

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

interface RankEntryProps {
  entry: { rank: number; name: string; elo: number; validated_match_count: number; trust_score?: number }
  isMe: boolean
  isFooter?: boolean
  index: number
}

function RankEntry({ entry, isMe, isFooter = false, index }: RankEntryProps) {
  const medal   = MEDALS[entry.rank]
  const isTop3  = entry.rank <= 3

  return (
    <div
      className={[
        styles.entryRow,
        isMe ? styles.entryRowMe : '',
        isFooter ? styles.entryRowFooter : '',
      ].join(' ')}
      style={{ animationDelay: `${index * 40}ms` }}
      role="row"
      aria-current={isMe ? 'true' : undefined}
    >
      {/* Rank */}
      <div className={styles.rankCell} aria-label={`Posición ${entry.rank}`}>
        {medal ? (
          <span className={styles.rankMedal}>{medal}</span>
        ) : (
          <span className={`${styles.rankNum} ${isTop3 ? styles.rankNumTop : ''}`}>
            {entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <Avatar name={entry.name} size="md" />

      {/* Name + match count */}
      <div className={styles.nameBlock}>
        <p className={`${styles.entryName} ${isMe ? styles.entryNameMe : ''}`}>
          {entry.name}
          {isMe && <span className={styles.meTag}>(vos)</span>}
        </p>
        <p className={styles.entryMatches}>
          {entry.validated_match_count} partido{entry.validated_match_count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ELO */}
      <div className={styles.eloBlock}>
        <span className={`${styles.eloValue} ${isMe ? styles.eloValueMe : ''}`} aria-label={`ELO: ${entry.elo}`}>
          {entry.elo}
        </span>
        <CategoryBadge elo={entry.elo} />
      </div>
    </div>
  )
}

// ─── Region Picker ─────────────────────────────────────────────────────────────

interface Region { id: number; name: string }

function RegionPicker({
  regions,
  selectedRegionId,
  loading,
  onSelect,
  onClose,
}: {
  regions: Region[]
  selectedRegionId: number | null
  loading: boolean
  onSelect: (id: number | null) => void
  onClose: () => void
}) {
  const all = [{ id: null as number | null, name: 'Todas las regiones' }, ...regions]

  return (
    <div
      className={styles.pickerBackdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar región"
    >
      <div className={styles.pickerSheet}>
        <div className={styles.pickerHandle} />
        <p className={styles.pickerTitle}>Seleccionar región</p>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <Spinner size="md" />
          </div>
        ) : (
          <div className={styles.pickerList}>
            {all.map((r) => {
              const isActive = r.id === selectedRegionId
              return (
                <button
                  key={r.id ?? 'all'}
                  className={`${styles.pickerItem} ${isActive ? styles.pickerItemActive : ''}`}
                  onClick={() => { onSelect(r.id); onClose() }}
                >
                  <MapPin size={15} className={styles.pickerCheck} style={{ opacity: isActive ? 1 : 0.3 }} />
                  {r.name}
                  {isActive && <Check size={14} className={styles.pickerCheck} style={{ marginLeft: 'auto' }} />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Rankings Page ─────────────────────────────────────────────────────────────

export function RankingsPage() {
  const [pickerOpen, setPickerOpen]     = useState(false)
  const [isRefreshing, startTransition] = useTransition()

  const selectedRegionId = useRankingsStore((s) => s.selectedRegionId)
  const regions          = useRankingsStore((s) => s.regions)
  const rankings         = useRankingsStore((s) => s.rankings)
  const myPosition       = useRankingsStore((s) => s.myPosition)
  const loading          = useRankingsStore((s) => s.loading)
  const regionsLoading   = useRankingsStore((s) => s.regionsLoading)
  const error            = useRankingsStore((s) => s.error)
  const fetchRegions     = useRankingsStore((s) => s.fetchRegions)
  const fetchRankings    = useRankingsStore((s) => s.fetchRankings)
  const setRegion        = useRankingsStore((s) => s.setRegion)
  const clearError       = useRankingsStore((s) => s.clearError)
  const refresh          = useRankingsStore((s) => s.refresh)
  const genderFilter     = useRankingsStore((s) => s.genderFilter)
  const setGenderFilter  = useRankingsStore((s) => s.setGenderFilter)
  const user             = useAuthStore((s) => s.user)

  useEffect(() => {
    void fetchRegions()
    void fetchRankings()
  }, [fetchRegions, fetchRankings])

  const activeRegionLabel =
    selectedRegionId === null
      ? 'Todas las regiones'
      : (regions.find((r) => r.id === selectedRegionId)?.name ?? 'Región')

  const handleRefresh = () => {
    startTransition(() => { void refresh() })
  }

  const handleRetry = () => {
    clearError()
    void fetchRankings()
  }

  const GENDER_TABS = [
    { value: null as null | 'male' | 'female',   label: 'Todos' },
    { value: 'male'   as const,                  label: 'Masculino' },
    { value: 'female' as const,                  label: 'Femenino' },
  ]

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Rankings</h1>
        <button
          className={styles.regionBtn}
          onClick={() => setPickerOpen(true)}
          aria-label="Cambiar región"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <MapPin size={14} className={styles.regionIcon} />
          <span className={styles.regionLabel}>{activeRegionLabel}</span>
          {regionsLoading && <Spinner size="sm" />}
        </button>
      </div>

      <div className={styles.body}>
        {/* ── Gender tabs ── */}
        <div className={styles.genderTabs} role="tablist" aria-label="Filtrar por género">
          {GENDER_TABS.map((tab) => (
            <button
              key={tab.label}
              role="tab"
              aria-selected={genderFilter === tab.value}
              className={`${styles.genderTab} ${genderFilter === tab.value ? styles.genderTabActive : ''}`}
              onClick={() => setGenderFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Sub-header ── */}
        <div className={styles.subHeader}>
          <p className={styles.regionHint}>
            Top jugadores ·{' '}
            <span className={styles.regionHintAccent}>{activeRegionLabel}</span>
          </p>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            aria-label="Actualizar ranking"
          >
            <RefreshCw
              size={13}
              className={isRefreshing || loading ? styles.spinning : ''}
            />
            Actualizar
          </button>
        </div>

        {/* ── Error ── */}
        {error && !loading && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={18} className={styles.errorIcon} />
            <div className={styles.errorBody}>
              <p className={styles.errorTitle}>Error al cargar</p>
              <p className={styles.errorMsg}>{error}</p>
            </div>
            <button className={styles.retryBtn} onClick={handleRetry}>Reintentar</button>
          </div>
        )}

        {/* ── Table ── */}
        {!error && (
          <div className={styles.tableCard} role="grid" aria-label="Tabla de ranking">
            {loading ? (
              <SkeletonEntries />
            ) : rankings.length === 0 ? (
              <div className={styles.emptyWrap}>
                <div className={styles.emptyIcon}>
                  <Trophy size={30} />
                </div>
                <p className={styles.emptyTitle}>Sin jugadores en esta región</p>
                <p className={styles.emptySubtitle}>
                  Sé el primero en jugar y aparecer en el ranking de tu zona
                </p>
              </div>
            ) : (
              <>
                {rankings.map((entry, i) => (
                  <RankEntry
                    key={entry.player_id ?? i}
                    entry={entry}
                    isMe={entry.player_id === user?.id}
                    index={i}
                  />
                ))}
                {myPosition && !rankings.some((r) => r.player_id === user?.id) && (
                  <RankEntry
                    entry={myPosition}
                    isMe
                    isFooter
                    index={rankings.length}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Region picker ── */}
      {pickerOpen && (
        <RegionPicker
          regions={regions}
          selectedRegionId={selectedRegionId}
          loading={regionsLoading}
          onSelect={setRegion}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
