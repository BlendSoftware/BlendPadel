import { TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useRankingsStore } from '@/stores/rankings-store'
import type { MatchProjection } from '@/types'

// ─── Presentational variant ───────────────────────────────────────────────────

interface ProjectionCardViewProps {
  projection: MatchProjection
  className?: string
}

export function ProjectionCardView({ projection, className = '' }: ProjectionCardViewProps) {
  const { win_delta, loss_delta } = projection

  return (
    <div
      className={[
        'rounded-xl border border-border bg-bg-card p-4',
        className,
      ].join(' ')}
      role="region"
      aria-label="Proyección de puntos ELO"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Zap size={14} className="text-padel-green" aria-hidden="true" />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Proyección ELO
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Win delta */}
        <div className="flex flex-col items-center gap-1.5 rounded-lg bg-padel-green/10 border border-padel-green/20 py-3 px-2">
          <TrendingUp size={18} className="text-padel-green" aria-hidden="true" />
          <span className="text-lg font-bold text-padel-green tabular-nums leading-none">
            +{win_delta}
          </span>
          <span className="text-[11px] text-padel-green/70 font-medium">Si ganás</span>
        </div>

        {/* Loss delta */}
        <div className="flex flex-col items-center gap-1.5 rounded-lg bg-trust-low/10 border border-trust-low/20 py-3 px-2">
          <TrendingDown size={18} className="text-trust-low" aria-hidden="true" />
          <span className="text-lg font-bold text-trust-low tabular-nums leading-none">
            -{Math.abs(loss_delta)}
          </span>
          <span className="text-[11px] text-trust-low/70 font-medium">Si perdés</span>
        </div>
      </div>
    </div>
  )
}

// ─── Connected variant (fetches on demand) ────────────────────────────────────

interface ProjectionCardProps {
  teamA: number[]
  teamB: number[]
  className?: string
}

export function ProjectionCard({ teamA, teamB, className = '' }: ProjectionCardProps) {
  const projection = useRankingsStore((s) => s.projection)
  const projectionLoading = useRankingsStore((s) => s.projectionLoading)
  const fetchProjection = useRankingsStore((s) => s.fetchProjection)

  // Fetch when component mounts with valid team data
  const hasValidTeams = teamA.length > 0 && teamB.length > 0

  if (!hasValidTeams) return null

  if (projectionLoading) {
    return (
      <div
        className={[
          'rounded-xl border border-border bg-bg-card p-4 flex items-center justify-center min-h-[100px]',
          className,
        ].join(' ')}
        aria-label="Calculando proyección..."
      >
        <Spinner size="sm" />
      </div>
    )
  }

  if (!projection) {
    return (
      <button
        onClick={() => void fetchProjection(teamA, teamB)}
        className={[
          'w-full rounded-xl border border-border bg-bg-card p-4 text-center min-h-11',
          'text-sm text-text-secondary hover:text-padel-green hover:border-padel-green/40 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
          className,
        ].join(' ')}
      >
        <Zap size={14} className="inline mr-1.5" aria-hidden="true" />
        Ver proyección de puntos ELO
      </button>
    )
  }

  return <ProjectionCardView projection={projection} className={className} />
}
