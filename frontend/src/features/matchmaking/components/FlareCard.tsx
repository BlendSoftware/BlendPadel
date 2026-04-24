import { MapPin, Clock, ArrowRight, Zap, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import type { Flare } from '../types'
import styles from './FlareCard.module.css'

interface FlareCardProps {
  flare: Flare
  onRespond: (flare: Flare) => void
  isResponding?: boolean
}

function formatScheduledAt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

type TrustLevel = 'high' | 'medium' | 'low'

function trustLevel(score: number): TrustLevel {
  if (score >= 90) return 'high'
  if (score >= 70) return 'medium'
  return 'low'
}

const trustLabels = { high: 'Confiable', medium: 'Neutro', low: 'Bajo' }
const trustCss    = { high: styles.trustHigh, medium: styles.trustMedium, low: styles.trustLow }

export function FlareCard({ flare, onRespond, isResponding = false }: FlareCardProps) {
  const name       = flare.creator_name ?? flare.player?.name ?? 'Jugador'
  const elo        = flare.player?.elo ?? flare.elo_min ?? 0
  const trustScore = flare.player?.trust_score ?? 80
  const level      = trustLevel(trustScore)
  const hasLoc     = flare.lat !== 0 && flare.lng !== 0
  const joined     = flare.respondent_count ?? 0
  const needed     = flare.min_players ?? 4
  const isFull     = joined >= needed
  const slotsLeft  = Math.max(0, needed - joined)
  const progressPct = Math.min(100, Math.round((joined / needed) * 100))

  return (
    <article className={styles.card}>
      {/* Accent strip */}
      <div className={styles.accent} />

      {/* Player row */}
      <div className={styles.playerRow}>
        <Avatar name={name} size="md" />

        <div className={styles.playerInfo}>
          <div className={styles.playerNameRow}>
            <span className={styles.playerName}>{name}</span>
            <span className={`${styles.trustBadge} ${trustCss[level]}`}>
              {trustLabels[level]}
            </span>
            {flare.match_type === 'female' && (
              <span className={`${styles.typeBadge} ${styles.typeFemale}`}>Femenino</span>
            )}
            {flare.match_type === 'mixed' && (
              <span className={`${styles.typeBadge} ${styles.typeMixed}`}>Mixto</span>
            )}
          </div>
          <CategoryBadge elo={elo} />
        </div>

        {elo > 0 && (
          <div className={styles.eloBlock}>
            <span className={styles.eloNum}>{elo}</span>
          </div>
        )}
      </div>

      {/* Detail chips */}
      <div className={styles.details}>
        <span className={styles.detailChip}>
          <Clock size={12} className={styles.detailChipIcon} />
          {formatScheduledAt(flare.scheduled_at)}
        </span>
        <span
          className={styles.detailChip}
          style={{ color: slotsLeft === 1 ? '#ff9666' : undefined, fontWeight: slotsLeft === 1 ? 600 : undefined }}
          aria-label={`${joined} de ${needed} jugadores inscriptos`}
        >
          <Users size={12} className={styles.detailChipIcon} />
          {joined}/{needed} jugadores{slotsLeft === 1 ? ' · ¡Falta 1!' : ''}
        </span>
        {hasLoc && (
          <span className={styles.detailChip}>
            <MapPin size={12} className={styles.detailChipIcon} />
            Ubicación disponible
          </span>
        )}
      </div>

      {/* Progress bar (inscripción) */}
      <div
        style={{
          height: 3,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
          margin: '6px 0 10px',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: '100%',
            background: isFull ? '#d7ff2d' : slotsLeft === 1 ? '#ff9666' : 'rgba(215,255,45,0.55)',
            transition: 'width 260ms ease-out',
          }}
        />
      </div>

      {/* CTA */}
      <button
        className={styles.cta}
        onClick={() => onRespond(flare)}
        disabled={isResponding || isFull}
        aria-label={`Aceptar desafío de ${name}`}
      >
        <Zap size={14} strokeWidth={2.5} />
        {isFull ? 'Desafío completo' : 'Aceptar desafío'}
        {!isFull && <ArrowRight size={14} />}
      </button>
    </article>
  )
}
