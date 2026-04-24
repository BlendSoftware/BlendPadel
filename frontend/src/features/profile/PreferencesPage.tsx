import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/stores/profile-store'
import styles from './SubPage.module.css'

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
    <div className={styles.sliderRow}>
      <div className={styles.sliderHead}>
        <p className={styles.sliderLabel}>{label}</p>
        <span className={styles.sliderValue}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
      />
      <div className={styles.sliderRange}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export function PreferencesPage() {
  const navigate            = useNavigate()
  const preferences         = useProfileStore((s) => s.preferences)
  const error               = useProfileStore((s) => s.error)
  const savingPreferences   = useProfileStore((s) => s.savingPreferences)
  const fetchPreferences    = useProfileStore((s) => s.fetchPreferences)
  const updatePreferences   = useProfileStore((s) => s.updatePreferences)

  const [radius,       setRadius]       = useState(10)
  const [eloMin,       setEloMin]       = useState(-200)
  const [eloMax,       setEloMax]       = useState(200)
  const [savedRecently, setSavedRecently] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!preferences) { fetchPreferences(); return }
    setRadius(preferences.radar_radius_km)
    setEloMin(preferences.elo_min_delta)
    setEloMax(preferences.elo_max_delta)
  }, [preferences, fetchPreferences])

  function scheduleUpdate(data: { radar_radius_km?: number; elo_min_delta?: number; elo_max_delta?: number }) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        await updatePreferences(data)
        setSavedRecently(true)
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSavedRecently(false), 2000)
      } catch { /* handled in store */ }
    }, DEBOUNCE_MS)
  }

  async function handleManualSave() {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
    try {
      await updatePreferences({ radar_radius_km: radius, elo_min_delta: eloMin, elo_max_delta: eloMax })
      setSavedRecently(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSavedRecently(false), 2000)
    } catch { /* handled in store */ }
  }

  const statusEl = savingPreferences ? (
    <span className={`${styles.saveStatus} ${styles.saveStatusSaving}`}>
      <Loader2 size={12} className="animate-spin" />
      Guardando...
    </span>
  ) : savedRecently ? (
    <span className={`${styles.saveStatus} ${styles.saveStatusSaved}`}>
      <Check size={12} />
      Guardado
    </span>
  ) : null

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <h1 className={styles.headerTitle}>Preferencias</h1>
        {statusEl && <div className={styles.headerRight}>{statusEl}</div>}
      </div>

      <div className={styles.body}>
        {/* ── Radio de búsqueda ── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Radio de búsqueda</p>
          <SliderRow
            label="Distancia máxima"
            value={radius}
            min={1}
            max={50}
            unit=" km"
            onChange={(v) => { setRadius(v); scheduleUpdate({ radar_radius_km: v }) }}
          />
          <p className={styles.fieldHint}>
            Solo ves flares y partidos a menos de {radius} km de tu ubicación.
          </p>
        </div>

        {/* ── Rango ELO ── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Rango ELO competitivo</p>
          <SliderRow
            label="Delta mínimo (jugadores mejor que vos)"
            value={eloMin}
            min={-500}
            max={0}
            formatValue={(v) => (v === 0 ? 'Mismo ELO' : `${v}`)}
            onChange={(v) => {
              const clamped = Math.min(v, eloMax - 50)
              setEloMin(clamped)
              scheduleUpdate({ elo_min_delta: clamped })
            }}
          />
          <SliderRow
            label="Delta máximo (jugadores por debajo)"
            value={eloMax}
            min={0}
            max={500}
            formatValue={(v) => (v === 0 ? 'Mismo ELO' : `+${v}`)}
            onChange={(v) => {
              const clamped = Math.max(v, eloMin + 50)
              setEloMax(clamped)
              scheduleUpdate({ elo_max_delta: clamped })
            }}
          />
          <p className={styles.fieldHint}>
            Buscás jugadores entre ELO {eloMin} y ELO +{eloMax} del tuyo.
          </p>
        </div>

        {error && (
          <div className={styles.errorAlert} role="alert">
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        <button
          className={styles.submitBtn}
          onClick={handleManualSave}
          disabled={savingPreferences}
          type="button"
        >
          {savingPreferences
            ? <><span className={styles.btnSpinner} /> Guardando…</>
            : 'Guardar preferencias'
          }
        </button>
      </div>
    </div>
  )
}
