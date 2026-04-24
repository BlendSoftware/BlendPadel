interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, subtitle, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-3 py-12 px-6 text-center',
        className,
      ].join(' ')}
    >
      {icon && (
        <div className="text-text-secondary opacity-40 mb-2">
          {icon}
        </div>
      )}
      <p className="text-text-primary font-semibold text-base">{title}</p>
      {subtitle && (
        <p className="text-text-secondary text-sm max-w-xs">{subtitle}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
