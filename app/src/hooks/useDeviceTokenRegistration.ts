import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { deviceTokenService } from '@/services/device-token'

/**
 * Registers a PWA placeholder device token once per login session.
 * Must be called inside an authenticated context.
 *
 * Silently skips if already registered or if the API call fails —
 * push notifications are non-critical and must never block the user.
 */
export function useDeviceTokenRegistration() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return
    if (deviceTokenService.hasRegistered()) return

    void deviceTokenService
      .register({ token: 'pwa-placeholder', platform: 'web' })
      .then(() => {
        deviceTokenService.markRegistered()
      })
      .catch(() => {
        // Non-critical: swallow silently. Backend will retry on next login.
      })
  }, [isAuthenticated])
}
