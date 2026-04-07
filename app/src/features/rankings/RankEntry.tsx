import { ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import type { RankingEntry } from '@/types'

interface RankEntryProps {
  entry: RankingEntry
  isMe: boolean
  /** If true, renders as the sticky "my position" footer row */
  isFooter?: boolean
  /** Visual index (0-based) for alternating row colors */
  index: number
}

const MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

type TrustLevel = 'high' | 'medium' | 'low'

function trustLevelFromScore(score?: number): TrustLevel {
  if (score === undefined) return 'medium'
  if (score >= 90) return 'high'
  if (score >= 70) return 'medium'
  return 'low'
}

function trustBadgeVariant(level: TrustLevel): 'trust-high' | 'trust-medium' | 'trust-low' {
  if (level === 'high') return 'trust-high'
  if (level === 'medium') return 'trust-medium'
  return 'trust-low'
}

function trustBadgeLabel(level: TrustLevel): string {
  if (level === 'high') return 'Excelente'
  if (level === 'medium') return 'Bueno'
  return 'Bajo'
}

export function RankEntry({ entry, isMe, isFooter = false, index }: RankEntryProps) {
  const medal = MEDALS[entry.rank]

  const rowBg = isMe
    ? 'bg-padel-green/10 border-l-2 border-l-padel-green'
    : index % 2 === 0
      ? 'bg-bg-dark'
      : 'bg-bg-card'

  const footerClasses = isFooter
    ? 'border-t border-border'
    : ''

  const trustLevel = trustLevelFromScore(entry.trust_score)

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3 min-h-[60px]',
        rowBg,
        footerClasses,
      ].join(' ')}
      role="row"
      aria-current={isMe ? 'true' : undefined}
    >
      {/* Rank / Medal */}
      <div
        className="w-7 text-center shrink-0 select-none"
        aria-label={`Posición ${entry.rank}`}
      >
        {medal ? (
          <span className="text-lg leading-none">{medal}</span>
        ) : (
          <span className="text-sm font-bold text-text-secondary tabular-nums">
            {entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <Avatar
        src={undefined}
        name={entry.name}
        size="md"
      />

      {/* Name + match count */}
      <div className="flex-1 min-w-0">
        <p
          className={[
            'text-sm font-semibold truncate',
            isMe ? 'text-padel-green' : 'text-text-primary',
          ].join(' ')}
        >
          {entry.name}
          {isMe && (
            <span className="ml-1.5 text-xs font-normal text-padel-green/70">(vos)</span>
          )}
        </p>
        <p className="text-xs text-text-secondary truncate">
          {entry.validated_match_count} partido{entry.validated_match_count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ELO + category + trust badge */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <CategoryBadge elo={entry.elo} showFull />
          <span
            className={[
              'text-sm font-bold tabular-nums',
              isMe ? 'text-padel-green' : 'text-text-primary',
            ].join(' ')}
            aria-label={`ELO: ${entry.elo}`}
          >
            {entry.elo}
          </span>
        </div>
        {entry.trust_score !== undefined && (
          <Badge variant={trustBadgeVariant(trustLevel)} className="gap-0.5">
            <ShieldCheck size={9} aria-hidden="true" />
            {trustBadgeLabel(trustLevel)}
          </Badge>
        )}
      </div>
    </div>
  )
}
