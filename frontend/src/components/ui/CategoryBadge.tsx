import { getCategoryFromELO } from '@/lib/categories'

interface CategoryBadgeProps {
  elo: number
  showFull?: boolean
  className?: string
}

/**
 * Displays the padel category derived from an ELO value.
 * e.g. ELO 1050 → "6ta" badge in green.
 */
export function CategoryBadge({ elo, showFull = false, className = '' }: CategoryBadgeProps) {
  const cat = getCategoryFromELO(elo)
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white border border-white/20',
        cat.color,
        className,
      ].join(' ')}
      title={cat.fullName}
      aria-label={`Categoría ${cat.fullName}`}
    >
      {showFull ? cat.fullName : cat.name}
    </span>
  )
}
