import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, OnboardingAnswers, OnboardingResult } from '@/types'
import api, { tokenStore, scheduleProactiveRefresh, cancelProactiveRefresh } from '@/services/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isInitializing: boolean
  error: string | null
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  initialize: () => Promise<void>
  clearError: () => void
  completeOnboarding: (answers: OnboardingAnswers) => Promise<OnboardingResult>
}

export interface RegisterData {
  email: string
  password: string
  name: string
  last_name: string
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  error: null,
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (email, password) => {
        set({ error: null })
        const res = await api.post<{ access_token: string; refresh_token: string }>(
          '/auth/login',
          { email, password },
        )
        tokenStore.setAccess(res.data.access_token)
        tokenStore.setRefresh(res.data.refresh_token)
        scheduleProactiveRefresh()

        const profile = await api.get<User>('/players/me')
        set({ user: profile.data, isAuthenticated: true, error: null })
      },

      register: async (data) => {
        set({ error: null })
        await api.post('/auth/register', data)
        // Caller is responsible for navigation after register.
        // No auto-login here — user must log in explicitly.
      },

      logout: () => {
        tokenStore.clearAll()
        cancelProactiveRefresh()
        set({ user: null, isAuthenticated: false, error: null })
        // Notify other stores to clear stale data (avoids circular imports)
        window.dispatchEvent(new CustomEvent('auth:user-changed'))
      },

      refresh: async () => {
        const refreshToken = tokenStore.getRefresh()
        if (!refreshToken) {
          get().logout()
          return
        }
        try {
          const res = await api.post<{ access_token: string; refresh_token?: string }>(
            '/auth/refresh',
            { refresh_token: refreshToken },
          )
          tokenStore.setAccess(res.data.access_token)
          if (res.data.refresh_token) tokenStore.setRefresh(res.data.refresh_token)
          scheduleProactiveRefresh()
        } catch {
          get().logout()
        }
      },

      initialize: async () => {
        const refreshToken = tokenStore.getRefresh()
        if (!refreshToken) {
          set({ isInitializing: false, isAuthenticated: false })
          return
        }
        try {
          await get().refresh()
          const profile = await api.get<User>('/players/me')
          set({ user: profile.data, isAuthenticated: true, isInitializing: false })
        } catch {
          get().logout()
          set({ isInitializing: false })
        }
      },

      clearError: () => set({ error: null }),

      completeOnboarding: async (answers) => {
        const res = await api.post<OnboardingResult>('/onboarding/questionnaire', answers)
        const result = res.data
        // Mark onboarding completed in persisted user state
        set((s) => ({
          user: s.user ? { ...s.user, onboarding_completed: true, elo: result.elo } : s.user,
        }))
        return result
      },
    }),
    {
      name: 'blend-auth',
      // Only persist user data, NOT tokens (access token is in memory, refresh in localStorage directly)
      partialize: (state) => ({ user: state.user }),
    },
  ),
)

// Listen for forced logout events from the API interceptor
window.addEventListener('auth:logout', () => {
  useAuthStore.getState().logout()
})
