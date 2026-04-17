import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface HeaderProps {
  title: string
  showBack?: boolean
  right?: React.ReactNode
  backTo?: string
}

export function Header({ title, showBack = false, right, backTo }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 bg-bg-dark/90 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              onClick={() => {
                if (backTo) {
                  navigate(backTo)
                  return
                }
                navigate(-1)
              }}
              className="flex items-center justify-center min-h-11 min-w-11 -ml-2 text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
              aria-label="Volver"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
          )}
          <h1 className="text-base font-semibold text-text-primary truncate">{title}</h1>
        </div>

        {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
      </div>
    </header>
  )
}
