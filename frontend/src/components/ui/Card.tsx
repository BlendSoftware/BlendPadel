interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', padding = true, onClick }: CardProps) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      className={[
        'bg-bg-card rounded-xl border border-border',
        padding ? 'p-4' : '',
        onClick
          ? 'w-full text-left hover:border-border/80 hover:bg-bg-input transition-colors duration-150 cursor-pointer min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      {children}
    </Tag>
  )
}
