import { useEffect, type MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, Home, RefreshCw, ShieldAlert } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Spinner } from '@/components/ui/Spinner'
import { useMatchStore } from '@/stores/match-store'
import styles from './MatchDetailPage.module.css'
import type { MatchPlayer, MatchStatus } from './types'

type BadgeTone = 'ok' | 'warn' | 'danger' | 'soft'

function statusLabel(status: MatchStatus): string {
  const labels: Record<MatchStatus, string> = {
    scheduled: 'PROGRAMADO',
    pending_result: 'CARGA DE RESULTADO',
    awaiting_confirmation: 'ESPERANDO CONFIRMACION',
    sealed: 'PARTIDO CERRADO',
    disputed: 'RESULTADO EN REVISION',
    cancelled: 'PARTIDO CANCELADO',
  }
  return labels[status]
}

function statusTone(status: MatchStatus): BadgeTone {
  const tones: Record<MatchStatus, BadgeTone> = {
    scheduled: 'soft',
    pending_result: 'warn',
    awaiting_confirmation: 'warn',
    sealed: 'ok',
    disputed: 'danger',
    cancelled: 'danger',
  }
  return tones[status]
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function tilt(event: MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const rx = ((y / rect.height) * 2 - 1) * 6
  const ry = ((x / rect.width) * 2 - 1) * -6
  event.currentTarget.style.setProperty('--tilt-rotate-x', `${rx.toFixed(2)}deg`)
  event.currentTarget.style.setProperty('--tilt-rotate-y', `${ry.toFixed(2)}deg`)
}

function resetTilt(event: MouseEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--tilt-rotate-x', '0deg')
  event.currentTarget.style.setProperty('--tilt-rotate-y', '0deg')
}

function TeamBlock({ label, players }: { label: string; players: MatchPlayer[] }) {
  return (
    <section className={styles.teamBlock} onMouseMove={tilt} onMouseLeave={resetTilt}>
      <p className={styles.teamKicker}>{label}</p>
      <ul className={styles.playerList}>
        {players.map((player) => (
          <li key={player.id} className={styles.playerRow}>
            <div className={styles.playerAvatar}>{player.name.slice(0, 2).toUpperCase()}</div>
            <div className={styles.playerBody}>
              <p className={styles.playerName}>{player.name}</p>
              <p className={styles.playerMeta}>ELO {player.elo}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ToneBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return <span className={`${styles.badge} ${styles[`badge${tone}`]}`}>{label}</span>
}

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const selectedMatch = useMatchStore((state) => state.selectedMatch)
  const isLoading = useMatchStore((state) => state.isLoading)
  const isActionLoading = useMatchStore((state) => state.isActionLoading)
  const fetchMatch = useMatchStore((state) => state.fetchMatch)
  const refreshMatch = useMatchStore((state) => state.refreshMatch)
  const clearSelectedMatch = useMatchStore((state) => state.clearSelectedMatch)
  const cancelMatch = useMatchStore((state) => state.cancelMatch)

  const matchId = id ?? ''

  useEffect(() => {
    if (!matchId) return
    void fetchMatch(matchId)
    return () => clearSelectedMatch()
  }, [matchId, fetchMatch, clearSelectedMatch])

  if (isLoading && !selectedMatch) {
    return (
      <div className={styles.loadingWrap}>
        <Header title="Partido" showBack backTo="/matchmaking" />
        <div className={styles.loadingPanel}>
          <Spinner size="lg" />
          <p className={styles.loadingText}>Actualizando datos del partido...</p>
        </div>
      </div>
    )
  }

  if (!selectedMatch) {
    return (
      <div className={styles.loadingWrap}>
        <Header title="Partido" showBack backTo="/matchmaking" />
        <div className={styles.loadingPanel}>
          <p className={styles.loadingText}>No encontramos ese partido en este momento.</p>
        </div>
      </div>
    )
  }

  const setsData = selectedMatch.sets ?? selectedMatch.result?.sets
  const scoreString = setsData
    ? setsData.map((set) => `${set.team_a_games}-${set.team_b_games}`).join(' / ')
    : '--'
  const winnerLabel = selectedMatch.winner_team
    ? `GANADOR: EQUIPO ${selectedMatch.winner_team}`
    : null

  const canConfirmDispute = selectedMatch.status === 'awaiting_confirmation'
  const canSubmitResult = selectedMatch.status === 'pending_result'
  const canCancel = selectedMatch.status === 'pending_result'

  const reveal = {
    hidden: { opacity: 0, y: 26 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.14 + index * 0.1,
        duration: 0.52,
        ease: [0.21, 0.68, 0.17, 1],
      },
    }),
  }

  return (
    <div className={styles.page}>
      <Header
        title="Detalle del partido"
        showBack
        backTo="/matchmaking"
        right={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => void refreshMatch(selectedMatch.id)}
              aria-label="Refrescar partido"
            >
              <RefreshCw size={18} />
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => navigate('/matchmaking')}
              aria-label="Volver al inicio"
            >
              <Home size={18} />
            </button>
          </div>
        }
      />

      <div className={styles.diagonalAccent} aria-hidden="true" />

      <motion.section className={styles.hero} initial="hidden" animate="visible" variants={reveal as any} custom={0}>
        <div className={styles.heroTop}>
          <ToneBadge label={statusLabel(selectedMatch.status)} tone={statusTone(selectedMatch.status)} />
          <p className={styles.matchType}>{(selectedMatch.match_type ?? 'male').toUpperCase()}</p>
        </div>

        <div className={styles.heroScoreBlock} onMouseMove={tilt} onMouseLeave={resetTilt}>
          <p className={styles.heroKicker}>MARCADOR</p>
          <p className={styles.score}>{scoreString}</p>
          {winnerLabel && <p className={styles.heroKicker}>{winnerLabel}</p>}
          <p className={styles.heroMeta}>PARTIDO #{selectedMatch.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </motion.section>

      <section className={styles.grid}>
        <motion.article className={styles.timelineCard} initial="hidden" animate="visible" variants={reveal as any} custom={1}>
          <p className={styles.cardLabel}>Dia y horario</p>
          <div className={styles.timelineRow}>
            <Calendar size={16} />
            <span>{formatDateLabel(selectedMatch.scheduled_at)}</span>
          </div>
          <p className={styles.timelineHint}>Si hay cambios de estado, podes actualizar manualmente con el boton de refresco.</p>
        </motion.article>

        <motion.article className={styles.teamsCard} initial="hidden" animate="visible" variants={reveal as any} custom={2}>
          <div className={styles.teamsGrid}>
            <TeamBlock label="EQUIPO A" players={selectedMatch.team_a} />
            <TeamBlock label="EQUIPO B" players={selectedMatch.team_b} />
          </div>
        </motion.article>

        <motion.article className={styles.actionsCard} initial="hidden" animate="visible" variants={reveal as any} custom={3}>
          <p className={styles.cardLabel}>Acciones</p>
          <div className={styles.commandStack}>
            {canSubmitResult && (
              <button type="button" className={styles.primaryCommand} onClick={() => navigate(`/matches/${selectedMatch.id}/result`)}>
                Cargar resultado
              </button>
            )}

            {canConfirmDispute && (
              <button type="button" className={styles.primaryCommand} onClick={() => navigate(`/matches/${selectedMatch.id}/confirm`)}>
                Confirmar o disputar
              </button>
            )}

            {canCancel && (
              <button
                type="button"
                className={styles.dangerCommand}
                onClick={() => void cancelMatch(selectedMatch.id)}
                disabled={isActionLoading}
              >
                {isActionLoading ? 'Cancelando...' : 'Cancelar partido'}
              </button>
            )}

            {(selectedMatch.status === 'disputed' || selectedMatch.dispute_reason) && (
              <div className={styles.disputeBox}>
                <ShieldAlert size={16} />
                <p>{selectedMatch.dispute_reason ?? 'Partido marcado en disputa.'}</p>
              </div>
            )}
          </div>
        </motion.article>
      </section>

      <AnimatePresence>
        {selectedMatch.status === 'awaiting_confirmation' && (
          <motion.div
            className={styles.bottomStrip}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <p className={styles.stripTitle}>Esperando confirmacion del capitan rival.</p>
            <p className={styles.stripSubtitle}>La ventana de confirmacion permanece abierta por 6 horas.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

