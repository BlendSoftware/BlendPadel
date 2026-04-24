import { MapPin, Clock, ArrowRight, Zap } from 'lucide-react'
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
        {hasLoc && (
          <span className={styles.detailChip}>
            <MapPin size={12} className={styles.detailChipIcon} />
            Ubicación disponible
          </span>
        )}
      </div>

      {/* CTA */}
      <button
        className={styles.cta}
        onClick={() => onRespond(flare)}
        disabled={isResponding}
        aria-label={`Aceptar desafío de ${name}`}
      >
        <Zap size={14} strokeWidth={2.5} />
        Aceptar desafío
        <ArrowRight size={14} />
      </button>
    </article>
  )
}
