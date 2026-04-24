import styles from './Spinner.module.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap: Record<'sm' | 'md' | 'lg', number> = {
  sm: 36,
  md: 56,
  lg: 82,
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const px = sizeMap[size]
  return (
    <div className={`${styles.wrap} ${className}`} role="status" aria-label="Cargando...">
      <svg
        className={styles.loader}
        width={px}
        height={px}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className={styles.trail}
          d="M13 64C24 30 43 18 66 22C83 25 90 40 84 52C78 65 62 68 52 60"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <ellipse className={styles.racket} cx="64" cy="63" rx="20" ry="12" transform="rotate(-26 64 63)" strokeWidth="4" />
        <line className={styles.handle} x1="74" y1="72" x2="88" y2="88" strokeWidth="4" strokeLinecap="round" />
        <circle className={styles.ball} cx="24" cy="52" r="6" />
      </svg>
    </div>
  )
}
