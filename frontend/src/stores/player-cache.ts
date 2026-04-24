import { create } from 'zustand'
import api from '@/services/api'
import type { RankingEntry, Region } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerInfo {
  id: string
  name: string
  elo: number
  avatar_url?: string
}

interface PlayerCacheState {
  players: Record<string, PlayerInfo>
  fetched: boolean
  loading: boolean
}

interface PlayerCacheActions {
  fetchAll: () => Promise<void>
  getName: (id: string) => string
  getElo: (id: string) => number | null
  getPlayer: (id: string) => PlayerInfo | null
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlayerCache = create<PlayerCacheState & PlayerCacheActions>((set, get) => ({
  players: {},
  fetched: false,
  loading: false,

  fetchAll: async () => {
    // Only fetch once per session — avoid duplicate calls
    if (get().fetched || get().loading) return

    set({ loading: true })

    try {
      // Step 1: get all regions
      const regionsRes = await api.get<{ regions: Region[] } | Region[]>('/regions')
      const regions: Region[] = Array.isArray(regionsRes.data)
        ? regionsRes.data
        : (regionsRes.data.regions ?? [])

      if (regions.length === 0) {
        set({ loading: false, fetched: true })
        return
      }

      // Step 2: fetch rankings for each region concurrently, merge all entries
      const rankingRequests = regions.map((r) =>
        api
          .get<{ entries: RankingEntry[] }>('/rankings', { params: { region_id: r.id, limit: 100 } })
          .then((res) => res.data.entries ?? [])
          .catch(() => [] as RankingEntry[]),
      )

      const results = await Promise.all(rankingRequests)

      const players: Record<string, PlayerInfo> = {}
      for (const entries of results) {
        for (const entry of entries) {
          // Deduplicate by player_id — first entry wins (rankings are ordered by rank)
          if (!players[entry.player_id]) {
            players[entry.player_id] = {
              id: entry.player_id,
              name: entry.name,
              elo: entry.elo,
            }
          }
        }
      }

      set({ players, loading: false, fetched: true })
    } catch {
      // Non-critical: let components fall back to "Jugador"
      set({ loading: false, fetched: true })
    }
  },

  getName: (id) => {
    return get().players[id]?.name ?? 'Jugador'
  },

  getElo: (id) => {
    return get().players[id]?.elo ?? null
  },

  getPlayer: (id) => {
    return get().players[id] ?? null
  },
}))
