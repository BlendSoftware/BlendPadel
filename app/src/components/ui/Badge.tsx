type BadgeVariant = 'trust-high' | 'trust-medium' | 'trust-low' | 'green' | 'blue' | 'gray' | 'orange'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  'trust-high': 'bg-trust-high/20 text-trust-high border-trust-high/30',
  'trust-medium': 'bg-trust-medium/20 text-trust-medium border-trust-medium/30',
  'trust-low': 'bg-trust-low/20 text-trust-low border-trust-low/30',
  green: 'bg-padel-green/20 text-padel-green border-padel-green/30',
  blue: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  gray: 'bg-bg-input text-text-secondary border-border',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
