import { NavLink } from 'react-router-dom'
import { MapPin, Users, Trophy, Zap, User } from 'lucide-react'

const tabs = [
  { to: '/radar', icon: MapPin, label: 'Canchas' },
  { to: '/matchmaking', icon: Users, label: 'Partidos' },
  { to: '/rankings', icon: Trophy, label: 'Rankings' },
  { to: '/feed', icon: Zap, label: 'Feed' },
  { to: '/profile', icon: User, label: 'Perfil' },
] as const

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-bg-card border-t border-border z-50"
      aria-label="Navegación principal"
    >
      <ul className="flex items-stretch h-16" role="list">
        {tabs.map(({ to, icon: Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 h-full w-full min-h-11',
                  'text-xs font-medium transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green focus-visible:ring-inset',
                  isActive ? 'text-padel-green' : 'text-text-secondary hover:text-text-primary',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
