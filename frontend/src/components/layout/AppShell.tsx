import { useLocation, Outlet, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Radio, Trophy, Activity, UserCircle2 } from 'lucide-react'
import { ToastContainer } from './Toast'
import { OfflineBanner } from './OfflineBanner'
import styles from './AppShell.module.css'

const NAV_ITEMS = [
  { to: '/radar', label: 'Radar', icon: Compass },
  { to: '/matchmaking', label: 'Match', icon: Radio },
  { to: '/rankings', label: 'Rank', icon: Trophy },
  { to: '/feed', label: 'Feed', icon: Activity },
  { to: '/profile', label: 'Perfil', icon: UserCircle2 },
] as const

export function AppShell() {
  const location = useLocation()

  return (
    <div className={styles.canvas}>
      <ToastContainer />
      <OfflineBanner />

      {/* Dynamic Background */}
      <div className={styles.ambientGlowPrimary} aria-hidden="true" />
      <div className={styles.ambientGlowSecondary} aria-hidden="true" />

      {/* Main Centered Feed Viewport */}
      <main className={styles.viewport}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 50, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={styles.feedWrapper}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Pill Navigation */}
      <nav className={styles.pillNav} aria-label="Navegación principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 
              `${styles.pillItem} ${isActive ? styles.pillItemActive : ''}`
            }
          >
            <div className={styles.iconWrapper}>
              <item.icon size={22} strokeWidth={2.5} />
            </div>
            <span className={styles.pillLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
