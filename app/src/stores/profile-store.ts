import { create } from 'zustand'
import api from '@/services/api'
import type {
  PlayerProfile,
  PublicPlayerProfile,
  PlayerPreferences,
  UpdateProfileData,
  MatchHistoryEntry,
  EloHistoryEntry,
} from '@/types'
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
      const res = await api.put<PlayerProfile>('/players/me', data)
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
      formData.append('file', file)
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
    } catch {
      set({ error: 'No se pudo subir la imagen. Intentá de nuevo.', uploading: false })
      throw new Error('upload_failed')
    }
  },

  fetchEloHistory: async () => {
    try {
      const res = await api.get<{ entries: EloHistoryEntry[]; next_cursor?: number } | EloHistoryEntry[]>('/players/me/elo-history')
      const data = Array.isArray(res.data) ? res.data : (res.data.entries ?? [])
      set({ eloHistory: data })
    } catch {
      // Non-critical: just leave empty
    }
  },

  fetchMatchHistory: async (playerId, reset = false) => {
    const { matchHistoryPage, matchHistory, hasMoreMatches } = get()
    if (!reset && !hasMoreMatches) return

    const page = reset ? 0 : matchHistoryPage
    set({ loading: true })

    try {
      const url = playerId ? `/players/${playerId}/matches` : '/players/me/matches'
      const res = await api.get<MatchHistoryEntry[]>(url, {
        params: { limit: MATCHES_PAGE_SIZE, offset: page * MATCHES_PAGE_SIZE },
      })
      const newEntries = res.data
      set({
        matchHistory: reset ? newEntries : [...matchHistory, ...newEntries],
        matchHistoryPage: page + 1,
        hasMoreMatches: newEntries.length === MATCHES_PAGE_SIZE,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  fetchPreferences: async () => {
    try {
      const res = await api.get<PlayerPreferences>('/players/me/preferences')
      set({ preferences: res.data })
    } catch {
      // Use defaults if fetch fails
      set({
        preferences: { radar_radius_km: 10, elo_min_delta: -200, elo_max_delta: 200 },
      })
    }
  },

  updatePreferences: async (data) => {
    const previous = get().preferences
    // Optimistic update
    if (previous) {
      set({ preferences: { ...previous, ...data }, savingPreferences: true })
    }
    try {
      const res = await api.put<PlayerPreferences>('/players/me/preferences', data)
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
    } catch {
      // Revert on error
      set({ preferences: previous, savingPreferences: false })
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
