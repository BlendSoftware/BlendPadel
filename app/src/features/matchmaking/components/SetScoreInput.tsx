import type { SetScore } from '../types'

interface SetScoreInputProps {
  setNumber: number
  value: SetScore
  onChange: (score: SetScore) => void
  onRemove?: () => void
  canRemove?: boolean
  error?: string
}

function clampGames(val: number): number {
  return Math.max(0, Math.min(7, val))
}

export function SetScoreInput({
  setNumber,
  value,
  onChange,
  onRemove,
  canRemove = false,
  error,
}: SetScoreInputProps) {
  const handleTeamA = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) onChange({ ...value, team_a_games: clampGames(n) })
  }

  const handleTeamB = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) onChange({ ...value, team_b_games: clampGames(n) })
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-text-secondary w-12 shrink-0">
          Set {setNumber}
        </span>

        <div className="flex items-center gap-2 flex-1">
          {/* Team A */}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={7}
            value={value.team_a_games}
            onChange={(e) => handleTeamA(e.target.value)}
            aria-label={`Set ${setNumber} — juegos equipo A`}
            className={[
              'w-16 h-12 text-center text-lg font-bold rounded-xl',
              'bg-bg-input text-text-primary border transition-colors',
              'focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green',
              error ? 'border-trust-low' : 'border-border',
            ].join(' ')}
          />

          <span className="text-text-secondary font-bold text-lg select-none">-</span>

          {/* Team B */}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={7}
            value={value.team_b_games}
            onChange={(e) => handleTeamB(e.target.value)}
            aria-label={`Set ${setNumber} — juegos equipo B`}
            className={[
              'w-16 h-12 text-center text-lg font-bold rounded-xl',
              'bg-bg-input text-text-primary border transition-colors',
              'focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green',
              error ? 'border-trust-low' : 'border-border',
            ].join(' ')}
          />
        </div>

        {canRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Eliminar set ${setNumber}`}
            className="min-h-11 min-w-11 flex items-center justify-center text-text-secondary hover:text-trust-low transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-trust-low ml-16 pl-3">
          {error}
        </p>
      )}
    </div>
  )
}
