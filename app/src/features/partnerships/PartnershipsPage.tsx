import { useEffect, useState } from 'react'
import { Users, UserPlus, Search, Check, X, TrendingUp, Crown, Trash2 } from 'lucide-react'
import { usePartnershipStore } from '@/stores/partnership-store'
import { useAuthStore } from '@/stores/auth-store'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import api from '@/services/api'

// ─── Player search (inline, lightweight) ──────────────────────────────────────

interface PlayerResult {
  id: string
  name: string
  elo: number
}

function usePlayerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerResult[]>([])
  const [searching, setSearching] = useState(false)

  async function search(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await api.get<PlayerResult[]>('/players/search', {
        params: { q: q.trim() },
      })
      setResults(res.data ?? [])
    } catch {
      // Silently fail search
    } finally {
      setSearching(false)
    }
  }

  function clear() {
    setQuery('')
    setResults([])
  }

  return { query, results, searching, search, clear }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PartnershipsPage() {
  const userId = useAuthStore((s) => s.user?.id)

  const partnerships = usePartnershipStore((s) => s.partnerships)
  const bestPartner = usePartnershipStore((s) => s.bestPartner)
  const isLoading = usePartnershipStore((s) => s.isLoading)
  const isActionLoading = usePartnershipStore((s) => s.isActionLoading)
  const error = usePartnershipStore((s) => s.error)
  const fetchMyPartnerships = usePartnershipStore((s) => s.fetchMyPartnerships)
  const fetchBestPartner = usePartnershipStore((s) => s.fetchBestPartner)
  const requestPartnership = usePartnershipStore((s) => s.requestPartnership)
  const acceptPartnership = usePartnershipStore((s) => s.acceptPartnership)
  const rejectPartnership = usePartnershipStore((s) => s.rejectPartnership)
  const dissolvePartnership = usePartnershipStore((s) => s.dissolvePartnership)
  const clearError = usePartnershipStore((s) => s.clearError)

  const [showSearch, setShowSearch] = useState(false)
  const { query, results, searching, search, clear } = usePlayerSearch()

  useEffect(() => {
    clearError()
    fetchMyPartnerships()
    fetchBestPartner()
  }, [fetchMyPartnerships, fetchBestPartner, clearError])

  const activePartnerships = partnerships.filter((p) => p.status === 'accepted')
  const pendingIncoming = partnerships.filter(
    (p) => p.status === 'pending' && p.partner_id === userId,
  )
  const pendingOutgoing = partnerships.filter(
    (p) => p.status === 'pending' && p.requester_id === userId,
  )

  async function handleRequest(playerId: string) {
    try {
      await requestPartnership(playerId)
      clear()
      setShowSearch(false)
    } catch {
      // Error shown via store
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptPartnership(id)
    } catch {
      // Error shown via store
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectPartnership(id)
    } catch {
      // Error shown via store
    }
  }

  async function handleDissolve(id: string) {
    try {
      await dissolvePartnership(id)
    } catch {
      // Error shown via store
    }
  }

  return (
    <div className="flex flex-col min-h-full page-enter">
      <Header
        title="Mis Parejas"
        showBack
        right={
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center justify-center min-h-11 min-w-11 text-padel-green hover:text-padel-green-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
            aria-label="Agregar pareja"
          >
            <UserPlus size={22} aria-hidden="true" />
          </button>
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Player search */}
        {showSearch && (
          <Card>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-text-primary">Agregar pareja</p>
              <Input
                placeholder="Buscar jugador por nombre..."
                value={query}
                onChange={(e) => search(e.target.value)}
                icon={<Search size={16} />}
                autoFocus
              />
              {searching && (
                <div className="flex justify-center py-2">
                  <Spinner size="sm" />
                </div>
              )}
              {results.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results
                    .filter((r) => r.id !== userId)
                    .map((player) => (
                      <button
                        key={player.id}
                        onClick={() => handleRequest(player.id)}
                        disabled={isActionLoading}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-bg-input transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{player.name}</p>
                          <p className="text-xs text-text-secondary">ELO {player.elo}</p>
                        </div>
                        <UserPlus size={16} className="text-padel-green shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                </div>
              )}
              {query && !searching && results.filter((r) => r.id !== userId).length === 0 && (
                <p className="text-xs text-text-secondary text-center py-2">
                  No se encontraron jugadores
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Loading */}
        {isLoading && partnerships.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-4">
            <p className="text-text-secondary text-sm mb-4">{error}</p>
            <Button variant="outline" onClick={() => fetchMyPartnerships()}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Best Partner card */}
        {bestPartner && (
          <Card>
            <div className="flex items-center gap-3">
              <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400">
                <Crown size={20} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-secondary font-medium uppercase tracking-wide">
                  Mejor pareja
                </p>
                <p className="text-sm font-semibold text-text-primary truncate">
                  {bestPartner.partner_name}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                  <span>ELO {bestPartner.partner_elo}</span>
                  <span>{bestPartner.total_matches} partidos</span>
                  <span className="text-padel-green font-medium">
                    {bestPartner.win_rate_pct}% wins
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Pending incoming requests */}
        {pendingIncoming.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Solicitudes pendientes</p>
            <div className="space-y-2">
              {pendingIncoming.map((p) => (
                <Card key={p.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {p.partner_name ?? 'Jugador'}
                      </p>
                      {p.partner_elo !== undefined && (
                        <p className="text-xs text-text-secondary">ELO {p.partner_elo}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAccept(p.id)}
                        disabled={isActionLoading}
                        className="flex items-center justify-center min-h-11 min-w-11 rounded-lg bg-padel-green/10 text-padel-green hover:bg-padel-green/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green disabled:opacity-50"
                        aria-label="Aceptar solicitud"
                      >
                        <Check size={18} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleReject(p.id)}
                        disabled={isActionLoading}
                        className="flex items-center justify-center min-h-11 min-w-11 rounded-lg bg-trust-low/10 text-trust-low hover:bg-trust-low/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green disabled:opacity-50"
                        aria-label="Rechazar solicitud"
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pending outgoing */}
        {pendingOutgoing.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Enviadas</p>
            <div className="space-y-2">
              {pendingOutgoing.map((p) => (
                <Card key={p.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {p.partner_name ?? 'Jugador'}
                      </p>
                      <Badge variant="orange">Pendiente</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Active partnerships */}
        {activePartnerships.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Parejas activas</p>
            <div className="space-y-2">
              {activePartnerships.map((p) => (
                <Card key={p.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-padel-green/10 text-padel-green">
                        <Users size={18} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {p.partner_name ?? 'Jugador'}
                        </p>
                        {p.partner_elo !== undefined && (
                          <div className="flex items-center gap-1 text-xs text-text-secondary">
                            <TrendingUp size={12} aria-hidden="true" />
                            <span>ELO {p.partner_elo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDissolve(p.id)}
                      disabled={isActionLoading}
                      className="flex items-center justify-center min-h-11 min-w-11 rounded-lg text-text-secondary hover:text-trust-low hover:bg-trust-low/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green disabled:opacity-50"
                      aria-label="Disolver pareja"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && activePartnerships.length === 0 && pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
          <EmptyState
            icon={<Users size={48} />}
            title="No tenés parejas todavía"
            subtitle="Buscá un compañero y mandá una solicitud de pareja"
            action={
              <Button onClick={() => setShowSearch(true)}>
                <UserPlus size={16} aria-hidden="true" />
                Agregar pareja
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
