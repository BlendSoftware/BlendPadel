import { useAuthStore } from '@/stores/auth-store'

/**
 * Stable selectors for auth state — never destructure directly from useAuthStore.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const register = useAuthStore((s) => s.register)
  const clearError = useAuthStore((s) => s.clearError)
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)

  return {
    user,
    isAuthenticated,
    isInitializing,
    error,
    login,
    logout,
    register,
    clearError,
    completeOnboarding,
  }
}
