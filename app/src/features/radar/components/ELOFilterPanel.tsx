import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, X, ChevronUp } from 'lucide-react'
import type { ELORange, RadiusOption } from '@/types/radar'

interface ELOFilterPanelProps {
  eloRange: ELORange
  radiusKm: RadiusOption
  onELORangeChange: (range: ELORange) => void
  onRadiusChange: (radius: RadiusOption) => void
}

const RADIUS_OPTIONS: RadiusOption[] = [5, 10, 15, 25]
const ELO_MIN = 400
const ELO_MAX = 2000
const DEBOUNCE_MS = 500

export function ELOFilterPanel({
  eloRange,
  radiusKm,
  onELORangeChange,
  onRadiusChange,
}: ELOFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  // Local slider state for smooth dragging (debounced before propagating)
  const [localRange, setLocalRange] = useState<ELORange>(eloRange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync when external eloRange changes (e.g. on first load with persisted state)
  useEffect(() => {
    setLocalRange(eloRange)
  }, [eloRange.min, eloRange.max]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleMinChange(value: number) {
    const clamped = Math.min(value, localRange.max - 50)
    const next = { ...localRange, min: clamped }
    setLocalRange(next)
    schedulePropagation(next)
  }

  function handleMaxChange(value: number) {
    const clamped = Math.max(value, localRange.min + 50)
    const next = { ...localRange, max: clamped }
    setLocalRange(next)
    schedulePropagation(next)
  }

  function schedulePropagation(range: ELORange) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onELORangeChange(range)
    }, DEBOUNCE_MS)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="mx-3 mb-2">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={[
          'w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-colors duration-150',
          'min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
          isOpen
            ? 'bg-bg-card border-padel-green/50 text-text-primary'
            : 'bg-bg-card/80 border-border text-text-secondary hover:text-text-primary hover:border-border/80',
        ].join(' ')}
        aria-expanded={isOpen}
        aria-label="Filtros de búsqueda"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filtros
          {/* Active indicator */}
          {(radiusKm !== 10 || localRange.min !== 800 || localRange.max !== 1400) && (
            <span className="h-1.5 w-1.5 rounded-full bg-padel-green" aria-label="Filtros activos" />
          )}
        </span>
        <span className="flex items-center gap-1 text-xs text-text-secondary">
          {radiusKm} km · ELO {localRange.min}–{localRange.max}
          <ChevronUp
            size={14}
            className={`transition-transform duration-200 ${isOpen ? '' : 'rotate-180'}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* Expandable panel */}
      <div
        className={[
          'overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
      >
        <div className="bg-bg-card border border-border border-t-0 rounded-b-xl px-4 py-4 space-y-5">
          {/* Radius selector */}
          <fieldset>
            <legend className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Radio de búsqueda
            </legend>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => onRadiusChange(r)}
                  className={[
                    'flex-1 h-9 rounded-lg text-sm font-medium transition-colors duration-150',
                    'min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green',
                    radiusKm === r
                      ? 'bg-padel-green text-bg-dark font-bold'
                      : 'bg-bg-input text-text-secondary hover:text-text-primary',
                  ].join(' ')}
                  aria-pressed={radiusKm === r}
                  aria-label={`Radio ${r} kilómetros`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </fieldset>

          {/* ELO range */}
          <fieldset>
            <legend className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Rango ELO
            </legend>
            <div className="space-y-3">
              {/* Min slider */}
              <div>
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <label htmlFor="elo-min">Mínimo</label>
                  <span className="font-mono text-padel-green font-semibold">{localRange.min}</span>
                </div>
                <input
                  id="elo-min"
                  type="range"
                  min={ELO_MIN}
                  max={ELO_MAX}
                  step={50}
                  value={localRange.min}
                  onChange={(e) => handleMinChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-bg-input rounded-full appearance-none cursor-pointer accent-padel-green"
                  aria-label={`ELO mínimo: ${localRange.min}`}
                />
              </div>

              {/* Max slider */}
              <div>
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <label htmlFor="elo-max">Máximo</label>
                  <span className="font-mono text-padel-green font-semibold">{localRange.max}</span>
                </div>
                <input
                  id="elo-max"
                  type="range"
                  min={ELO_MIN}
                  max={ELO_MAX}
                  step={50}
                  value={localRange.max}
                  onChange={(e) => handleMaxChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-bg-input rounded-full appearance-none cursor-pointer accent-padel-green"
                  aria-label={`ELO máximo: ${localRange.max}`}
                />
              </div>
            </div>
          </fieldset>

          {/* Reset */}
          <button
            onClick={() => {
              const reset: ELORange = { min: 800, max: 1400 }
              setLocalRange(reset)
              onELORangeChange(reset)
              onRadiusChange(10)
            }}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-rose-400 transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green rounded"
            aria-label="Restablecer filtros"
          >
            <X size={12} aria-hidden="true" />
            Restablecer filtros
          </button>
        </div>
      </div>
    </div>
  )
}
