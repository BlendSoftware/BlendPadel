import api from './api'

interface RegisterTokenPayload {
  token: string
  platform: 'ios' | 'android' | 'web'
}

const STORAGE_KEY = 'blend-device-token-registered'

export const deviceTokenService = {
  /** Register a push token with the backend. Safe to call multiple times — deduplicates. */
  async register(payload: RegisterTokenPayload): Promise<void> {
    await api.post('/players/me/device-token', payload)
  },

  /** Remove the device token from the backend. Token is required in the request body. */
  async unregister(token: string): Promise<void> {
    await api.delete('/players/me/device-token', { data: { token } })
    localStorage.removeItem(STORAGE_KEY)
  },

  /** Returns true if we have already registered this session. */
  hasRegistered(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  },

  markRegistered(): void {
    localStorage.setItem(STORAGE_KEY, 'true')
  },
}
