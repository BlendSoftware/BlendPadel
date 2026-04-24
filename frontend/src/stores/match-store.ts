import { create } from 'zustand'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth-store'
import { usePlayerCache } from '@/stores/player-cache'
import { extractApiError } from '@/lib/api-errors'
import type {
  MatchDetail,
  MatchPlayer,
  MatchStatus,
  MatchType,
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
  // Backend returns sets at top-level; build a MatchResult from it so UI
  // components that read match.result.sets continue to work.
  const rawSets = raw.sets as SetScore[] | undefined
  const existingResult = raw.result as MatchDetail['result'] | undefined
  const result: MatchDetail['result'] = existingResult ?? (
    rawSets && rawSets.length > 0
      ? { sets: rawSets, submitted_by: '', submitted_at: (raw.created_at as string) ?? '' }
      : null
  )

  return {
    ...(raw as unknown as MatchDetail),
    team_a: hydrateTeam(raw.team_a as RawTeam),
    team_b: hydrateTeam(raw.team_b as RawTeam),
    result,
  }
}

export type MatchTab = 'upcoming' | 'pending' | 'history'

interface PlayerSearchOptions {
  excludeIds?: string[]
  matchType?: MatchType
}

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
  refreshMatch: (id: string) => Promise<void>
  createMatch: (data: CreateMatchDTO) => Promise<MatchDetail>
  submitResult: (matchId: string, sets: SetScore[]) => Promise<void>
  confirmResult: (matchId: string) => Promise<void>
  disputeResult: (matchId: string, reason: string) => Promise<void>
  cancelMatch: (matchId: string) => Promise<void>
  reportMisconduct: (matchId: string, playerId: string, description: string) => Promise<void>
  searchPlayers: (query: string, options?: PlayerSearchOptions) => Promise<void>
  clearSearch: () => void
  clearError: () => void
  clearSelectedMatch: () => void
}

// Statuses that the backend actually returns via GET /players/{id}/matches
const SEALED_STATUSES: MatchStatus[] = ['sealed', 'disputed', 'cancelled']

// Statuses we treat as "upcoming" — matches that haven't had a result submitted yet.
const UPCOMING_STATUSES: MatchStatus[] = ['pending_result']

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

      // Fetch both sealed (history) and active (upcoming/pending) matches in parallel
      const [historyRes, activeRes] = await Promise.all([
        api.get<unknown[]>(`/players/${userId}/matches`).catch(() => ({ data: [] })),
        api.get<unknown[]>(`/players/${userId}/matches/active`).catch(() => ({ data: [] })),
      ])

      // Normalise responses
      const normalize = (data: unknown): unknown[] => {
        if (Array.isArray(data)) return data
        if (data && typeof data === 'object' && 'items' in data) return (data as { items: unknown[] }).items ?? []
        if (data && typeof data === 'object' && 'Items' in data) return (data as { Items: unknown[] }).Items ?? []
        return []
      }

      const historyRaw = normalize(historyRes.data)
      const activeRaw = normalize(activeRes.data)

      // Hydrate and merge, deduplicating by ID
      const allRaw = [...activeRaw, ...historyRaw]
      const seen = new Set<string>()
      const merged: MatchDetail[] = []
      for (const raw of allRaw) {
        const match = hydrateMatch(raw as Record<string, unknown>)
        if (!seen.has(match.id)) {
          seen.add(match.id)
          merged.push(match)
        }
      }

      set({ matches: merged, isLoading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar partidos'
      set({ error: message, isLoading: false })
    }
  },

  fetchMatch: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.get<Record<string, unknown>>(`/matches/${id}`)
      const match = hydrateMatch(res.data)
      set((s) => ({
        selectedMatch: match,
        matches: s.matches.map((m) => (m.id === id ? match : m)),
        isLoading: false,
      }))
    } catch (e: unknown) {
      const message = extractApiError(e, 'Partido no encontrado')
      set({ error: message, isLoading: false })
    }
  },

  refreshMatch: async (id) => {
    await get().fetchMatch(id)
  },

  createMatch: async (data) => {
    set({ isActionLoading: true, error: null })
    try {
      const res = await api.post<Record<string, unknown>>('/matches', data)
      const match = hydrateMatch(res.data)
      set((s) => ({ matches: [match, ...s.matches], isActionLoading: false }))
      return match
    } catch (e: unknown) {
      const axErr = e as { response?: { status?: number } }
      let message: string
      if (axErr.response?.status === 403) {
        message = 'No se puede crear el partido: uno de los jugadores está suspendido.'
      } else {
        message = extractApiError(e, 'Error al crear partido')
      }
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  submitResult: async (matchId, sets) => {
    set({ isActionLoading: true, error: null })
    try {
    await api.post<Record<string, unknown>>(`/matches/${matchId}/result`, { sets })
    set((s) => ({
    selectedMatch:
      s.selectedMatch?.id === matchId
      ? { ...s.selectedMatch, status: 'awaiting_confirmation' as const }
      : s.selectedMatch,
    matches: s.matches.map((m) =>
      m.id === matchId ? { ...m, status: 'awaiting_confirmation' as const } : m,
    ),
    isActionLoading: false,
    }))
    await get().refreshMatch(matchId)
    } catch (e: unknown) {
    const message = extractApiError(e, 'Error al cargar resultado')
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  confirmResult: async (matchId) => {
    set({ isActionLoading: true, error: null })
    try {
    await api.post<Record<string, unknown>>(`/matches/${matchId}/confirm`)
    set((s) => ({
    selectedMatch:
      s.selectedMatch?.id === matchId
      ? { ...s.selectedMatch, status: 'sealed' as const }
      : s.selectedMatch,
    matches: s.matches.map((m) => (m.id === matchId ? { ...m, status: 'sealed' as const } : m)),
    isActionLoading: false,
    }))
    await get().refreshMatch(matchId)
    } catch (e: unknown) {
    const message = extractApiError(e, 'Error al confirmar resultado')
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  disputeResult: async (matchId, reason) => {
    set({ isActionLoading: true, error: null })
    try {
    await api.post<Record<string, unknown>>(`/matches/${matchId}/dispute`, { reason })
    set((s) => ({
    selectedMatch:
      s.selectedMatch?.id === matchId
      ? { ...s.selectedMatch, status: 'disputed' as const, dispute_reason: reason }
      : s.selectedMatch,
    matches: s.matches.map((m) =>
      m.id === matchId ? { ...m, status: 'disputed' as const, dispute_reason: reason } : m,
    ),
    isActionLoading: false,
    }))
    await get().refreshMatch(matchId)
    } catch (e: unknown) {
    const message = extractApiError(e, 'Error al disputar resultado')
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
      const message = extractApiError(e, 'Error al cancelar partido')
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  reportMisconduct: async (matchId, playerId, description) => {
    set({ isActionLoading: true, error: null })
    try {
      await api.post(`/matches/${matchId}/report`, {
        reported_id: playerId,
        reason: description,
      })
      set({ isActionLoading: false })
    } catch (e: unknown) {
      const message = extractApiError(e, 'Error al enviar reporte')
      set({ error: message, isActionLoading: false })
      throw e
    }
  },

  searchPlayers: async (query, options) => {
    if (!query.trim()) {
      set({ searchResults: [] })
      return
    }
    set({ isSearching: true })
    try {
      const exclude = (options?.excludeIds ?? []).filter(Boolean)
      const res = await api.get<PlayerSearchResult[]>('/players/search', {
        params: {
          q: query.trim(),
          exclude_ids: exclude.length ? exclude.join(',') : undefined,
          match_type: options?.matchType,
          limit: 20,
        },
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

// Clear store when user changes (logout/login)
window.addEventListener('auth:user-changed', () => {
  useMatchStore.setState({ matches: [], selectedMatch: null, error: null })
})
