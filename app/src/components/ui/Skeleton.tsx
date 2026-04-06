// ─── Base skeleton primitive ──────────────────────────────────────────────────

interface SkeletonProps {
  className?: string
}

function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-bg-input/60 ${className}`}
    />
  )
}

// ─── Variants ─────────────────────────────────────────────────────────────────

/** Single text line skeleton */
export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />
}

/** Circle skeleton for avatars */
export function SkeletonCircle({ className = '' }: SkeletonProps) {
  return <Skeleton className={`rounded-full ${className}`} />
}

/** Rectangle skeleton for cards / images */
export function SkeletonRect({ className = '' }: SkeletonProps) {
  return <Skeleton className={className} />
}

// ─── Composed skeletons ───────────────────────────────────────────────────────

/** Ranking table row skeleton */
export function SkeletonRankingRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
      <Skeleton className="h-5 w-6 shrink-0" />
      <SkeletonCircle className="h-9 w-9 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <SkeletonText className="w-1/2" />
        <SkeletonText className="w-1/3 h-3" />
      </div>
      <Skeleton className="h-6 w-14" />
    </div>
  )
}

/** Flare card skeleton */
export function SkeletonFlareCard() {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 space-y-3" aria-hidden="true">
      <div className="flex items-start gap-3">
        <SkeletonCircle className="h-10 w-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonText className="w-1/3" />
          <SkeletonText className="w-2/3 h-3" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
      <SkeletonText className="w-full" />
      <SkeletonText className="w-4/5" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  )
}

/** Match card skeleton */
export function SkeletonMatchCard() {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 space-y-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <SkeletonCircle className="h-10 w-10 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <SkeletonText className="w-2/5" />
          <SkeletonText className="w-1/3 h-3" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-2">
        <SkeletonText className="w-24 h-3" />
        <SkeletonText className="w-20 h-3" />
      </div>
    </div>
  )
}

// ─── List variants ────────────────────────────────────────────────────────────

interface SkeletonListProps {
  count?: number
  variant: 'ranking' | 'flare' | 'match'
}

const SKELETON_VARIANTS = {
  ranking: SkeletonRankingRow,
  flare: SkeletonFlareCard,
  match: SkeletonMatchCard,
}

export function SkeletonList({ count = 5, variant }: SkeletonListProps) {
  const SkeletonItem = SKELETON_VARIANTS[variant]
  return (
    <div
      aria-label="Cargando..."
      aria-busy="true"
      className="space-y-2"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} />
      ))}
    </div>
  )
}
