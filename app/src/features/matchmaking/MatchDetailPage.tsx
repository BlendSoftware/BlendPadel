import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, MapPin, Flag } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmCountdown } from './components/ConfirmCountdown'
import { useMatchStore } from '@/stores/match-store'
import { useAuthStore } from '@/stores/auth-store'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { ProjectionCard } from '@/features/rankings/ProjectionCard'
import type { MatchDetail, MatchPlayer, MatchStatus } from './types'

// ─── Status badge ─────────────────────────────────────────────────────────────

type BadgeVariant = 'green' | 'blue' | 'orange' | 'gray' | 'trust-low'

function statusLabel(status: MatchStatus): string {
  const labels: Record<MatchStatus, string> = {
    scheduled: 'Programado',
    pending_result: 'Pendiente resultado',
    awaiting_confirmation: 'Esperando confirmación',
    sealed: 'Sellado',
    disputed: 'Disputado',
    cancelled: 'Cancelado',
  }
  return labels[status]
}

function statusBadgeVariant(status: MatchStatus): BadgeVariant {
  const v: Record<MatchStatus, BadgeVariant> = {
    scheduled: 'blue',
    pending_result: 'orange',
    awaiting_confirmation: 'orange',
    sealed: 'green',
    disputed: 'trust-low',
    cancelled: 'gray',
  }
  return v[status]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ─── Team row ─────────────────────────────────────────────────────────────────

function TeamRow({ players, label }: { players: MatchPlayer[]; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label}</p>
      <div className="space-y-2">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Avatar src={p.avatar_url} name={p.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <CategoryBadge elo={p.elo} />
                <span className="text-xs text-text-secondary">ELO {p.elo}</span>
              </div>
            </div>
            {p.elo_delta !== undefined && p.elo_delta !== null && (
              <span className={['text-sm font-bold', p.elo_delta >= 0 ? 'text-padel-green' : 'text-trust-low'].join(' ')}>
                {p.elo_delta >= 0 ? '+' : ''}{p.elo_delta}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Report misconduct modal ──────────────────────────────────────────────────

interface ReportModalProps {
  match: MatchDetail
  onClose: () => void
}

function ReportMisconductModal({ match, onClose }: ReportModalProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [descError, setDescError] = useState('')
  const isActionLoading = useMatchStore((s) => s.isActionLoading)
  const error = useMatchStore((s) => s.error)
  const reportMisconduct = useMatchStore((s) => s.reportMisconduct)
  const clearError = useMatchStore((s) => s.clearError)
  const [done, setDone] = useState(false)

  const allPlayers = [...match.team_a, ...match.team_b]

  const handleSubmit = async () => {
    clearError()
    if (!selectedPlayerId) {
      setDescError('Seleccioná un jugador')
      return
    }
    if (description.trim().length < 15) {
      setDescError('La descripción debe tener al menos 15 caracteres')
      return
    }
    try {
      await reportMisconduct(match.id, selectedPlayerId, description.trim())
      setDone(true)
    } catch {
      // error in store
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-bg-dark/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Reportar conducta"
    >
      <div className="w-full bg-bg-card rounded-t-2xl border-t border-border p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Reportar conducta</h2>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 flex items-center justify-center text-text-secondary hover:text-text-primary rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {done ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-padel-green font-semibold">Reporte enviado</p>
            <p className="text-sm text-text-secondary">El Admin revisará tu reporte pronto.</p>
            <Button variant="ghost" fullWidth onClick={onClose}>Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-secondary">Jugador a reportar</p>
              <div className="space-y-2">
                {allPlayers.map((p) => (
                  <label
                    key={p.id}
                    className={[
                      'flex items-center gap-3 p-3 rounded-xl border cursor-pointer min-h-11 transition-colors',
                      selectedPlayerId === p.id
                        ? 'border-padel-green bg-padel-green/10'
                        : 'border-border hover:bg-bg-input',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="reported-player"
                      value={p.id}
                      checked={selectedPlayerId === p.id}
                      onChange={() => { setSelectedPlayerId(p.id); setDescError('') }}
                      className="sr-only"
                    />
                    <Avatar src={p.avatar_url} name={p.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{p.name}</p>
                      <p className="text-xs text-text-secondary">ELO {p.elo}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="report-desc" className="text-sm font-medium text-text-secondary">
                Descripción *
              </label>
              <textarea
                id="report-desc"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setDescError('') }}
                placeholder="Describí qué pasó..."
                rows={4}
                maxLength={500}
                className="w-full rounded-xl bg-bg-input text-text-primary placeholder:text-text-secondary border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green transition-colors"
              />
              {descError && <p role="alert" className="text-xs text-trust-low">{descError}</p>}
              {error && <p role="alert" className="text-xs text-trust-low">{error}</p>}
            </div>

            <Button fullWidth variant="danger" loading={isActionLoading} onClick={handleSubmit}>
              <Flag size={14} aria-hidden="true" />
              Enviar reporte
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const selectedMatch = useMatchStore((s) => s.selectedMatch)
  const isLoading = useMatchStore((s) => s.isLoading)
  const fetchMatch = useMatchStore((s) => s.fetchMatch)
  const clearSelectedMatch = useMatchStore((s) => s.clearSelectedMatch)

  const [showReport, setShowReport] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const isActionLoading = useMatchStore((s) => s.isActionLoading)
  const cancelMatch = useMatchStore((s) => s.cancelMatch)

  const matchId = id ?? ''

  useEffect(() => {
    fetchMatch(matchId)
    return () => clearSelectedMatch()
  }, [matchId, fetchMatch, clearSelectedMatch])

  // Poll every 60s when awaiting_confirmation
  useEffect(() => {
    if (selectedMatch?.status !== 'awaiting_confirmation') return
    const interval = setInterval(() => fetchMatch(matchId), 60_000)
    return () => clearInterval(interval)
  }, [selectedMatch?.status, matchId, fetchMatch])

  if (isLoading && !selectedMatch) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Detalle del partido" showBack />
        <div className="flex items-center justify-center flex-1 py-16">
          <Spinner />
        </div>
      </div>
    )
  }

  if (!selectedMatch) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Detalle del partido" showBack />
        <div className="px-4 pt-8 text-center">
          <p className="text-text-secondary">Partido no encontrado</p>
        </div>
      </div>
    )
  }

  const match = selectedMatch
  const userId = user?.id ?? ''
  // Coerce both sides to string for safe comparison (backend may return numeric IDs)
  const isCaptainA = userId !== '' && String(match.captain_a_id) === String(userId)
  const isCaptainB = userId !== '' && String(match.captain_b_id) === String(userId)
  const scoreString = match.result
    ? match.result.sets.map((s) => `${s.team_a_games}-${s.team_b_games}`).join(' / ')
    : null

  const canSubmitResult = match.status === 'pending_result' && isCaptainA
  const canConfirmDispute = match.status === 'awaiting_confirmation' && isCaptainB
  const canCancel = match.status === 'pending_result' && (isCaptainA || isCaptainB)
  const canReport = match.status === 'sealed' || match.status === 'disputed'

  const handleCancel = async () => {
    try {
      await cancelMatch(match.id)
      navigate('/matchmaking')
    } catch {
      // error in store
    }
  }

  return (
    <>
      <div className="flex flex-col min-h-full">
        <Header
          title="Detalle del partido"
          showBack
          right={
            canReport ? (
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center justify-center min-h-11 min-w-11 text-text-secondary hover:text-trust-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded-lg"
                aria-label="Reportar conducta"
              >
                <Flag size={18} aria-hidden="true" />
              </button>
            ) : undefined
          }
        />

        <div className="px-4 pt-4 space-y-4 pb-8">
          {/* Status + date */}
          <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Estado</span>
              <Badge variant={statusBadgeVariant(match.status)}>
                {statusLabel(match.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Calendar size={14} aria-hidden="true" />
              <span>{formatDate(match.scheduled_at)}</span>
            </div>
            {match.latitude !== null && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <MapPin size={14} aria-hidden="true" />
                <span>Ubicación disponible</span>
              </div>
            )}
          </div>

          {/* Teams */}
          <div className="bg-bg-card border border-border rounded-xl p-4 space-y-4">
            <TeamRow players={match.team_a} label="Equipo A" />
            <div className="border-t border-border" />
            <TeamRow players={match.team_b} label="Equipo B" />
          </div>

          {/* ELO projection — show for non-sealed matches when all players have ELO > 0 */}
          {match.status !== 'sealed' && match.status !== 'cancelled' && match.status !== 'disputed' &&
           match.team_a.every((p) => p.elo > 0) && match.team_b.every((p) => p.elo > 0) && (
            <ProjectionCard
              teamA={match.team_a.map((p) => p.elo)}
              teamB={match.team_b.map((p) => p.elo)}
            />
          )}

          {/* Result (if exists) */}
          {match.result && (
            <div className="bg-bg-card border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs text-text-secondary">Resultado</p>
              <p className="text-2xl font-bold text-text-primary text-center">{scoreString}</p>
              {match.status === 'awaiting_confirmation' && (
                <p className="text-xs text-text-secondary text-center">
                  Esperando confirmación del Equipo B
                </p>
              )}
            </div>
          )}

          {/* Countdown for awaiting_confirmation */}
          {match.status === 'awaiting_confirmation' && match.result && (
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <ConfirmCountdown submittedAt={match.result.submitted_at} />
            </div>
          )}

          {/* Dispute reason */}
          {match.status === 'disputed' && match.dispute_reason && (
            <div className="bg-trust-low/10 border border-trust-low/30 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-trust-low uppercase tracking-wider">Motivo de disputa</p>
              <p className="text-sm text-text-secondary">{match.dispute_reason}</p>
              <p className="text-xs text-text-secondary mt-2">
                El Admin revisará la disputa en hasta 48 horas.
              </p>
            </div>
          )}

          {/* Actions */}
          {canSubmitResult && (
            <Button fullWidth size="lg" onClick={() => navigate(`/matches/${match.id}/result`)}>
              Cargar resultado
            </Button>
          )}

          {canConfirmDispute && (
            <Button fullWidth size="lg" onClick={() => navigate(`/matches/${match.id}/confirm`)}>
              Confirmar o disputar resultado
            </Button>
          )}

          {canCancel && !showCancelConfirm && (
            <Button
              fullWidth
              variant="danger"
              onClick={() => setShowCancelConfirm(true)}
            >
              Cancelar partido
            </Button>
          )}

          {canCancel && showCancelConfirm && (
            <div className="bg-trust-low/10 border border-trust-low/30 rounded-xl p-4 space-y-3">
              <p className="text-sm text-text-primary">
                ¿Estás seguro? Si faltan menos de 3 horas se penaliza tu Trust Score.
              </p>
              <div className="flex gap-3">
                <Button
                  fullWidth
                  variant="ghost"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Volver
                </Button>
                <Button
                  fullWidth
                  variant="danger"
                  loading={isActionLoading}
                  onClick={handleCancel}
                >
                  Confirmar cancelación
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <ReportMisconductModal match={match} onClose={() => setShowReport(false)} />
      )}
    </>
  )
}
