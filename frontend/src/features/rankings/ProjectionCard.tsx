import { TrendingUp, TrendingDown, Zap } from 'lucide-react'

// ─── ELO projection calculation (client-side) ────────────────────────────────

// Standard ELO expected score
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

// K-factor for padel (same as backend)
const K_FACTOR = 32

function calculateProjection(teamAElos: number[], teamBElos: number[]): { win_delta: number; loss_delta: number } {
  const avgA = teamAElos.reduce((s, e) => s + e, 0) / teamAElos.length
  const avgB = teamBElos.reduce((s, e) => s + e, 0) / teamBElos.length

  const expected = expectedScore(avgA, avgB)
  const winDelta = Math.round(K_FACTOR * (1 - expected))
  const lossDelta = Math.round(K_FACTOR * (0 - expected))

  return { win_delta: winDelta, loss_delta: lossDelta }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ProjectionCardProps {
  teamA: number[]
  teamB: number[]
  className?: string
}

export function ProjectionCard({ teamA, teamB, className = '' }: ProjectionCardProps) {
  if (teamA.length === 0 || teamB.length === 0) return null

  const { win_delta, loss_delta } = calculateProjection(teamA, teamB)

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
