import { useEffect } from 'react'
import { Zap, Activity } from 'lucide-react'
import { useFeedStore } from '@/stores/feed-store'
import { useAuthStore } from '@/stores/auth-store'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { FeedItem } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `hace ${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'ayer'
  if (diffDays < 7) return `hace ${diffDays} días`

  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks === 1) return 'hace 1 semana'
  return `hace ${diffWeeks} semanas`
}

function renderEventDescription(item: FeedItem): string {
  const content = item.content ?? {}
  switch (item.event_type) {
    case 'win_streak':
      return `ganó ${content.streak ?? '?'} partidos seguidos!`
    case 'match_milestone':
      return `alcanzó ${content.milestone ?? '?'} partidos validados!`
    default:
      return 'tuvo actividad reciente'
  }
}

function eventIcon(type: FeedItem['event_type']): string {
  switch (type) {
    case 'win_streak':
      return '🔥'
    case 'match_milestone':
      return '🏆'
    default:
      return '⚡'
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FeedPage() {
  const regionId = useAuthStore((s) => s.user?.region_id)

  const items = useFeedStore((s) => s.items)
  const isLoading = useFeedStore((s) => s.isLoading)
  const error = useFeedStore((s) => s.error)
  const fetchFeed = useFeedStore((s) => s.fetchFeed)
  const clearError = useFeedStore((s) => s.clearError)

  useEffect(() => {
    clearError()
    if (regionId) {
      fetchFeed(regionId)
    }
  }, [regionId, fetchFeed, clearError])

  return (
    <div className="flex flex-col min-h-full page-enter">
      <Header title="Actividad" />

      <div className="px-4 pt-4 pb-6 space-y-3">
        {/* Loading */}
        {isLoading && items.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-8">
            <p className="text-text-secondary text-sm mb-4">{error}</p>
            <Button variant="outline" onClick={() => regionId && fetchFeed(regionId)}>
              Reintentar
            </Button>
          </div>
        )}

        {/* No region */}
        {!regionId && !isLoading && (
          <EmptyState
            icon={<Activity size={48} />}
            title="Sin región asignada"
            subtitle="Necesitás tener una región para ver la actividad de tu zona"
          />
        )}

        {/* Empty */}
        {!isLoading && !error && regionId && items.length === 0 && (
          <EmptyState
            icon={<Zap size={48} />}
            title="No hay actividad reciente en tu zona"
            subtitle="Cuando los jugadores logren rachas o hitos, van a aparecer acá"
          />
        )}

        {/* Feed items */}
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">
                {eventIcon(item.event_type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">
                  <span className="font-semibold">{item.player_name}</span>{' '}
                  {renderEventDescription(item)}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {formatTimeAgo(item.created_at)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
