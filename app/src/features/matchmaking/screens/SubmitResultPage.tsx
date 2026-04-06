import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { SetScoreInput } from '../components/SetScoreInput'
import { useMatchStore } from '@/stores/match-store'
import type { SetScore } from '../types'

const INITIAL_SET: SetScore = { team_a_games: 0, team_b_games: 0 }

function countWins(sets: SetScore[]): [number, number] {
  let a = 0
  let b = 0
  for (const s of sets) {
    if (s.team_a_games > s.team_b_games) a++
    else if (s.team_b_games > s.team_a_games) b++
  }
  return [a, b]
}

function isValidResult(sets: SetScore[]): boolean {
  if (sets.length < 2) return false
  const [a, b] = countWins(sets)
  // Someone must win more sets
  return a !== b
}

export function SubmitResultPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const selectedMatch = useMatchStore((s) => s.selectedMatch)
  const isActionLoading = useMatchStore((s) => s.isActionLoading)
  const error = useMatchStore((s) => s.error)
  const submitResult = useMatchStore((s) => s.submitResult)
  const clearError = useMatchStore((s) => s.clearError)

  const [sets, setSets] = useState<SetScore[]>([{ ...INITIAL_SET }, { ...INITIAL_SET }])
  const [setErrors, setSetErrors] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const matchId = id ?? ''
  const teamA = selectedMatch?.team_a ?? []
  const teamB = selectedMatch?.team_b ?? []

  const handleSetChange = (index: number, score: SetScore) => {
    setSets((prev) => prev.map((s, i) => (i === index ? score : s)))
    setSetErrors([])
  }

  const handleAddSet = () => {
    if (sets.length < 3) setSets((prev) => [...prev, { ...INITIAL_SET }])
  }

  const handleRemoveSet = (index: number) => {
    if (sets.length > 2) setSets((prev) => prev.filter((_, i) => i !== index))
  }

  const validate = (): boolean => {
    const errors: string[] = []
    for (const [i, s] of sets.entries()) {
      if (s.team_a_games === s.team_b_games) {
        errors[i] = 'Un set no puede terminar en empate'
      }
    }
    setSetErrors(errors)
    if (errors.some(Boolean)) return false
    if (!isValidResult(sets)) {
      setSetErrors(['El resultado total debe tener un ganador claro'])
      return false
    }
    return true
  }

  const handlePreview = () => {
    clearError()
    if (validate()) setShowPreview(true)
  }

  const handleSubmit = async () => {
    clearError()
    try {
      await submitResult(matchId, sets)
      navigate(`/matches/${matchId}`)
    } catch {
      setShowPreview(false)
    }
  }

  const [winsA, winsB] = countWins(sets)
  const scoreString = sets.map((s) => `${s.team_a_games}-${s.team_b_games}`).join(' / ')
  const teamALabel = teamA.map((p) => p.name).join(' & ') || 'Equipo A'
  const teamBLabel = teamB.map((p) => p.name).join(' & ') || 'Equipo B'

  if (showPreview) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Confirmar resultado" showBack />
        <div className="px-4 pt-6 space-y-6 pb-8">
          <div className="bg-bg-card border border-border rounded-xl p-6 space-y-4 text-center">
            <p className="text-sm text-text-secondary">Resultado del partido</p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{teamALabel}</p>
                <p className="text-3xl font-bold text-padel-green mt-1">{winsA}</p>
                <p className="text-xs text-text-secondary">sets</p>
              </div>
              <div className="text-text-secondary text-xl font-bold">vs</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{teamBLabel}</p>
                <p className="text-3xl font-bold text-text-primary mt-1">{winsB}</p>
                <p className="text-xs text-text-secondary">sets</p>
              </div>
            </div>
            <p className="text-lg font-semibold text-text-primary">{scoreString}</p>
          </div>

          {error && (
            <div role="alert" className="bg-trust-low/10 border border-trust-low/30 rounded-xl p-3 text-sm text-trust-low">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Button fullWidth size="lg" loading={isActionLoading} onClick={handleSubmit}>
              Confirmar y enviar resultado
            </Button>
            <Button fullWidth variant="ghost" onClick={() => setShowPreview(false)}>
              Volver a editar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Cargar resultado" showBack />

      <div className="px-4 pt-4 space-y-6 pb-8">
        {/* Teams header */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 text-sm font-medium">
            <span className="text-text-primary flex-1 text-center">{teamALabel}</span>
            <span className="text-text-secondary shrink-0">vs</span>
            <span className="text-text-primary flex-1 text-center">{teamBLabel}</span>
          </div>
        </div>

        {/* Set inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs text-text-secondary w-12" />
              <span className="text-xs font-medium text-text-secondary w-16 text-center">Eq. A</span>
              <span className="text-xs text-text-secondary mx-1" />
              <span className="text-xs font-medium text-text-secondary w-16 text-center">Eq. B</span>
            </div>
          </div>

          {sets.map((set, i) => (
            <SetScoreInput
              key={i}
              setNumber={i + 1}
              value={set}
              onChange={(score) => handleSetChange(i, score)}
              onRemove={() => handleRemoveSet(i)}
              canRemove={sets.length > 2}
              error={setErrors[i]}
            />
          ))}

          {typeof setErrors[0] === 'string' && !setErrors[0].includes('set') && (
            <p role="alert" className="text-xs text-trust-low">{setErrors[0]}</p>
          )}
        </div>

        {sets.length < 3 && (
          <button
            type="button"
            onClick={handleAddSet}
            className="w-full flex items-center justify-center gap-2 min-h-11 rounded-xl border border-dashed border-border text-sm text-text-secondary hover:border-padel-green hover:text-padel-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
          >
            <Plus size={14} aria-hidden="true" />
            Agregar set {sets.length + 1}
          </button>
        )}

        <p className="text-xs text-text-secondary text-center">
          Mínimo 2 sets. Máximo 3. El ganador debe ganar más sets que el rival.
        </p>

        <Button fullWidth size="lg" onClick={handlePreview}>
          Previsualizar resultado
        </Button>
      </div>
    </div>
  )
}
