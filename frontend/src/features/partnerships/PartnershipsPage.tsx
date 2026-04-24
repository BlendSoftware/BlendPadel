import { useEffect, useState } from 'react'
import { ArrowLeft, Users, UserPlus, Search, Check, X, TrendingUp, Crown, Trash2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePartnershipStore } from '@/stores/partnership-store'
import { useAuthStore } from '@/stores/auth-store'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/services/api'
import styles from '@/features/profile/SubPage.module.css'
import localStyles from './PartnershipsPage.module.css'

// ─── Player search ─────────────────────────────────────────────────────────────

interface PlayerResult { id: string; name: string; elo: number }

function usePlayerSearch() {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<PlayerResult[]>([])
  const [searching, setSearching] = useState(false)

  async function search(q: string) {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await api.get<PlayerResult[]>('/players/search', { params: { q: q.trim() } })
      setResults(res.data ?? [])
    } catch { /* silently fail */ } finally {
      setSearching(false)
    }
  }

  function clear() { setQuery(''); setResults([]) }
  return { query, results, searching, search, clear }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function PartnershipsPage() {
  const navigate          = useNavigate()
  const userId            = useAuthStore((s) => s.user?.id)

  const partnerships      = usePartnershipStore((s) => s.partnerships)
  const bestPartner       = usePartnershipStore((s) => s.bestPartner)
  const isLoading         = usePartnershipStore((s) => s.isLoading)
  const isActionLoading   = usePartnershipStore((s) => s.isActionLoading)
  const error             = usePartnershipStore((s) => s.error)
  const fetchMyPartnerships = usePartnershipStore((s) => s.fetchMyPartnerships)
  const fetchBestPartner  = usePartnershipStore((s) => s.fetchBestPartner)
  const requestPartnership  = usePartnershipStore((s) => s.requestPartnership)
  const acceptPartnership   = usePartnershipStore((s) => s.acceptPartnership)
  const rejectPartnership   = usePartnershipStore((s) => s.rejectPartnership)
  const dissolvePartnership = usePartnershipStore((s) => s.dissolvePartnership)
  const clearError        = usePartnershipStore((s) => s.clearError)

  const [showSearch, setShowSearch] = useState(false)
  const { query, results, searching, search, clear } = usePlayerSearch()

  useEffect(() => {
    clearError()
    fetchMyPartnerships()
    fetchBestPartner()
  }, [fetchMyPartnerships, fetchBestPartner, clearError])

  const activePartnerships = partnerships.filter((p) => p.status === 'accepted')
  const pendingIncoming    = partnerships.filter((p) => p.status === 'pending' && p.partner_id === userId)
  const pendingOutgoing    = partnerships.filter((p) => p.status === 'pending' && p.requester_id === userId)
  const isEmpty            = !isLoading && !error && activePartnerships.length === 0 && pendingIncoming.length === 0 && pendingOutgoing.length === 0

  async function handleRequest(playerId: string) {
    try { await requestPartnership(playerId); clear(); setShowSearch(false) } catch { /* handled in store */ }
  }
  async function handleAccept(id: string)  { try { await acceptPartnership(id)   } catch { /* */ } }
  async function handleReject(id: string)  { try { await rejectPartnership(id)   } catch { /* */ } }
  async function handleDissolve(id: string){ try { await dissolvePartnership(id) } catch { /* */ } }

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <h1 className={styles.headerTitle}>Mis parejas</h1>
        <div className={styles.headerRight}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`${localStyles.addBtn} ${showSearch ? localStyles.addBtnActive : ''}`}
            aria-label="Agregar pareja"
          >
            <UserPlus size={18} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* ── Player search panel ── */}
        {showSearch && (
          <div className={`${styles.card} ${localStyles.searchPanel}`}>
            <p className={styles.cardTitle}>Buscar jugador</p>

            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Search size={14} /></span>
              <input
                className={`${styles.input} ${styles.inputWithIcon}`}
                placeholder="Nombre del jugador..."
                value={query}
                onChange={(e) => search(e.target.value)}
                autoFocus
              />
            </div>

            {searching && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                <Spinner size="sm" />
              </div>
            )}

            {results.length > 0 && (
              <div className={localStyles.resultsList}>
                {results.filter((r) => r.id !== userId).map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleRequest(player.id)}
                    disabled={isActionLoading}
                    className={localStyles.resultRow}
                  >
                    <div className={localStyles.resultInfo}>
                      <span className={localStyles.resultName}>{player.name}</span>
                      <span className={localStyles.resultElo}>ELO {player.elo}</span>
                    </div>
                    <UserPlus size={14} color="var(--accent-fluo)" />
                  </button>
                ))}
              </div>
            )}

            {query && !searching && results.filter((r) => r.id !== userId).length === 0 && (
              <p className={styles.fieldHint} style={{ textAlign: 'center' }}>Sin resultados para "{query}"</p>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && partnerships.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Spinner size="lg" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className={styles.errorAlert} role="alert">
            <AlertCircle size={16} className={styles.errorIcon} />
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {/* ── Best Partner highlight ── */}
        {bestPartner && (
          <div className={localStyles.bestCard}>
            <div className={localStyles.bestIcon}><Crown size={20} /></div>
            <div className={localStyles.bestBody}>
              <p className={localStyles.bestLabel}>Mejor pareja</p>
              <p className={localStyles.bestName}>{bestPartner.partner_name}</p>
              <div className={localStyles.bestMeta}>
                <span>ELO {bestPartner.partner_elo}</span>
                <span>·</span>
                <span>{bestPartner.total_matches} partidos</span>
                <span>·</span>
                <span className={localStyles.bestWinRate}>{bestPartner.win_rate_pct}% wins</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Incoming requests ── */}
        {pendingIncoming.length > 0 && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>Solicitudes recibidas</p>
            {pendingIncoming.map((p) => (
              <div key={p.id} className={localStyles.partnerRow}>
                <div className={localStyles.partnerInfo}>
                  <span className={localStyles.partnerName}>{p.partner_name ?? 'Jugador'}</span>
                  {p.partner_elo !== undefined && <span className={localStyles.partnerElo}>ELO {p.partner_elo}</span>}
                </div>
                <div className={localStyles.partnerActions}>
                  <button
                    onClick={() => handleAccept(p.id)}
                    disabled={isActionLoading}
                    className={localStyles.acceptBtn}
                    aria-label="Aceptar"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => handleReject(p.id)}
                    disabled={isActionLoading}
                    className={localStyles.rejectBtn}
                    aria-label="Rechazar"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Outgoing requests ── */}
        {pendingOutgoing.length > 0 && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>Solicitudes enviadas</p>
            {pendingOutgoing.map((p) => (
              <div key={p.id} className={localStyles.partnerRow}>
                <div className={localStyles.partnerInfo}>
                  <span className={localStyles.partnerName}>{p.partner_name ?? 'Jugador'}</span>
                </div>
                <span className={localStyles.pendingBadge}>Pendiente</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Active partnerships ── */}
        {activePartnerships.length > 0 && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>
              <Users size={12} className={styles.cardTitleIcon} />
              Parejas activas
            </p>
            {activePartnerships.map((p) => (
              <div key={p.id} className={localStyles.partnerRow}>
                <div className={localStyles.partnerIconWrap}>
                  <Users size={15} />
                </div>
                <div className={localStyles.partnerInfo}>
                  <span className={localStyles.partnerName}>{p.partner_name ?? 'Jugador'}</span>
                  {p.partner_elo !== undefined && (
                    <span className={localStyles.partnerElo}>
                      <TrendingUp size={10} /> ELO {p.partner_elo}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDissolve(p.id)}
                  disabled={isActionLoading}
                  className={localStyles.dissolveBtn}
                  aria-label="Disolver pareja"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {isEmpty && (
          <div className={localStyles.emptyState}>
            <div className={localStyles.emptyIcon}><Users size={28} /></div>
            <p className={localStyles.emptyTitle}>Sin parejas todavía</p>
            <p className={localStyles.emptySubtitle}>Buscá un compañero y mandá una solicitud de pareja</p>
            <button className={styles.submitBtn} onClick={() => setShowSearch(true)}>
              <UserPlus size={15} />
              Agregar pareja
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
