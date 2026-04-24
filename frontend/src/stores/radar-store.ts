import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'
import type { RadarMatch, RadarAlert, ELORange, RadiusOption, UserLocation } from '@/types/radar'

interface RadarState {
  matches: RadarMatch[]
  alerts: RadarAlert[]
  nextCursor: string | null
  userLocation: UserLocation | null
  eloRange: ELORange
  radiusKm: RadiusOption
  selectedMatchId: string | null
  isLoading: boolean
  alertsLoading: boolean
  error: string | null
  locationDenied: boolean
}

interface RadarActions {
  setUserLocation: (loc: UserLocation) => void
  setLocationDenied: (denied: boolean) => void
  setELORange: (range: ELORange) => void
  setRadiusKm: (radius: RadiusOption) => void
  selectMatch: (id: string | null) => void
  fetchMatches: () => Promise<void>
  fetchAlerts: () => Promise<void>
  refresh: () => Promise<void>
}

type RadarStore = RadarState & RadarActions

// Default ELO range — widened at store init; updated once user profile is known
const DEFAULT_ELO_RANGE: ELORange = { min: 800, max: 1400 }
// Default location: Ciudad de Mendoza centro — alineado con seed de venues.
const MENDOZA: UserLocation = { lat: -33.037, lng: -68.655 }

export const useRadarStore = create<RadarStore>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      matches: [],
      alerts: [],
      nextCursor: null,
      userLocation: null,
      eloRange: DEFAULT_ELO_RANGE,
      radiusKm: 10,
      selectedMatchId: null,
      isLoading: false,
      alertsLoading: false,
      error: null,
      locationDenied: false,

      // ── Actions ────────────────────────────────────────────────────────────
      setUserLocation: (loc) => set({ userLocation: loc, locationDenied: false }),

      setLocationDenied: (denied) => set({ locationDenied: denied }),

      setELORange: (range) => set({ eloRange: range }),

      setRadiusKm: (radius) => set({ radiusKm: radius }),

      selectMatch: (id) => set({ selectedMatchId: id }),

      fetchMatches: async () => {
        const { userLocation, eloRange, radiusKm } = get()
        const loc = userLocation ?? MENDOZA

        set({ isLoading: true, error: null })
        try {
          const res = await api.get<{ items: RadarMatch[] } | RadarMatch[]>('/radar/matches', {
            params: {
              lat: loc.lat,
              lng: loc.lng,
              radius_km: radiusKm,
              elo_min: eloRange.min,
              elo_max: eloRange.max,
            },
          })
          const payload = res.data
          const data    = Array.isArray(payload) ? payload : (payload.items ?? [])
          const cursor  = Array.isArray(payload) ? null : ((payload as { next_cursor?: string }).next_cursor ?? null)
          set({ matches: data, nextCursor: cursor, isLoading: false })
        } catch {
          set({ error: 'No se pudieron cargar los partidos', isLoading: false })
        }
      },

      fetchAlerts: async () => {
        const { userLocation } = get()
        const loc = userLocation ?? MENDOZA

        set({ alertsLoading: true })
        try {
          const res = await api.get<{ items: RadarAlert[] } | RadarAlert[]>('/radar/alerts', {
            params: { lat: loc.lat, lng: loc.lng, radius_km: get().radiusKm },
          })
          const data = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
          set({ alerts: data, alertsLoading: false })
        } catch {
          set({ alertsLoading: false })
        }
      },

      refresh: async () => {
        await Promise.all([get().fetchMatches(), get().fetchAlerts()])
      },
    }),
    {
      name: 'blend-radar',
      // Persist location and filter prefs only
      partialize: (state) => ({
        userLocation: state.userLocation,
        eloRange: state.eloRange,
        radiusKm: state.radiusKm,
        locationDenied: state.locationDenied,
      }),
    },
  ),
)
