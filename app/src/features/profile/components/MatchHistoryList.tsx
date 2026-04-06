import { TrendingDown, TrendingUp } from 'lucide-react'
import type { MatchHistoryEntry } from '@/types'
import { Button } from '@/components/ui/Button'
import { timeAgo } from '@/lib/utils'

interface MatchHistoryListProps {
  matches: MatchHistoryEntry[]
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}

interface MatchCardProps {
  match: MatchHistoryEntry
}

function MatchCard({ match }: MatchCardProps) {
  const isPositive = match.elo_delta >= 0

  return (
    <div className="bg-bg-card border border-border rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        {/* Teams */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {match.won ? (
              <span className="text-trust-high text-xs font-semibold uppercase tracking-wide">
                Victoria
              </span>
            ) : (
              <span className="text-trust-low text-xs font-semibold uppercase tracking-wide">
                Derrota
              </span>
            )}
            <span className="text-text-secondary text-xs">{timeAgo(match.played_at)}</span>
          </div>

          <p className="text-text-primary text-sm font-medium truncate">
            {match.team1.join(' & ')}
          </p>
          <p className="text-text-secondary text-xs mb-1">vs</p>
          <p className="text-text-secondary text-sm truncate">{match.team2.join(' & ')}</p>
        </div>

        {/* Result + ELO delta */}
        <div className="shrink-0 text-right">
          <p className="text-text-primary font-bold text-sm mb-1">{match.result}</p>
          <div
            className={[
              'flex items-center gap-0.5 justify-end text-xs font-semibold',
              isPositive ? 'text-trust-high' : 'text-trust-low',
            ].join(' ')}
          >
            {isPositive ? (
              <TrendingUp size={12} aria-hidden="true" />
            ) : (
              <TrendingDown size={12} aria-hidden="true" />
            )}
            <span>{isPositive ? `+${match.elo_delta}` : match.elo_delta}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MatchHistoryList({ matches, hasMore, loading, onLoadMore }: MatchHistoryListProps) {
  if (matches.length === 0 && !loading) {
    return (
      <div className="text-center py-8 text-text-secondary text-sm">
        Sin partidos jugados aún
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}

      {hasMore && (
        <Button
          variant="ghost"
          fullWidth
          loading={loading}
          onClick={onLoadMore}
          className="mt-2"
        >
          Cargar más partidos
        </Button>
      )}
    </div>
  )
}
