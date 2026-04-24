import { create } from 'zustand'
import api from '@/services/api'
import { extractApiError } from '@/lib/api-errors'
import type {
  PlayerProfile,
  PublicPlayerProfile,
  PlayerPreferences,
  UpdateProfileData,
  MatchHistoryEntry,
  EloHistoryEntry,
} from '@/types'
import { useAuthStore } from './auth-store'
// BUG 13 FIX: Import radar store to keep radiusKm in sync
import { useRadarStore } from './radar-store'

// ─── State & Actions ──────────────────────────────────────────────────────────

interface ProfileState {
  profile: PlayerProfile | null
  publicProfile: PublicPlayerProfile | null
  eloHistory: EloHistoryEntry[]
  matchHistory: MatchHistoryEntry[]
  matchHistoryPage: number
  hasMoreMatches: boolean
  preferences: PlayerPreferences | null
  loading: boolean
  uploading: boolean
  savingPreferences: boolean
  error: string | null
  notFound: boolean
}

interface ProfileActions {
  fetchProfile: () => Promise<void>
  updateProfile: (data: UpdateProfileData) => Promise<void>
  uploadAvatar: (file: File) => Promise<string>
  fetchEloHistory: () => Promise<void>
  fetchMatchHistory: (playerId?: string, reset?: boolean) => Promise<void>
  fetchPreferences: () => Promise<void>
  updatePreferences: (data: Partial<PlayerPreferences>) => Promise<void>
  fetchPublicProfile: (id: string) => Promise<void>
  clearPublicProfile: () => void
  clearError: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MATCHES_PAGE_SIZE = 10

export const useProfileStore = create<ProfileState & ProfileActions>()((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  profile: null,
  publicProfile: null,
  eloHistory: [],
  matchHistory: [],
  matchHistoryPage: 0,
  hasMoreMatches: true,
  preferences: null,
  loading: false,
  uploading: false,
  savingPreferences: false,
  error: null,
  notFound: false,

  // ── Actions ────────────────────────────────────────────────────────────────

  fetchProfile: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get<PlayerProfile>('/players/me')
      set({ profile: res.data, loading: false })
    } catch {
      set({ error: 'No se pudo cargar tu perfil. Intentá de nuevo.', loading: false })
    }
  },

  updateProfile: async (data) => {
    set({ loading: true, error: null })
    try {
      // PUT /players/me returns { message } — re-fetch to get the updated profile
      await api.put('/players/me', data)
      const res = await api.get<PlayerProfile>('/players/me')
      set({ profile: res.data, loading: false })
    } catch {
      set({ error: 'No se pudo actualizar tu perfil. Intentá de nuevo.', loading: false })
      throw new Error('update_failed')
    }
  },

  uploadAvatar: async (file) => {
    set({ uploading: true, error: null })
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await api.post<{ avatar_url: string }>('/players/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const avatarUrl = res.data.avatar_url
      // Update cached profile with new avatar
      const current = get().profile
      if (current) {
        set({ profile: { ...current, avatar_url: avatarUrl }, uploading: false })
      } else {
        set({ uploading: false })
      }
      return avatarUrl
    } catch (e: unknown) {
      set({ error: extractApiError(e, 'No se pudo subir la imagen. Intenta de nuevo.'), uploading: false })
      throw new Error('upload_failed')
    }
  },

  fetchEloHistory: async () => {
    try {
      const res = await api.get<{ entries: EloHistoryEntry[]; next_cursor?: number }>(
        '/players/me/elo-history',
      )
      set({ eloHistory: res.data.entries ?? [] })
    } catch {
      // Non-critical: just leave empty
    }
  },

  fetchMatchHistory: async (playerId, reset = false) => {
    const { matchHistoryPage, matchHistory, hasMoreMatches } = get()
    if (!reset && !hasMoreMatches) return

    // Page is 1-indexed on the backend
    const page = reset ? 1 : matchHistoryPage + 1
    set({ loading: true })

    try {
      // /players/me/matches does not exist — always use /players/{id}/matches
      const id = playerId ?? useAuthStore.getState().user?.id
      if (!id) { set({ loading: false }); return }
      const res = await api.get<MatchHistoryEntry[]>(`/players/${id}/matches`, {
        params: { limit: MATCHES_PAGE_SIZE, page },
      })
      const newEntries = res.data
      set({
        matchHistory: reset ? newEntries : [...matchHistory, ...newEntries],
        matchHistoryPage: page,
        hasMoreMatches: newEntries.length === MATCHES_PAGE_SIZE,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  fetchPreferences: async () => {
    // Preferences are embedded in GET /players/{id} self-view (not /players/me)
    const userId = useAuthStore.getState().user?.id
    if (!userId) return
    try {
      const res = await api.get<{ preferences?: PlayerPreferences }>(`/players/${userId}`)
      const prefs = res.data.preferences
      if (prefs) {
        set({ preferences: prefs })
      } else {
        set({ preferences: { radar_radius_km: 10, elo_min_delta: -200, elo_max_delta: 200 } })
      }
    } catch {
      set({
        preferences: { radar_radius_km: 10, elo_min_delta: -200, elo_max_delta: 200 },
      })
    }
  },

  updatePreferences: async (data) => {
    const previous = get().preferences
    const merged = {
      radar_radius_km: previous?.radar_radius_km ?? 10,
      elo_min_delta: previous?.elo_min_delta ?? -200,
      elo_max_delta: previous?.elo_max_delta ?? 200,
      ...data,
    }
    // Optimistic update
    if (previous) {
      set({ preferences: { ...previous, ...data }, savingPreferences: true, error: null })
    } else {
      set({ savingPreferences: true, error: null })
    }
    try {
      const res = await api.put<PlayerPreferences>('/players/me/preferences', merged)
      set({ preferences: res.data, savingPreferences: false })
      // BUG 13 FIX: Sync radar store radiusKm when radar_radius_km preference changes
      if (res.data.radar_radius_km !== undefined) {
        const validOptions = [5, 10, 15, 25] as const
        type RadiusOption = typeof validOptions[number]
        const saved = res.data.radar_radius_km
        // Snap to nearest valid RadiusOption
        const nearest = validOptions.reduce((prev, curr) =>
          Math.abs(curr - saved) < Math.abs(prev - saved) ? curr : prev
        ) as RadiusOption
        useRadarStore.getState().setRadiusKm(nearest)
      }
    } catch (e: unknown) {
      // Revert on error
      set({ preferences: previous, savingPreferences: false, error: extractApiError(e, 'No se pudieron guardar las preferencias.') })
      throw e
    }
  },

  fetchPublicProfile: async (id) => {
    set({ loading: true, error: null, notFound: false, publicProfile: null })
    try {
      const res = await api.get<PublicPlayerProfile>(`/players/${id}`)
      set({ publicProfile: res.data, loading: false })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404 || status === 403) {
        set({ notFound: true, loading: false })
      } else {
        set({ error: 'No se pudo cargar el perfil.', loading: false })
      }
    }
  },

  clearPublicProfile: () => set({ publicProfile: null, notFound: false, error: null }),

  clearError: () => set({ error: null }),
}))
