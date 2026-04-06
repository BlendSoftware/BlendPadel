import { create } from 'zustand'
import api from '@/services/api'
import type { Venue } from '@/types'

interface CreateVenueData {
  name: string
  address: string
  lat: number
  lng: number
  court_count: number
  phone?: string
}

interface VenueState {
  venues: Venue[]
  selectedVenue: Venue | null
  isLoading: boolean
  error: string | null
}

interface VenueActions {
  fetchNearby: (lat: number, lng: number, radiusKm: number) => Promise<void>
  getVenue: (id: string) => Promise<void>
  createVenue: (data: CreateVenueData) => Promise<Venue>
  clearError: () => void
}

export const useVenueStore = create<VenueState & VenueActions>((set) => ({
  venues: [],
  selectedVenue: null,
  isLoading: false,
  error: null,

  fetchNearby: async (lat, lng, radiusKm) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.get<{ venues: Venue[] }>('/venues', {
        params: { lat, lng, radius_km: radiusKm },
      })
      const venues = res.data.venues ?? []
      set({ venues, isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar canchas'
      set({ error: message, isLoading: false })
    }
  },

  getVenue: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.get<Venue>(`/venues/${id}`)
      set({ selectedVenue: res.data, isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar cancha'
      set({ error: message, isLoading: false })
    }
  },

  createVenue: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.post<Venue>('/venues', data)
      const venue = res.data
      set((s) => ({ venues: [venue, ...s.venues], isLoading: false }))
      return venue
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al crear cancha'
      set({ error: message, isLoading: false })
      throw e
    }
  },

  clearError: () => set({ error: null }),
}))
