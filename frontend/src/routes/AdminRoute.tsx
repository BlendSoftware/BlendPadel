import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { Spinner } from '@/components/ui/Spinner'

export function AdminRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const user = useAuthStore((s) => s.user)

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

  const role = user?.role
  const isAllowed = role === 'superadmin' || role === 'moderator'

  if (!isAllowed) {
    window.dispatchEvent(
      new CustomEvent('toast:add', {
        detail: { type: 'error', message: 'No tenés permisos para acceder al panel admin' },
      }),
    )
    return <Navigate to="/radar" replace />
  }

  return <Outlet />
}
