import { useEffect } from 'react'
import { Zap, Activity, RefreshCw } from 'lucide-react'
import { useFeedStore } from '@/stores/feed-store'
import { useAuthStore } from '@/stores/auth-store'
import { useRankingsStore } from '@/stores/rankings-store'
import { Spinner } from '@/components/ui/Spinner'
import type { FeedItem } from '@/types'

import styles from './FeedPage.module.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const diffMs  = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)   return 'ahora'
  if (diffMin < 60)  return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)    return `hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1)   return 'ayer'
  if (diffD < 7)     return `hace ${diffD} días`
  return `hace ${Math.floor(diffD / 7)} semanas`
}

function eventDescription(item: FeedItem): string {
  const c = item.content ?? {}
  switch (item.event_type) {
    case 'win_streak':       return `ganó ${c.streak ?? '?'} partidos seguidos`
    case 'match_milestone':  return `alcanzó ${c.milestone ?? '?'} partidos validados`
    default:                 return 'tuvo actividad reciente'
  }
}

function eventEmoji(type: FeedItem['event_type']): string {
  switch (type) {
    case 'win_streak':      return '🔥'
    case 'match_milestone': return '🏆'
    default:                return '⚡'
  }
}

function eventBadgeLabel(type: FeedItem['event_type']): string {
  switch (type) {
    case 'win_streak':      return 'Racha'
    case 'match_milestone': return 'Hito'
    default:                return 'Actividad'
  }
}

function eventBadgeCss(type: FeedItem['event_type']): string {
  switch (type) {
    case 'win_streak':      return styles.badgeStreak
    case 'match_milestone': return styles.badgeMilestone
    default:                return styles.badgeDefault
  }
}

// ─── FeedItem Card ─────────────────────────────────────────────────────────────

function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  return (
    <div
      className={styles.feedItem}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={styles.feedItemAccent} />

      <div className={styles.eventEmoji} aria-hidden="true">
        {eventEmoji(item.event_type)}
      </div>

      <div className={styles.feedItemBody}>
        <p className={styles.feedItemText}>
          <span className={styles.feedItemName}>{item.player_name}</span>
          {' '}{eventDescription(item)}!
        </p>
        <p className={styles.feedItemTime}>{formatTimeAgo(item.created_at)}</p>
      </div>

      <span className={`${styles.eventTypeBadge} ${eventBadgeCss(item.event_type)}`}>
        {eventBadgeLabel(item.event_type)}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FeedPage() {
  const userRegionId     = useAuthStore((s) => s.user?.region_id)
  const selectedRegionId = useRankingsStore((s) => s.selectedRegionId)
  const regionId         = userRegionId ?? selectedRegionId

  const items      = useFeedStore((s) => s.items)
  const isLoading  = useFeedStore((s) => s.isLoading)
  const error      = useFeedStore((s) => s.error)
  const fetchFeed  = useFeedStore((s) => s.fetchFeed)
  const clearError = useFeedStore((s) => s.clearError)

  useEffect(() => {
    clearError()
    if (regionId) fetchFeed(regionId)
  }, [regionId, fetchFeed, clearError])

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div>
          <p className={styles.kicker}>Actividad</p>
          <h1 className={styles.pageTitle}>FEED</h1>
        </div>
      </div>

      <div className={styles.body}>
        {/* Loading */}
        {isLoading && items.length === 0 && (
          <div className={styles.loadingWrap}>
            <Spinner size="lg" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className={styles.errorWrap}>
            <p className={styles.errorText}>{error}</p>
            <button
              className={styles.retryBtn}
              onClick={() => regionId && fetchFeed(regionId)}
            >
              <RefreshCw size={13} /> Reintentar
            </button>
          </div>
        )}

        {/* No region */}
        {!regionId && !isLoading && (
          <div className={styles.emptyWrap}>
            <div className={styles.emptyIconWrap}>
              <Activity size={30} />
            </div>
            <p className={styles.emptyTitle}>Sin región asignada</p>
            <p className={styles.emptySubtitle}>
              Necesitás tener una región para ver la actividad de tu zona
            </p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && regionId && items.length === 0 && (
          <div className={styles.emptyWrap}>
            <div className={styles.emptyIconWrap}>
              <Zap size={30} />
            </div>
            <p className={styles.emptyTitle}>No hay actividad reciente en tu zona</p>
            <p className={styles.emptySubtitle}>
              Cuando los jugadores logren rachas o hitos, van a aparecer acá
            </p>
          </div>
        )}

        {/* Items */}
        {items.length > 0 && (
          <>
            <p className={styles.sectionLabel}>Actividad reciente</p>
            {items.map((item, i) => (
              <FeedCard key={item.id} item={item} index={i} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
