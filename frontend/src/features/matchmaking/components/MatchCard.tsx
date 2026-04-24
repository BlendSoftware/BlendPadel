import { Calendar, MapPin, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import type { MatchDetail, MatchStatus } from '../types'
import styles from './MatchCard.module.css'

interface MatchCardProps {
  match: MatchDetail
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<MatchStatus, string> = {
  pending_result:        'Pend. resultado',
  awaiting_confirmation: 'Esperando confirm.',
  sealed:                'Sellado',
  disputed:              'Disputado',
  cancelled:             'Cancelado',
}

const STATUS_CSS: Record<MatchStatus, string> = {
  pending_result:        styles.statusPending,
  awaiting_confirmation: styles.statusPending,
  sealed:                styles.statusSealed,
  disputed:              styles.statusDisputed,
  cancelled:             styles.statusCancelled,
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function avgElo(players: MatchDetail['team_a']): number {
  if (players.length === 0) return 0
  return Math.round(players.reduce((s, p) => s + p.elo, 0) / players.length)
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MatchCard({ match }: MatchCardProps) {
  const navigate = useNavigate()

  return (
    <button
      className={styles.card}
      onClick={() => navigate(`/matches/${match.id}`)}
      aria-label={`Ver partido del ${formatDate(match.scheduled_at)}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.dateChip}>
          <Calendar size={12} className={styles.dateIcon} />
          {formatDate(match.scheduled_at)}
        </span>
        <div className={styles.headerRight}>
          {match.match_type === 'female' && (
            <span className={`${styles.typeBadge} ${styles.typeFemale}`}>Femenino</span>
          )}
          {match.match_type === 'mixed' && (
            <span className={`${styles.typeBadge} ${styles.typeMixed}`}>Mixto</span>
          )}
          <span className={`${styles.statusBadge} ${STATUS_CSS[match.status]}`}>
            {STATUS_LABELS[match.status]}
          </span>
        </div>
      </div>

      {/* Teams */}
      <div className={styles.teamsRow}>
        {/* Team A */}
        <div className={styles.team}>
          <div className={styles.avatarStack}>
            {match.team_a.map((p) => (
              <Avatar key={p.id} src={p.avatar_url} name={p.name} size="xs" />
            ))}
          </div>
          <p className={styles.teamNames}>
            {match.team_a.map((p) => p.name).join(' & ')}
          </p>
          {match.team_a.length > 0 && <CategoryBadge elo={avgElo(match.team_a)} />}
        </div>

        {/* Divider */}
        <div className={styles.vsBlock}>
          {match.result ? (
            <p className={styles.score}>
              {match.result.sets.map((s) => `${s.team_a_games}-${s.team_b_games}`).join(' ')}
            </p>
          ) : (
            <p className={styles.vsLabel}>vs</p>
          )}
        </div>

        {/* Team B */}
        <div className={styles.team}>
          <div className={styles.avatarStack}>
            {match.team_b.map((p) => (
              <Avatar key={p.id} src={p.avatar_url} name={p.name} size="xs" />
            ))}
          </div>
          <p className={styles.teamNames}>
            {match.team_b.map((p) => p.name).join(' & ')}
          </p>
          {match.team_b.length > 0 && <CategoryBadge elo={avgElo(match.team_b)} />}
        </div>
      </div>

      {/* Location */}
      {match.latitude !== null && (
        <div className={styles.locationRow}>
          <MapPin size={11} />
          <span>Ubicación disponible</span>
        </div>
      )}

      {/* Arrow */}
      <ArrowRight size={14} className={styles.arrow} />
    </button>
  )
}
