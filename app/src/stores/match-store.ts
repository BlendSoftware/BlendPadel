import { create } from 'zustand'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth-store'
import { usePlayerCache } from '@/stores/player-cache'
import type {
  MatchDetail,
  MatchPlayer,
  MatchStatus,
  SetScore,
  CreateMatchDTO,
  PlayerSearchResult,
} from '@/features/matchmaking/types'

// ─── Hydration helper ─────────────────────────────────────────────────────────

// The backend returns team_a / team_b as string[] (UUIDs).
// This function normalises both formats into MatchPlayer[].
type RawTeam = string[] | MatchPlayer[]

function hydrateTeam(team: RawTeam): MatchPlayer[] {
  if (!Array.isArray(team) || team.length === 0) return []

  // Already hydrated (objects with an id field that is not just a string primitive)
  if (typeof team[0] === 'object' && team[0] !== null) {
    return team as MatchPlayer[]
  }

  // Raw UUID strings — resolve from player cache
  const cache = usePlayerCache.getState()
  return (team as string[]).map((id) => ({
    id,
    name: cache.getName(id),
    elo: cache.getElo(id) ?? 0,
    avatar_url: undefined,
    elo_delta: null,
  }))
}

// Normalise a raw backend match into the typed MatchDetail shape
function hydrateMatch(raw: Record<string, unknown>): MatchDetail {
  return {
    ...(raw as unknown as MatchDetail),
    team_a: hydrateTeam(raw.team_a as RawTeam),
    team_b: hydrateTeam(raw.team_b as RawTeam),
  }
}

export type MatchTab = 'upcoming' | 'pending' | 'history'

interface MatchState {
  matches: MatchDetail[]
  selectedMatch: MatchDetail | null
  activeTab: MatchTab
  isLoading: boolean
  isActionLoading: boolean
  error: string | null
  searchResults: PlayerSearchResult[]
  isSearching: boolean
}

interface MatchActions {
  setActiveTab: (tab: MatchTab) => void
  fetchMatches: () => Promise<void>
  fetchMatch: (id: string) => Promise<void>
  createMatch: (data: CreateMatchDTO) => Promise<MatchDetail>
  submitResult: (matchId: string, sets: SetScore[]) => Promise<void>
  confirmResult: (matchId: string) => Promise<void>
  disputeResult: (matchId: string, reason: string) => Promise<void>
  cancelMatch: (matchId: string) => Promise<void>
  reportMisconduct: (matchId: string, playerId: string, description: string) => Promise<void>
  searchPlayers: (query: string) => Promise<void>
  clearSearch: () => void
  clearError: () => void
  clearSelectedMatch: () => void
}

// Statuses that the backend actually returns via GET /players/{id}/matches
const SEALED_STATUSES: MatchStatus[] = ['sealed', 'disputed', 'cancelled']

// Statuses we treat as "upcoming" — no backend endpoint exists, so we
// keep any non-sealed matches that arrived (e.g. from createMatch).
const UPCOMING_STATUSES: MatchStatus[] = ['scheduled', 'pending_result']

const PENDING_STATUSES: MatchStatus[] = ['awaiting_confirmation']

export const useMatchStore = create<MatchState & MatchActions>((set, get) => ({
  matches: [],
  selectedMatch: null,
  activeTab: 'upcoming',
  isLoading: false,
  isActionLoading: false,
  error: null,
  searchResults: [],
  isSearching: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  clearError: () => set({ error: null }),

  clearSelectedMatch: () => set({ selectedMatch: null }),

  clearSearch: () => set({ searchResults: [] }),

  fetchMatches: async () => {
    set({ isLoading: true, error: null })
    try {
      const userId = useAuthStore.getState().user?.id
      if (!userId) {
        set({ matches: [], isLoading: false })
        return
      }

      // GET /players/{userId}/matches — only returns sealed matches from the backend
      const res = await api.get<{ items: unknown[] } | { Items: unknown[] } | unknown[]>(
        `/players/${userId}/matches`,
      )

      // Normalise the response — backend may return an array or a wrapped object
      let rawItems: unknown[]
      if (Array.isArray(res.data)) {
        rawItems = res.data
      } else if ('items' in (res.data as object)) {
        rawItems = (res.data as { items: unknown[] }).items ?? []
      } else {
        rawItems = (res.data as { Items: unknown[] }).Items ?? []
      }

      // Hydrate raw backend matches (team_a/team_b may be UUID string arrays)
      const fetched: MatchDetail[] = rawItems.map((raw) =>
        hydrateMatch(raw as Record<string, unknown>),
      )

      // Merge with any non-sealed matches already in the store (created optimistically)
      const existing = get().matches.filter(
        (m) => !SEALED_STATUSES.includes(m.status),
      )
      const existingIds = new Set(existing.map((m) => m.id))
      const merged = [...existing, ...fetched.filter((m) => !existingIds.has(m.id))]

      set({ matches: merged, isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar partidos'
      set({ error: message, isLoading: false })
    }
  },

  // GET /matches/{id} does not exist in the backend.
  // We resolve from the already-fetched list. If not found, try fetching all
  // matches first (e.g. when navigating directly to the detail page).
  fetchMatch: async (id) => {
    set({ isLoading: true, error: null })
    let found = get().matches.find((m) => m.id === id) ?? null
    if (!found) {
      // Attempt to load the full list and retry
      await get().fetchMatches()
      found = get().matches.find((m) => m.id === id) ?? null
    }
    if (found) {
      set({ selectedMatch: found, isLoading: false })
    } else {
      set({ error: 'Partido no encontrado', isLoading: false })
    }
  },

  createMatch: async (data) => {
    set({ isActionLoading: true, error: null })
    try {
      const res = await api.post<Record<string, unknown>>('/matches', data)
      const match = hydrateMatch(res.data)
      set((s) => ({ matches: [match, ...s.matches], isActionLoading: false }))
      return match
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al crear partido'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  submitResult: async (matchId, sets) => {
    set({ isActionLoading: true, error: null })
    try {
      const res = await api.post<Record<string, unknown>>(`/matches/${matchId}/result`, { sets })
      const match = hydrateMatch(res.data)
      set({ selectedMatch: match, isActionLoading: false })
      // Update in list
      set((s) => ({
        matches: s.matches.map((m) => (m.id === matchId ? match : m)),
      }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar resultado'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  confirmResult: async (matchId) => {
    set({ isActionLoading: true, error: null })
    try {
      const res = await api.post<Record<string, unknown>>(`/matches/${matchId}/confirm`)
      const match = hydrateMatch(res.data)
      set({ selectedMatch: match, isActionLoading: false })
      set((s) => ({
        matches: s.matches.map((m) => (m.id === matchId ? match : m)),
      }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al confirmar resultado'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  disputeResult: async (matchId, reason) => {
    set({ isActionLoading: true, error: null })
    try {
      const res = await api.post<Record<string, unknown>>(`/matches/${matchId}/dispute`, { reason })
      const match = hydrateMatch(res.data)
      set({ selectedMatch: match, isActionLoading: false })
      set((s) => ({
        matches: s.matches.map((m) => (m.id === matchId ? match : m)),
      }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al disputar resultado'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  cancelMatch: async (matchId) => {
    set({ isActionLoading: true, error: null })
    try {
      await api.post(`/matches/${matchId}/cancel`)
      set((s) => ({
        matches: s.matches.map((m) =>
          m.id === matchId ? { ...m, status: 'cancelled' as const } : m,
        ),
        selectedMatch:
          s.selectedMatch?.id === matchId
            ? { ...s.selectedMatch, status: 'cancelled' as const }
            : s.selectedMatch,
        isActionLoading: false,
      }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cancelar partido'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  reportMisconduct: async (matchId, playerId, description) => {
    set({ isActionLoading: true, error: null })
    try {
      await api.post(`/matches/${matchId}/report`, {
        reported_player_id: playerId,
        reason: description,
        description,
      })
      set({ isActionLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al enviar reporte'
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  searchPlayers: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [] })
      return
    }
    set({ isSearching: true })
    try {
      const res = await api.get<PlayerSearchResult[]>('/players/search', {
        params: { q: query.trim() },
      })
      set({ searchResults: res.data ?? [], isSearching: false })
    } catch {
      set({ isSearching: false })
    }
  },
}))

// ─── Tab helpers (exported for use in components) ─────────────────────────────

/** Filter the full matches list down to what should show on a given tab. */
export function filterMatchesByTab(matches: MatchDetail[], tab: MatchTab): MatchDetail[] {
  switch (tab) {
    case 'upcoming':
      return matches.filter((m) => UPCOMING_STATUSES.includes(m.status))
    case 'pending':
      return matches.filter((m) => PENDING_STATUSES.includes(m.status))
    case 'history':
      return matches.filter((m) => SEALED_STATUSES.includes(m.status))
  }
}
