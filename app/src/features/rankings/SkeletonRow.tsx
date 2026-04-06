// Skeleton loading row for the leaderboard — no props needed

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse" aria-hidden="true">
      {/* Rank badge placeholder */}
      <div className="w-7 h-5 rounded bg-bg-input shrink-0" />
      {/* Avatar placeholder */}
      <div className="h-10 w-10 rounded-full bg-bg-input shrink-0" />
      {/* Name + meta */}
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3.5 w-32 rounded bg-bg-input" />
        <div className="h-3 w-20 rounded bg-bg-input" />
      </div>
      {/* ELO badge placeholder */}
      <div className="h-5 w-14 rounded-full bg-bg-input shrink-0" />
    </div>
  )
}
