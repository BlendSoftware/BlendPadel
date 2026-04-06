import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { usePlayerCache } from '@/stores/player-cache'
import { Spinner } from '@/components/ui/Spinner'
import { useDeviceTokenRegistration } from '@/hooks/useDeviceTokenRegistration'

export function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const user = useAuthStore((s) => s.user)
  const fetchAllPlayers = usePlayerCache((s) => s.fetchAll)

  // Register PWA push token once per authenticated session (non-critical)
  useDeviceTokenRegistration()

  // Warm up the player cache so match screens can resolve UUIDs to names
  useEffect(() => {
    if (isAuthenticated) {
      void fetchAllPlayers()
    }
  }, [isAuthenticated, fetchAllPlayers])

  if (isInitializing) {
    return (
      <div className="min-h-dvh bg-bg-dark flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Authenticated but onboarding not completed → force questionnaire
  if (user && !user.onboarding_completed) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
