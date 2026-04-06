import { Trophy } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from './SkeletonRow'
import { RankEntry } from './RankEntry'
import type { RankingEntry } from '@/types'

interface RankingTableProps {
  rankings: RankingEntry[]
  myPosition: RankingEntry | null
  currentUserId: string | null
  loading: boolean
}

const SKELETON_COUNT = 7

export function RankingTable({ rankings, myPosition, currentUserId, loading }: RankingTableProps) {
  if (loading && rankings.length === 0) {
    return (
      <div
        className="rounded-xl border border-border overflow-hidden"
        role="status"
        aria-label="Cargando ranking..."
      >
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    )
  }

  if (!loading && rankings.length === 0) {
    return (
      <EmptyState
        icon={<Trophy size={40} />}
        title="Sin jugadores en esta región"
        subtitle="Sé el primero en jugar y aparecer en el ranking de tu zona"
      />
    )
  }

  // Determine if "my position" is already visible in the top list
  const myRankIsVisible =
    myPosition !== null &&
    rankings.some((r) => r.player_id === myPosition.player_id)

  const showStickyFooter = myPosition !== null && !myRankIsVisible

  return (
    <div className="rounded-xl border border-border overflow-hidden" role="table" aria-label="Tabla de rankings">
      <div role="rowgroup">
        {rankings.map((entry, index) => (
          <RankEntry
            key={entry.player_id}
            entry={entry}
            isMe={entry.player_id === currentUserId}
            index={index}
          />
        ))}
      </div>

      {/* Sticky footer: current user's position if not in visible list */}
      {showStickyFooter && (
        <div role="rowgroup">
          <div className="flex items-center justify-center py-1.5 bg-bg-input">
            <span className="text-[10px] text-text-secondary uppercase tracking-wider font-medium">
              Tu posición
            </span>
          </div>
          <RankEntry
            entry={myPosition}
            isMe
            isFooter
            index={0}
          />
        </div>
      )}
    </div>
  )
}
