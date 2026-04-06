import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const DEBOUNCE_MS = 800

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  formatValue?: (v: number) => string
  onChange: (v: number) => void
}

function SliderRow({ label, value, min, max, step = 1, unit = '', formatValue, onChange }: SliderRowProps) {
  const display = formatValue ? formatValue(value) : `${value}${unit}`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-primary font-medium">{label}</p>
        <span className="text-padel-green font-bold text-sm tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-bg-input accent-padel-green"
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export function PreferencesPage() {
  const preferences = useProfileStore((s) => s.preferences)
  const savingPreferences = useProfileStore((s) => s.savingPreferences)
  const fetchPreferences = useProfileStore((s) => s.fetchPreferences)
  const updatePreferences = useProfileStore((s) => s.updatePreferences)

  const [radius, setRadius] = useState(10)
  const [eloMin, setEloMin] = useState(-200)
  const [eloMax, setEloMax] = useState(200)
  const [savedRecently, setSavedRecently] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Seed from store
  useEffect(() => {
    if (!preferences) {
      fetchPreferences()
      return
    }
    setRadius(preferences.radar_radius_km)
    setEloMin(preferences.elo_min_delta)
    setEloMax(preferences.elo_max_delta)
  }, [preferences, fetchPreferences])

  function scheduleUpdate(data: { radar_radius_km?: number; elo_min_delta?: number; elo_max_delta?: number }) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      await updatePreferences(data)
      setSavedRecently(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSavedRecently(false), 2000)
    }, DEBOUNCE_MS)
  }

  // BUG 15 FIX: Immediate save for cases where debounce hasn't fired
  async function handleManualSave() {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    await updatePreferences({ radar_radius_km: radius, elo_min_delta: eloMin, elo_max_delta: eloMax })
    setSavedRecently(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedRecently(false), 2000)
  }

  function handleRadiusChange(v: number) {
    setRadius(v)
    scheduleUpdate({ radar_radius_km: v })
  }

  function handleEloMinChange(v: number) {
    const clamped = Math.min(v, eloMax - 50)
    setEloMin(clamped)
    scheduleUpdate({ elo_min_delta: clamped })
  }

  function handleEloMaxChange(v: number) {
    const clamped = Math.max(v, eloMin + 50)
    setEloMax(clamped)
    scheduleUpdate({ elo_max_delta: clamped })
  }

  const statusEl = savingPreferences ? (
    <span className="flex items-center gap-1 text-xs text-text-secondary">
      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
      Guardando...
    </span>
  ) : savedRecently ? (
    <span className="flex items-center gap-1 text-xs text-trust-high">
      <Check size={12} aria-hidden="true" />
      Guardado
    </span>
  ) : null

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Preferencias"
        showBack
        right={<div className="pr-1">{statusEl}</div>}
      />

      <div className="px-4 pt-6 pb-6 space-y-4">
        {/* Radar radius */}
        <Card>
          <p className="text-sm font-semibold text-text-primary mb-4">Radio de búsqueda</p>
          <SliderRow
            label="Distancia máxima"
            value={radius}
            min={1}
            max={50}
            unit=" km"
            onChange={handleRadiusChange}
          />
          <p className="text-text-secondary text-xs mt-3">
            Solo ves flares y partidos a menos de {radius} km de tu ubicación.
          </p>
        </Card>

        {/* ELO range */}
        <Card>
          <p className="text-sm font-semibold text-text-primary mb-4">Rango ELO</p>
          <div className="space-y-5">
            <SliderRow
              label="Delta mínimo (jugadores mejor que vos)"
              value={eloMin}
              min={-500}
              max={0}
              formatValue={(v) => (v === 0 ? 'Mismo ELO' : `${v}`)}
              onChange={handleEloMinChange}
            />
            <SliderRow
              label="Delta máximo (jugadores por debajo)"
              value={eloMax}
              min={0}
              max={500}
              formatValue={(v) => (v === 0 ? 'Mismo ELO' : `+${v}`)}
              onChange={handleEloMaxChange}
            />
          </div>
          <p className="text-text-secondary text-xs mt-3">
            Buscás jugadores entre{' '}
            <span className="text-text-primary">ELO {eloMin}</span> y{' '}
            <span className="text-text-primary">ELO +{eloMax}</span> del tuyo.
          </p>
        </Card>

        {/* BUG 15 FIX: Explicit save button as fallback to debounce */}
        <Button fullWidth onClick={handleManualSave} loading={savingPreferences}>
          Guardar preferencias
        </Button>
      </div>
    </div>
  )
}
