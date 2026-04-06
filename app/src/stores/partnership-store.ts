import { create } from 'zustand'
import api from '@/services/api'
import type { Partnership, PairStats, BestPartner } from '@/types'

interface PartnershipState {
  partnerships: Partnership[]
  pairStats: PairStats | null
  bestPartner: BestPartner | null
  isLoading: boolean
  isActionLoading: boolean
  error: string | null
}

interface PartnershipActions {
  fetchMyPartnerships: () => Promise<void>
  requestPartnership: (partnerId: string) => Promise<void>
  acceptPartnership: (id: string) => Promise<void>
  rejectPartnership: (id: string) => Promise<void>
  dissolvePartnership: (id: string) => Promise<void>
  fetchPairStats: (id: string) => Promise<void>
  fetchBestPartner: () => Promise<void>
  clearError: () => void
}

export const usePartnershipStore = create<PartnershipState & PartnershipActions>((set) => ({
  partnerships: [],
  pairStats: null,
  bestPartner: null,
  isLoading: false,
  isActionLoading: false,
  error: null,

  fetchMyPartnerships: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.get<{ partnerships: Partnership[] }>('/partnerships/me')
      const partnerships = res.data.partnerships ?? []
      set({ partnerships, isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar parejas'
      set({ error: message, isLoading: false })
    }
  },

  requestPartnership: async (partnerId) => {
    set({ isActionLoading: true, error: null })
    try {
      const res = await api.post<Partnership>('/partnerships', { partner_id: partnerId })
      set((s) => ({ partnerships: [res.data, ...s.partnerships], isActionLoading: false }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al enviar solicitud'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  acceptPartnership: async (id) => {
    set({ isActionLoading: true, error: null })
    try {
      await api.put(`/partnerships/${id}/accept`)
      set((s) => ({
        partnerships: s.partnerships.map((p) =>
          p.id === id ? { ...p, status: 'accepted' as const } : p,
        ),
        isActionLoading: false,
      }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al aceptar solicitud'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  rejectPartnership: async (id) => {
    set({ isActionLoading: true, error: null })
    try {
      await api.put(`/partnerships/${id}/reject`)
      set((s) => ({
        partnerships: s.partnerships.filter((p) => p.id !== id),
        isActionLoading: false,
      }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al rechazar solicitud'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  dissolvePartnership: async (id) => {
    set({ isActionLoading: true, error: null })
    try {
      await api.delete(`/partnerships/${id}`)
      set((s) => ({
        partnerships: s.partnerships.filter((p) => p.id !== id),
        isActionLoading: false,
      }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al disolver pareja'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  fetchPairStats: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.get<PairStats>(`/partnerships/${id}/stats`)
      set({ pairStats: res.data, isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar estadísticas'
      set({ error: message, isLoading: false })
    }
  },

  fetchBestPartner: async () => {
    try {
      const res = await api.get<{ best_partner: BestPartner | null }>('/players/me/best-partner')
      set({ bestPartner: res.data.best_partner ?? null })
    } catch {
      // Non-critical — silently fail
    }
  },

  clearError: () => set({ error: null }),
}))
