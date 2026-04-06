import { MapPin, Clock, MessageCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import type { Flare } from '../types'

interface FlareCardProps {
  flare: Flare
  onRespond: (flare: Flare) => void
  isResponding?: boolean
}

function formatScheduledAt(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type TrustLevel = 'high' | 'medium' | 'low'

function trustLevelFromScore(score: number): TrustLevel {
  if (score >= 90) return 'high'
  if (score >= 70) return 'medium'
  return 'low'
}

function trustVariant(level: TrustLevel): 'trust-high' | 'trust-medium' | 'trust-low' {
  return `trust-${level}` as const
}

function trustLabel(level: TrustLevel): string {
  const labels = { high: 'Confiable', medium: 'Neutro', low: 'Bajo' }
  return labels[level]
}

export function FlareCard({ flare, onRespond, isResponding = false }: FlareCardProps) {
  // Backend returns creator_name (not a player object)
  const name = flare.creator_name ?? flare.player?.name ?? 'Jugador'
  const elo = flare.player?.elo ?? flare.elo_min ?? 0
  const trustScore = flare.player?.trust_score ?? 80
  const trustLevel = trustLevelFromScore(trustScore)
  const hasLocation = (flare.lat ?? flare.latitude) !== null && (flare.lat ?? flare.latitude) !== 0

  return (
    <article className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
      {/* Player row */}
      <div className="flex items-start gap-3">
        <Avatar
          name={name}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary truncate">
              {name}
            </span>
            <Badge variant={trustVariant(trustLevel)}>
              {trustLabel(trustLevel)}
            </Badge>
            {flare.match_type === 'female' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-400 border border-pink-500/30">
                F
              </span>
            )}
            {flare.match_type === 'mixed' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30">
                Mixto
              </span>
            )}
          </div>
        </div>
        {elo > 0 && (
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <CategoryBadge elo={elo} />
            <p className="text-sm font-bold text-padel-green tabular-nums">{elo}</p>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Clock size={12} aria-hidden="true" />
          <span>{formatScheduledAt(flare.scheduled_at)}</span>
        </div>
        {hasLocation && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <MapPin size={12} aria-hidden="true" />
            <span>Ubicación disponible</span>
          </div>
        )}
        {flare.message && (
          <div className="flex items-start gap-2 text-xs text-text-secondary">
            <MessageCircle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{flare.message}</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <Button
        variant="outline"
        size="sm"
        fullWidth
        loading={isResponding}
        onClick={() => onRespond(flare)}
      >
        Aceptar desafío
      </Button>
    </article>
  )
}
