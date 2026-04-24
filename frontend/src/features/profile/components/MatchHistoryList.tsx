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
  const isSealed = match.status === 'sealed'
  const winnerTeam = match.winner_team
  const sets = match.sets ?? []
  const totalA = match.total_games_a ?? 0
  const totalB = match.total_games_b ?? 0
  const gameDiff = match.game_diff ?? 0

  return (
    <div className="bg-bg-card border border-border rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        {/* Teams */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {isSealed && winnerTeam ? (
              <span className="text-trust-high text-xs font-semibold uppercase tracking-wide">
                Equipo {winnerTeam}
              </span>
            ) : (
              <span className="text-text-secondary text-xs font-semibold uppercase tracking-wide">
                {match.status === 'disputed' ? 'Disputado' : match.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
              </span>
            )}
            <span className="text-text-secondary text-xs">{timeAgo(match.scheduled_at)}</span>
          </div>

          <p className="text-text-primary text-sm font-medium">
            Equipo A ({totalA} juegos)
          </p>
          <p className="text-text-secondary text-xs mb-1">vs</p>
          <p className="text-text-secondary text-sm">
            Equipo B ({totalB} juegos)
          </p>
        </div>

        {/* Sets */}
        <div className="shrink-0 text-right">
          <p className="text-text-primary font-bold text-sm mb-1">{match.match_type ?? '—'}</p>
          {sets.map((s, i) => (
            <p key={i} className="text-xs text-text-secondary tabular-nums">
              {s.team_a_games}–{s.team_b_games}
            </p>
          ))}
          {gameDiff !== 0 && (
            <div
              className={[
                'flex items-center gap-0.5 justify-end text-xs font-semibold mt-0.5',
                gameDiff > 0 ? 'text-trust-high' : 'text-trust-low',
              ].join(' ')}
            >
              {gameDiff > 0 ? (
                <TrendingUp size={12} aria-hidden="true" />
              ) : (
                <TrendingDown size={12} aria-hidden="true" />
              )}
              <span>{gameDiff > 0 ? `+${gameDiff}` : gameDiff}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function MatchHistoryList({ matches, hasMore, loading, onLoadMore }: MatchHistoryListProps) {
  const safeMatches = matches ?? []
  if (safeMatches.length === 0 && !loading) {
    return (
      <div className="text-center py-8 text-text-secondary text-sm">
        Sin partidos jugados aún
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {safeMatches.map((match) => (
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
