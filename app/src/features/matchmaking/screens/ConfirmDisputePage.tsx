import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { ConfirmCountdown } from '../components/ConfirmCountdown'
import { useMatchStore } from '@/stores/match-store'

export function ConfirmDisputePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const selectedMatch = useMatchStore((s) => s.selectedMatch)
  const isActionLoading = useMatchStore((s) => s.isActionLoading)
  const error = useMatchStore((s) => s.error)
  const confirmResult = useMatchStore((s) => s.confirmResult)
  const disputeResult = useMatchStore((s) => s.disputeResult)
  const clearError = useMatchStore((s) => s.clearError)

  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  const matchId = id ?? ''
  const match = selectedMatch
  const result = match?.result

  const handleConfirm = async () => {
    clearError()
    try {
      await confirmResult(matchId)
      navigate(`/matches/${matchId}`)
    } catch {
      // error in store
    }
  }

  const handleDispute = async () => {
    clearError()
    if (disputeReason.trim().length < 10) {
      setReasonError('El motivo debe tener al menos 10 caracteres')
      return
    }
    try {
      await disputeResult(matchId, disputeReason.trim())
      navigate(`/matches/${matchId}`)
    } catch {
      // error in store
    }
  }

  if (!match || !result) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Confirmar resultado" showBack />
        <div className="px-4 pt-8 text-center">
          <p className="text-text-secondary">No hay resultado para confirmar</p>
        </div>
      </div>
    )
  }

  const teamA = match.team_a.map((p) => p.name).join(' & ')
  const teamB = match.team_b.map((p) => p.name).join(' & ')
  const scoreString = result.sets.map((s) => `${s.team_a_games}-${s.team_b_games}`).join(' / ')

  if (showDisputeForm) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Disputar resultado" showBack />
        <div className="px-4 pt-4 space-y-5 pb-8">
          {/* Submitted result */}
          <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-text-secondary mb-2">Resultado a disputar</p>
            <p className="text-lg font-bold text-text-primary">{teamA} vs {teamB}</p>
            <p className="text-2xl font-bold text-trust-low mt-1">{scoreString}</p>
          </div>

          {/* Warning */}
          <div className="bg-trust-medium/10 border border-trust-medium/30 rounded-xl p-4 flex gap-3">
            <AlertTriangle size={16} className="text-trust-medium mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-trust-medium">
              La disputa será revisada por el Admin en hasta 48 horas. Proporcioná un motivo claro.
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label htmlFor="dispute-reason" className="text-sm font-medium text-text-secondary">
              Motivo de la disputa *
            </label>
            <textarea
              id="dispute-reason"
              value={disputeReason}
              onChange={(e) => {
                setDisputeReason(e.target.value)
                setReasonError('')
              }}
              placeholder="Explicá por qué disputás el resultado..."
              rows={5}
              maxLength={500}
              aria-invalid={!!reasonError}
              className={[
                'w-full rounded-xl bg-bg-input text-text-primary placeholder:text-text-secondary border transition-colors px-4 py-3 text-sm resize-none',
                'focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green',
                reasonError ? 'border-trust-low' : 'border-border',
              ].join(' ')}
            />
            <div className="flex justify-between">
              {reasonError
                ? <p role="alert" className="text-xs text-trust-low">{reasonError}</p>
                : <span />
              }
              <p className="text-xs text-text-secondary">{disputeReason.length}/500</p>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-trust-low/10 border border-trust-low/30 rounded-xl p-3 text-sm text-trust-low">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Button
              fullWidth
              size="lg"
              variant="danger"
              loading={isActionLoading}
              onClick={handleDispute}
            >
              Enviar disputa
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => { setShowDisputeForm(false); clearError() }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Confirmar resultado" showBack />

      <div className="px-4 pt-4 space-y-5 pb-8">
        {/* Result submitted */}
        <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs text-text-secondary">Resultado cargado por el otro equipo</p>
          <div className="text-center space-y-1">
            <p className="font-semibold text-text-primary">{teamA} vs {teamB}</p>
            <p className="text-2xl font-bold text-text-primary">{scoreString}</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <ConfirmCountdown submittedAt={result.submitted_at} />
        </div>

        {error && (
          <div role="alert" className="bg-trust-low/10 border border-trust-low/30 rounded-xl p-3 text-sm text-trust-low">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            fullWidth
            size="lg"
            loading={isActionLoading}
            onClick={handleConfirm}
          >
            <CheckCircle size={18} aria-hidden="true" />
            Confirmar resultado
          </Button>

          <Button
            fullWidth
            size="lg"
            variant="danger"
            disabled={isActionLoading}
            onClick={() => setShowDisputeForm(true)}
          >
            <AlertTriangle size={18} aria-hidden="true" />
            Disputar resultado
          </Button>
        </div>

        <p className="text-xs text-text-secondary text-center">
          Si no respondés antes de que venza el tiempo, el resultado se confirma automáticamente.
        </p>
      </div>
    </div>
  )
}
