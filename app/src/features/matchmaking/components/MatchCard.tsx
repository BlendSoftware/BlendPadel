import { Calendar, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import type { MatchDetail, MatchStatus } from '../types'

interface MatchCardProps {
  match: MatchDetail
}

type BadgeVariant = 'green' | 'blue' | 'orange' | 'gray' | 'trust-low'

function statusLabel(status: MatchStatus): string {
  const labels: Record<MatchStatus, string> = {
    scheduled: 'Programado',
    pending_result: 'Pendiente resultado',
    awaiting_confirmation: 'Esperando confirmación',
    sealed: 'Sellado',
    disputed: 'Disputado',
    cancelled: 'Cancelado',
  }
  return labels[status]
}

function statusVariant(status: MatchStatus): BadgeVariant {
  const variants: Record<MatchStatus, BadgeVariant> = {
    scheduled: 'blue',
    pending_result: 'orange',
    awaiting_confirmation: 'orange',
    sealed: 'green',
    disputed: 'trust-low',
    cancelled: 'gray',
  }
  return variants[status]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function avgElo(players: MatchDetail['team_a']): number {
  if (players.length === 0) return 0
  return Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length)
}

function PlayerAvatarRow({ players }: { players: MatchDetail['team_a'] }) {
  return (
    <div className="flex -space-x-2">
      {players.map((p) => (
        <Avatar key={p.id} src={p.avatar_url} name={p.name} size="xs" />
      ))}
    </div>
  )
}

export function MatchCard({ match }: MatchCardProps) {
  const navigate = useNavigate()

  return (
    <button
      className="w-full text-left bg-bg-card rounded-xl border border-border p-4 space-y-3 min-h-11 hover:border-border/80 hover:bg-bg-input transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
      onClick={() => navigate(`/matches/${match.id}`)}
      aria-label={`Ver partido del ${formatDate(match.scheduled_at)}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar size={14} aria-hidden="true" className="text-text-secondary shrink-0" />
          <span className="text-sm text-text-secondary">{formatDate(match.scheduled_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {match.match_type === 'female' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-400 border border-pink-500/30">
              F
            </span>
          )}
          {match.match_type === 'mixed' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30">
              Mixto
            </span>
          )}
          <Badge variant={statusVariant(match.status)}>
            {statusLabel(match.status)}
          </Badge>
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <PlayerAvatarRow players={match.team_a} />
          <p className="text-xs text-text-secondary text-center">
            {match.team_a.map((p) => p.name).join(' & ')}
          </p>
          {match.team_a.length > 0 && (
            <CategoryBadge elo={avgElo(match.team_a)} />
          )}
        </div>

        <div className="shrink-0 text-center">
          {match.result ? (
            <p className="text-base font-bold text-text-primary">
              {match.result.sets.map((s) => `${s.team_a_games}-${s.team_b_games}`).join(' / ')}
            </p>
          ) : (
            <p className="text-sm font-bold text-text-secondary">vs</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <PlayerAvatarRow players={match.team_b} />
          <p className="text-xs text-text-secondary text-center">
            {match.team_b.map((p) => p.name).join(' & ')}
          </p>
          {match.team_b.length > 0 && (
            <CategoryBadge elo={avgElo(match.team_b)} />
          )}
        </div>
      </div>

      {/* Location */}
      {match.latitude !== null && (
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <MapPin size={11} aria-hidden="true" />
          <span>Ubicación disponible</span>
        </div>
      )}
    </button>
  )
}
