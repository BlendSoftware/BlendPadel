import { create } from 'zustand'
import api from '@/services/api'
import type {
  KpisResponse,
  ModeratorResponse,
  AuditLogEntry,
  DisputeResponse,
  ReportResponse,
  BanRequest,
  EloAdjustRequest,
  ResolveDisputeRequest,
  CreateModeratorRequest,
  PlayerSearchResult,
} from '@/types'

// ─── State ────────────────────────────────────────────────────────────────────

interface AdminState {
  kpis: KpisResponse | null
  kpisLoading: boolean

  moderators: ModeratorResponse[]
  moderatorsLoading: boolean

  disputes: DisputeResponse[]
  disputesLoading: boolean

  reports: ReportResponse[]
  reportsTotal: number
  reportsLoading: boolean

  auditEntries: AuditLogEntry[]
  auditTotal: number
  auditLoading: boolean

  playerSearchResults: PlayerSearchResult[]
  playerSearchLoading: boolean

  actionLoading: boolean
  error: string | null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface AdminActions {
  fetchKpis: () => Promise<void>
  fetchModerators: () => Promise<void>
  createModerator: (data: CreateModeratorRequest) => Promise<ModeratorResponse>
  updateModerator: (id: string, data: CreateModeratorRequest) => Promise<ModeratorResponse>
  deleteModerator: (id: string) => Promise<void>
  banPlayer: (id: string, data: BanRequest) => Promise<void>
  unbanPlayer: (id: string) => Promise<void>
  adjustElo: (id: string, data: EloAdjustRequest) => Promise<void>
  createRegion: (name: string, boundary_wkt?: string) => Promise<{ id: string; name: string }>
  fetchReports: (params: { region_id?: string; status?: string; limit?: number; offset?: number }) => Promise<void>
  fetchDisputes: () => Promise<void>
  resolveDispute: (id: string, data: ResolveDisputeRequest) => Promise<void>
  fetchAuditLog: (params: { limit?: number; offset?: number; admin_id?: string }) => Promise<void>
  searchPlayers: (q: string) => Promise<void>
  clearError: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAdminStore = create<AdminState & AdminActions>()((set) => ({
  kpis: null,
  kpisLoading: false,
  moderators: [],
  moderatorsLoading: false,
  disputes: [],
  disputesLoading: false,
  reports: [],
  reportsTotal: 0,
  reportsLoading: false,
  auditEntries: [],
  auditTotal: 0,
  auditLoading: false,
  playerSearchResults: [],
  playerSearchLoading: false,
  actionLoading: false,
  error: null,

  fetchKpis: async () => {
    set({ kpisLoading: true, error: null })
    try {
      const res = await api.get<KpisResponse>('/admin/kpis')
      set({ kpis: res.data, kpisLoading: false })
    } catch {
      set({ kpisLoading: false, error: 'No se pudo cargar los KPIs' })
    }
  },

  fetchModerators: async () => {
    set({ moderatorsLoading: true, error: null })
    try {
      const res = await api.get<ModeratorResponse[]>('/admin/moderators')
      set({ moderators: res.data, moderatorsLoading: false })
    } catch {
      set({ moderatorsLoading: false, error: 'No se pudo cargar los moderadores' })
    }
  },

  createModerator: async (data) => {
    set({ actionLoading: true })
    try {
      const res = await api.post<ModeratorResponse>('/admin/moderators', data)
      set((s) => ({ moderators: [...s.moderators, res.data], actionLoading: false }))
      return res.data
    } catch (e) {
      set({ actionLoading: false })
      throw e
    }
  },

  updateModerator: async (id, data) => {
    set({ actionLoading: true })
    try {
      const res = await api.put<ModeratorResponse>(`/admin/moderators/${id}`, data)
      set((s) => ({
        moderators: s.moderators.map((m) => (m.id === id ? res.data : m)),
        actionLoading: false,
      }))
      return res.data
    } catch (e) {
      set({ actionLoading: false })
      throw e
    }
  },

  deleteModerator: async (id) => {
    set({ actionLoading: true })
    try {
      await api.delete(`/admin/moderators/${id}`)
      set((s) => ({
        moderators: s.moderators.filter((m) => m.id !== id),
        actionLoading: false,
      }))
    } catch (e) {
      set({ actionLoading: false })
      throw e
    }
  },

  banPlayer: async (id, data) => {
    set({ actionLoading: true })
    try {
      await api.post(`/admin/players/${id}/ban`, data)
      set({ actionLoading: false })
    } catch (e) {
      set({ actionLoading: false })
      throw e
    }
  },

  unbanPlayer: async (id) => {
    set({ actionLoading: true })
    try {
      await api.post(`/admin/players/${id}/unban`)
      set({ actionLoading: false })
    } catch (e) {
      set({ actionLoading: false })
      throw e
    }
  },

  adjustElo: async (id, data) => {
    set({ actionLoading: true })
    try {
      await api.post(`/admin/players/${id}/elo-adjust`, data)
      set({ actionLoading: false })
    } catch (e) {
      set({ actionLoading: false })
      throw e
    }
  },

  createRegion: async (name, boundary_wkt) => {
    set({ actionLoading: true })
    try {
      const res = await api.post<{ id: string; name: string }>('/admin/regions', { name, boundary_wkt })
      set({ actionLoading: false })
      return res.data
    } catch (e) {
      set({ actionLoading: false })
      throw e
    }
  },

  fetchReports: async ({ region_id, status, limit = 20, offset = 0 }) => {
    set({ reportsLoading: true, error: null })
    try {
      const params: Record<string, string | number> = { limit, offset }
      if (region_id) params.region_id = region_id
      if (status) params.status = status
      const res = await api.get<{ reports: ReportResponse[]; total: number }>('/admin/reports', { params })
      set({ reports: res.data.reports, reportsTotal: res.data.total, reportsLoading: false })
    } catch {
      set({ reportsLoading: false, error: 'No se pudo cargar los reportes' })
    }
  },

  fetchDisputes: async () => {
    set({ disputesLoading: true, error: null })
    try {
      const res = await api.get<DisputeResponse[]>('/admin/disputes')
      set({ disputes: res.data, disputesLoading: false })
    } catch {
      set({ disputesLoading: false, error: 'No se pudo cargar las disputas' })
    }
  },

  resolveDispute: async (id, data) => {
    set({ actionLoading: true })
    try {
      await api.post(`/admin/disputes/${id}/resolve`, data)
      // Remove from local list — it's now resolved
      set((s) => ({
        disputes: s.disputes.filter((d) => d.id !== id),
        actionLoading: false,
      }))
    } catch (e) {
      set({ actionLoading: false })
      throw e
    }
  },

  fetchAuditLog: async ({ limit = 50, offset = 0, admin_id } = {}) => {
    set({ auditLoading: true, error: null })
    try {
      const params: Record<string, string | number> = { limit, offset }
      if (admin_id) params.admin_id = admin_id
      const res = await api.get<{ entries: AuditLogEntry[]; total: number }>('/admin/audit-log', { params })
      set({ auditEntries: res.data.entries, auditTotal: res.data.total, auditLoading: false })
    } catch {
      set({ auditLoading: false, error: 'No se pudo cargar el audit log' })
    }
  },

  searchPlayers: async (q) => {
    if (!q.trim()) {
      set({ playerSearchResults: [] })
      return
    }
    set({ playerSearchLoading: true })
    try {
      const res = await api.get<PlayerSearchResult[]>('/players/search', { params: { q, limit: 10 } })
      set({ playerSearchResults: res.data, playerSearchLoading: false })
    } catch {
      set({ playerSearchLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
