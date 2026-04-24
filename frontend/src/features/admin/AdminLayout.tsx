import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import {
  LayoutDashboard,
  Users,
  Scale,
  FileWarning,
  UserCog,
  ClipboardList,
  Map,
  ArrowLeft,
} from 'lucide-react'
import { ToastContainer } from '@/components/layout/Toast'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  superadminOnly: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin',           label: 'Dashboard',   icon: LayoutDashboard, superadminOnly: false },
  { to: '/admin/disputes',  label: 'Disputas',    icon: Scale,           superadminOnly: false },
  { to: '/admin/reports',   label: 'Reportes',    icon: FileWarning,     superadminOnly: false },
  { to: '/admin/moderators',label: 'Moderadores', icon: UserCog,         superadminOnly: true  },
  { to: '/admin/players',   label: 'Jugadores',   icon: Users,           superadminOnly: true  },
  { to: '/admin/regions',   label: 'Regiones',    icon: Map,             superadminOnly: true  },
  { to: '/admin/audit-log', label: 'Audit Log',   icon: ClipboardList,   superadminOnly: true  },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.role === 'superadmin'

  const visibleItems = NAV_ITEMS.filter((item) => !item.superadminOnly || isSuperAdmin)

  return (
    <div className="min-h-dvh bg-bg-dark flex">
      <ToastContainer />

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 bg-bg-card border-r border-border flex flex-col">
        <div className="px-5 pt-6 pb-4 border-b border-border">
          <p className="font-display text-lg text-text-primary uppercase tracking-widest leading-tight">
            Admin
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {isSuperAdmin ? 'Superadmin' : 'Moderador'}
          </p>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2" aria-label="Navegación admin">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-11',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
                  isActive
                    ? 'bg-padel-green/10 text-padel-green font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-input',
                ].join(' ')
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 pb-4">
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-input w-full transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
          >
            <ArrowLeft size={15} />
            Volver a la app
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
