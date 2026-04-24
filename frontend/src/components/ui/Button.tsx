import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-padel-green text-bg-dark font-semibold hover:bg-padel-green-dark active:scale-95',
  secondary:
    'bg-bg-card text-text-primary border border-border hover:bg-bg-input active:scale-95',
  outline:
    'bg-transparent text-padel-green border border-padel-green hover:bg-padel-green/10 active:scale-95',
  danger:
    'bg-trust-low text-white font-semibold hover:bg-red-700 active:scale-95',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-card active:scale-95',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm min-h-11',
  md: 'h-11 px-4 text-sm min-h-11',
  lg: 'h-12 px-6 text-base min-h-11',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled ?? loading

  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg-dark',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Spinner size="sm" className="" />}
      {children}
    </button>
  )
}
