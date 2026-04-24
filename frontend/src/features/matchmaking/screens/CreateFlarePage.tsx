import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Zap, AlertCircle } from 'lucide-react'
import { useMatchmakingStore } from '@/stores/matchmaking-store'
import type { MatchType } from '../types'

// Re-use the shared sub-page styles for consistency
import styles from '../../../features/profile/SubPage.module.css'

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function minDatetime(): string {
  return toLocalDatetimeValue(new Date(Date.now() + 30 * 60 * 1000))
}

const MATCH_TYPES = [
  { value: 'male'   as const, label: 'Masculino', css: styles.typeBtnMale },
  { value: 'female' as const, label: 'Femenino',  css: styles.typeBtnFemale },
  { value: 'mixed'  as const, label: 'Mixto',     css: styles.typeBtnMixed },
]

export function CreateFlarePage() {
  const navigate     = useNavigate()
  const isLoading    = useMatchmakingStore((s) => s.isLoading)
  const error        = useMatchmakingStore((s) => s.error)
  const createFlare  = useMatchmakingStore((s) => s.createFlare)
  const clearError   = useMatchmakingStore((s) => s.clearError)

  const [matchType,       setMatchType]       = useState<MatchType>('male')
  const [scheduledAt,     setScheduledAt]     = useState('')
  const [lat,             setLat]             = useState<number | null>(null)
  const [lng,             setLng]             = useState<number | null>(null)
  const [locationError,   setLocationError]   = useState('')
  const [gettingLocation, setGettingLocation] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ scheduledAt?: string }>({})
  const [hasSubmitted,    setHasSubmitted]    = useState(false)

  useEffect(() => { clearError() }, [clearError])

  function handleGetLocation() {
    if (!navigator.geolocation) { setLocationError('Tu dispositivo no soporta geolocalización'); return }
    setGettingLocation(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setGettingLocation(false) },
      ()    => { setLocationError('No se pudo obtener la ubicación. Verificá los permisos.'); setGettingLocation(false) },
    )
  }

  function validate(): boolean {
    const errors: typeof fieldErrors = {}
    if (!scheduledAt)                           errors.scheduledAt = 'La fecha y hora son obligatorias'
    else if (new Date(scheduledAt) <= new Date()) errors.scheduledAt = 'La fecha debe ser futura'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setHasSubmitted(true)
    clearError()
    if (!validate()) return
    try {
      await createFlare({
        scheduled_at: new Date(scheduledAt).toISOString(),
        lat: lat ?? -33.35,
        lng: lng ?? -68.33,
        match_type: matchType,
      })
      navigate('/matchmaking')
    } catch { /* error set in store */ }
  }

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <h1 className={styles.headerTitle}>Crear desafío</h1>
      </div>

      <form className={styles.body} onSubmit={handleSubmit}>
        {/* ── Server error ── */}
        {hasSubmitted && error && (
          <div className={styles.errorAlert} role="alert">
            <AlertCircle size={16} className={styles.errorIcon} />
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {/* ── Fecha y hora ── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Cuándo</p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="scheduled-at">Fecha y hora</label>
            <input
              id="scheduled-at"
              type="datetime-local"
              min={minDatetime()}
              value={scheduledAt}
              onChange={(e) => { setScheduledAt(e.target.value); setFieldErrors((p) => ({ ...p, scheduledAt: undefined })) }}
              aria-invalid={!!fieldErrors.scheduledAt}
              className={`${styles.input} ${fieldErrors.scheduledAt ? styles.inputError : ''}`}
            />
            {fieldErrors.scheduledAt && <p className={styles.fieldError} role="alert">{fieldErrors.scheduledAt}</p>}
          </div>
        </div>

        {/* ── Tipo de partido ── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Tipo de partido</p>
          <div className={styles.typeSelector}>
            {MATCH_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.typeBtn} ${opt.css} ${matchType === opt.value ? styles.typeBtnActive : ''}`}
                onClick={() => setMatchType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Ubicación ── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>
            <MapPin size={12} className={styles.cardTitleIcon} />
            Ubicación (opcional)
          </p>

          {lat !== null ? (
            <div className={styles.locationChip}>
              <MapPin size={15} className={styles.locationChipIcon} />
              <span className={styles.locationCoords}>{lat.toFixed(4)}, {lng?.toFixed(4)}</span>
              <button type="button" className={styles.locationRemoveBtn} onClick={() => { setLat(null); setLng(null) }}>
                Quitar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${styles.submitBtn} ${styles.submitBtnSecondary}`}
              onClick={handleGetLocation}
              disabled={gettingLocation}
            >
              {gettingLocation
                ? <><span className={`${styles.btnSpinner} ${styles.btnSpinnerLight}`} /> Obteniendo…</>
                : <><MapPin size={15} /> Usar mi ubicación</>
              }
            </button>
          )}

          {locationError && <p className={styles.fieldError} role="alert">{locationError}</p>}
        </div>

        {/* ── Submit ── */}
        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading
            ? <><span className={styles.btnSpinner} /> Publicando…</>
            : <><Zap size={16} /> Publicar desafío</>
          }
        </button>
      </form>
    </div>
  )
}
