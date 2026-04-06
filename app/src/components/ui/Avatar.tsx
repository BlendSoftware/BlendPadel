import { getInitials } from '@/lib/utils'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  src?: string | null
  name: string
  size?: AvatarSize
  className?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(name)

  return (
    <div
      className={[
        'rounded-full overflow-hidden flex items-center justify-center shrink-0',
        'bg-padel-green/20 text-padel-green font-semibold',
        sizeClasses[size],
        className,
      ].join(' ')}
      aria-label={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            // Fallback to initials on image load error
            const target = e.currentTarget
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) {
              parent.textContent = initials
            }
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
