import { useState, useEffect } from 'react'
import { ArrowLeft, MapPin, Navigation, AlertCircle, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/stores/profile-store'
import styles from './SubPage.module.css'

const MENDOZA_BOUNDS = { latMin: -35.5, latMax: -32.0, lngMin: -70.5, lngMax: -67.5 }

function isWithinMendoza(lat: number, lng: number): boolean {
  return lat >= MENDOZA_BOUNDS.latMin && lat <= MENDOZA_BOUNDS.latMax &&
    lng >= MENDOZA_BOUNDS.lngMin && lng <= MENDOZA_BOUNDS.lngMax
}

export function EditProfilePage() {
  const navigate       = useNavigate()
  const profile        = useProfileStore((s) => s.profile)
  const loading        = useProfileStore((s) => s.loading)
  const updateProfile  = useProfileStore((s) => s.updateProfile)
  const fetchProfile   = useProfileStore((s) => s.fetchProfile)

  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [lat,         setLat]         = useState<number | null>(null)
  const [lng,         setLng]         = useState<number | null>(null)
  const [geoLoading,  setGeoLoading]  = useState(false)
  const [geoError,    setGeoError]    = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)

  useEffect(() => {
    if (!profile) { fetchProfile(); return }
    setFirstName(profile.name ?? '')
    setLastName(profile.last_name ?? '')
    setLat(profile.latitude ?? null)
    setLng(profile.longitude ?? null)
  }, [profile, fetchProfile])

  function handleGetLocation() {
    if (!navigator.geolocation) { setGeoError('Tu navegador no soporta geolocalización.'); return }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (!isWithinMendoza(latitude, longitude)) {
          setGeoError('Tu ubicación está fuera de Mendoza. Verificá que el GPS esté activado correctamente.')
          setGeoLoading(false)
          return
        }
        setLat(parseFloat(latitude.toFixed(6)))
        setLng(parseFloat(longitude.toFixed(6)))
        setGeoLoading(false)
      },
      (err) => {
        setGeoError(err.code === err.PERMISSION_DENIED
          ? 'Permiso de ubicación denegado. Habilitalo en la configuración del navegador.'
          : 'No se pudo obtener tu ubicación. Intentá de nuevo.')
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSaved(false)
    const data: { name?: string; last_name?: string; latitude?: number; longitude?: number } = {}
    if (firstName.trim()) data.name      = firstName.trim()
    if (lastName.trim())  data.last_name = lastName.trim()
    if (lat !== null)     data.latitude  = lat
    if (lng !== null)     data.longitude = lng
    try {
      await updateProfile(data)
      setSaved(true)
      setTimeout(() => navigate(-1), 800)
    } catch {
      setSubmitError('No se pudo guardar los cambios. Intentá de nuevo.')
    }
  }

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <h1 className={styles.headerTitle}>Editar perfil</h1>
      </div>

      <form className={styles.body} onSubmit={handleSubmit}>
        {/* ── Nombre y apellido ── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Información personal</p>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ep-name">Nombre</label>
              <input
                id="ep-name"
                className={styles.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="given-name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ep-last">Apellido</label>
              <input
                id="ep-last"
                className={styles.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tu apellido"
                autoComplete="family-name"
              />
            </div>
          </div>
        </div>

        {/* ── Ubicación ── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>
            <MapPin size={12} className={styles.cardTitleIcon} />
            Ubicación
          </p>

          {lat !== null && lng !== null ? (
            <div className={styles.locationChip}>
              <MapPin size={15} className={styles.locationChipIcon} />
              <span className={styles.locationCoords}>{lat.toFixed(4)}, {lng.toFixed(4)}</span>
              <button
                type="button"
                className={styles.locationRemoveBtn}
                onClick={() => { setLat(null); setLng(null) }}
              >
                Quitar
              </button>
            </div>
          ) : (
            <p className={styles.fieldHint}>Sin ubicación guardada</p>
          )}

          <button
            type="button"
            className={`${styles.submitBtn} ${styles.submitBtnSecondary}`}
            onClick={handleGetLocation}
            disabled={geoLoading}
          >
            {geoLoading
              ? <><span className={`${styles.btnSpinner} ${styles.btnSpinnerLight}`} /> Obteniendo ubicación…</>
              : <><Navigation size={15} /> {lat !== null ? 'Actualizar ubicación' : 'Usar mi ubicación'}</>
            }
          </button>

          {geoError && (
            <p className={styles.fieldError} role="alert">{geoError}</p>
          )}
        </div>

        {/* ── Submit error ── */}
        {submitError && (
          <div className={styles.errorAlert} role="alert">
            <AlertCircle size={16} className={styles.errorIcon} />
            <p className={styles.errorText}>{submitError}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading
            ? <><span className={styles.btnSpinner} /> Guardando…</>
            : saved
            ? <><Check size={16} /> Guardado</>
            : 'Guardar cambios'
          }
        </button>
      </form>
    </div>
  )
}
