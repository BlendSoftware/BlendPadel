import { create } from 'zustand'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth-store'
import type { Flare, CreateFlareDTO } from '@/features/matchmaking/types'

interface MatchmakingFilters {
  lat: number | null
  lng: number | null
  radius_km: number
}

interface MatchmakingState {
  flares: Flare[]
  myFlare: Flare | null
  filters: MatchmakingFilters
  isLoading: boolean
  error: string | null
}

interface MatchmakingActions {
  setFilters: (filters: Partial<MatchmakingFilters>) => void
  fetchFlares: () => Promise<void>
  createFlare: (data: CreateFlareDTO) => Promise<void>
  respondToFlare: (flareId: string, partnerId?: string) => Promise<void>
  cancelFlare: (flareId: string) => Promise<void>
  fetchMyFlare: () => Promise<void>
  clearError: () => void
}

export const useMatchmakingStore = create<MatchmakingState & MatchmakingActions>((set, get) => ({
  flares: [],
  myFlare: null,
  filters: { lat: null, lng: null, radius_km: 10 },
  isLoading: false,
  error: null,

  setFilters: (filters) =>
    set((s) => ({ filters: { ...s.filters, ...filters } })),

  clearError: () => set({ error: null }),

  fetchFlares: async () => {
    set({ isLoading: true, error: null })
    try {
      const { filters } = get()
      // BUG 1 FIX: Use Mendoza default when user location is not set
      const lat = filters.lat ?? -33.35
      const lng = filters.lng ?? -68.33
      const params: Record<string, string | number> = { radius_km: filters.radius_km, lat, lng }
      const res = await api.get<any>('/matchmaking/flares', { params })
      const data = Array.isArray(res.data) ? res.data : (res.data.items ?? res.data.Items ?? [])
      set({ flares: data, isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar desafíos'
      set({ error: message, isLoading: false })
    }
  },

  fetchMyFlare: async () => {
    // If we already have myFlare set (e.g., from createFlare), keep it
    const existing = get().myFlare
    if (existing && existing.status === 'active') return

    // Try to find own flare from the fetched list
    const { flares } = get()
    let list = flares
    if (list.length === 0) {
      await get().fetchFlares()
      list = get().flares
    }
    const userId = useAuthStore.getState().user?.id
    let active = list.find((f) => (f.user_id === userId || f.player_id === userId) && f.status === 'active') ?? null

    // If not found in list, try wider search
    if (!active) {
      try {
        const res = await api.get<any>('/matchmaking/flares', {
          params: { lat: -33.35, lng: -68.33, radius_km: 200 },
        })
        const all = Array.isArray(res.data) ? res.data : (res.data.items ?? res.data.Items ?? [])
        const userName = useAuthStore.getState().user?.name
        active = all.find((f: Flare) => {
          const matchById = (f.user_id === userId || f.player_id === userId)
          const matchByName = f.creator_name === userName
          return (matchById || matchByName) && f.status === 'active'
        }) ?? null
      } catch { /* ignore */ }
    }

    set({ myFlare: active })
  },

  createFlare: async (data) => {
    set({ isLoading: true, error: null })
    try {
      // If user hasn't shared location, default to Mendoza city center
      const payload: CreateFlareDTO = {
        ...data,
        latitude: data.latitude ?? -33.35,
        longitude: data.longitude ?? -68.33,
      }
      const res = await api.post<Flare>('/matchmaking/flares', payload)
      set({ myFlare: res.data, isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al crear desafío'
      set({ error: message, isLoading: false })
      throw e
    }
  },

  respondToFlare: async (flareId, partnerId) => {
    set({ isLoading: true, error: null })
    try {
      const body = partnerId ? { partner_id: partnerId } : {}
      await api.post(`/matchmaking/flares/${flareId}/respond`, body)
      // Refresh flares after responding
      await get().fetchFlares()
      set({ isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al aceptar desafío'
      set({ error: message, isLoading: false })
      throw e
    }
  },

  cancelFlare: async (flareId) => {
    set({ isLoading: true, error: null })
    try {
      await api.delete(`/matchmaking/flares/${flareId}`)
      set({ myFlare: null, isLoading: false })
      // Also remove from wall
      set((s) => ({ flares: s.flares.filter((f) => f.id !== flareId) }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cancelar desafío'
      set({ error: message, isLoading: false })
      throw e
    }
  },
}))
