import { create } from 'zustand'
import api from '@/services/api'
import type { FeedItem } from '@/types'

interface FeedState {
  items: FeedItem[]
  isLoading: boolean
  error: string | null
}

interface FeedActions {
  /** regionId is optional — backend falls back to JWT claim if omitted */
  fetchFeed: (regionId?: string | null, limit?: number, offset?: number) => Promise<void>
  clearError: () => void
}

export const useFeedStore = create<FeedState & FeedActions>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchFeed: async (regionId, limit = 20, offset = 0) => {
    set({ isLoading: true, error: null })
    try {
      const params: Record<string, string | number> = { limit, offset }
      if (regionId) params.region_id = regionId
      const res = await api.get<{ items: FeedItem[] }>('/feed', { params })
      const items = res.data.items ?? []
      if (offset > 0) {
        set((s) => ({ items: [...s.items, ...items], isLoading: false }))
      } else {
        set({ items, isLoading: false })
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar actividad'
      set({ error: message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
