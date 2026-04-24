import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'
import type { Region, RankingEntry, MatchProjection } from '@/types'

// ─── State & Actions ──────────────────────────────────────────────────────────

interface RankingsState {
  selectedRegionId: string | null
  genderFilter: string | null
  regions: Region[]
  rankings: RankingEntry[]
  myPosition: RankingEntry | null
  projection: MatchProjection | null
  loading: boolean
  regionsLoading: boolean
  projectionLoading: boolean
  error: string | null
}

interface RankingsActions {
  setRegion: (regionId: string) => void
  setGenderFilter: (gender: string | null) => void
  fetchRegions: () => Promise<void>
  fetchRankings: (regionId?: string | null, limit?: number) => Promise<void>
  /** Fetch ELO projection for the current user against a single opponent.
   *  Maps to GET /matches/projection?opponent_id=&result= */
  fetchProjection: (opponentId: string, result: 'win' | 'lose' | 'draw') => Promise<void>
  clearProjection: () => void
  refresh: () => Promise<void>
  clearError: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRankingsStore = create<RankingsState & RankingsActions>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      selectedRegionId: null,
      genderFilter: null,
      regions: [],
      rankings: [],
      myPosition: null,
      projection: null,
      loading: false,
      regionsLoading: false,
      projectionLoading: false,
      error: null,

      // ── Actions ────────────────────────────────────────────────────────────

      setRegion: (regionId) => {
        set({ selectedRegionId: regionId })
        void get().fetchRankings(regionId)
      },

      setGenderFilter: (gender) => {
        set({ genderFilter: gender })
        void get().fetchRankings()
      },

      fetchRegions: async () => {
        set({ regionsLoading: true })
        try {
          const res = await api.get<{ regions: Region[] } | Region[]>('/regions')
          const data = Array.isArray(res.data) ? res.data : (res.data.regions ?? [])
          set({ regions: data, regionsLoading: false })
        } catch {
          // Non-critical: keep existing regions list
          set({ regionsLoading: false })
        }
      },

      fetchRankings: async (regionId, limit = 10) => {
        let resolvedRegionId = regionId !== undefined ? regionId : get().selectedRegionId
        // Backend requires region_id — fallback to first available region
        if (!resolvedRegionId) {
          const regions = get().regions
          if (regions.length > 0) {
            resolvedRegionId = regions[0].id
            set({ selectedRegionId: resolvedRegionId })
          } else {
            // Try fetching regions first
            await get().fetchRegions()
            const updatedRegions = get().regions
            if (updatedRegions.length > 0) {
              resolvedRegionId = updatedRegions[0].id
              set({ selectedRegionId: resolvedRegionId })
            }
          }
        }
        if (!resolvedRegionId) {
          set({ loading: false, rankings: [], error: null })
          return
        }
        set({ loading: true, error: null })
        try {
          const params: Record<string, string | number> = { region_id: resolvedRegionId, limit }
          const gender = get().genderFilter
          if (gender) {
            params.gender = gender
          }
          const res = await api.get<{ region_id: string; region_name: string; entries: RankingEntry[]; total: number }>('/rankings', { params })
          // Backend always returns { entries: [...], region_id, region_name, total }
          const rankings = res.data.entries ?? []
          // Backend does not return my_position — keep previous value if any
          const myPosition = null
          set({
            rankings,
            myPosition,
            loading: false,
          })
        } catch {
          set({ error: 'No se pudo cargar el ranking. Intentá de nuevo.', loading: false })
        }
      },

      fetchProjection: async (opponentId, result) => {
        set({ projectionLoading: true })
        try {
          const res = await api.get<MatchProjection>('/matches/projection', {
            params: { opponent_id: opponentId, result },
          })
          set({ projection: res.data, projectionLoading: false })
        } catch {
          set({ projectionLoading: false })
        }
      },

      clearProjection: () => set({ projection: null }),

      refresh: async () => {
        await Promise.all([get().fetchRegions(), get().fetchRankings()])
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'blend-rankings',
      // Only persist the selected region so the user lands in their last zone
      partialize: (state) => ({ selectedRegionId: state.selectedRegionId }),
    },
  ),
)
