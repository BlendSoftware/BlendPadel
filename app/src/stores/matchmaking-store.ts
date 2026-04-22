import { create } from 'zustand'
import api from '@/services/api'
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
  filters: { lat: null, lng: null, radius_km: 50 },
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
    // Always fetch from backend â€” don't use cached value (user may have switched accounts)
    try {
      const res = await api.get<Flare | null>('/matchmaking/flares/mine')
      set({ myFlare: res.data ?? null })
    } catch {
      set({ myFlare: null })
    }
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
    } catch (e: any) {
      const status = e?.response?.status
      let message: string
      if (status === 409) {
        message = 'Ya tenés un desafío activo. Cancelalo antes de crear uno nuevo.'
      } else if (status === 422) {
        message = 'Completá el cuestionario de onboarding antes de crear un desafío.'
      } else if (status === 403) {
        message = 'Tu cuenta está suspendida y no podés crear desafíos.'
      } else {
        message = e instanceof Error ? e.message : 'Error al crear desafío'
      }
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

// Clear store when user changes (logout/login)
window.addEventListener('auth:user-changed', () => {
  useMatchmakingStore.setState({ flares: [], myFlare: null, error: null })
})


