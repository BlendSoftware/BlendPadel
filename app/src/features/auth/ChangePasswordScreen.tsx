import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import api from '@/services/api'
import styles from '@/features/profile/SubPage.module.css'

// ─── Validation ────────────────────────────────────────────────────────────────

const UPPER_RE = /[A-Z]/
const DIGIT_RE = /[0-9]/

interface FieldErrors {
  current_password?: string
  new_password?: string
  confirm_password?: string
}

function validate(form: { current_password: string; new_password: string; confirm_password: string }): FieldErrors {
  const e: FieldErrors = {}
  if (!form.current_password)                     e.current_password = 'Ingresá tu contraseña actual.'
  if (form.new_password.length < 8)               e.new_password     = 'Mínimo 8 caracteres.'
  else if (!UPPER_RE.test(form.new_password))      e.new_password     = 'Necesita al menos una mayúscula.'
  else if (!DIGIT_RE.test(form.new_password))      e.new_password     = 'Necesita al menos un número.'
  if (form.confirm_password !== form.new_password) e.confirm_password = 'Las contraseñas no coinciden.'
  return e
}

function mapServerError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 400) return 'La contraseña actual es incorrecta.'
    if (status === 422) return 'La nueva contraseña no cumple los requisitos.'
  }
  return 'No se pudo cambiar la contraseña. Intentá de nuevo.'
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ChangePasswordScreen() {
  const navigate        = useNavigate()
  const logout          = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })

  if (!isAuthenticated) { navigate('/login', { replace: true }); return null }

  function handle(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const errors = validate(form)
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setLoading(true)
    try {
      await api.put('/auth/password', {
        current_password: form.current_password,
        new_password:     form.new_password,
      })
      setSuccess(true)
      setTimeout(() => { logout(); navigate('/login', { replace: true }) }, 2200)
    } catch (err) {
      setServerError(mapServerError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <h1 className={styles.headerTitle}>Cambiar contraseña</h1>
      </div>

      <div className={styles.body}>
        {/* ── Success screen ── */}
        {success ? (
          <div className={styles.card} style={{ alignItems: 'center', gap: 12, padding: '36px 24px' }}>
            <CheckCircle size={44} color="var(--accent-fluo)" strokeWidth={1.5} />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', textTransform: 'uppercase', color: '#fff', margin: 0 }}>
              ¡Listo!
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: 0 }}>
              Contraseña actualizada. Redirigiendo al login…
            </p>
          </div>
        ) : (
          <form className={styles.card} onSubmit={handleSubmit} noValidate style={{ gap: 16 }}>
            <p className={styles.cardTitle}>Nueva contraseña</p>

            {/* Server error */}
            {serverError && (
              <div className={styles.errorAlert} role="alert">
                <AlertCircle size={16} className={styles.errorIcon} />
                <p className={styles.errorText}>{serverError}</p>
              </div>
            )}

            {/* Contraseña actual */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cp-current">Contraseña actual</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><Lock size={14} /></span>
                <input
                  id="cp-current"
                  className={`${styles.input} ${styles.inputWithIcon} ${fieldErrors.current_password ? styles.inputError : ''}`}
                  type="password"
                  value={form.current_password}
                  onChange={handle('current_password')}
                  placeholder="Tu contraseña actual"
                  required
                  autoComplete="current-password"
                />
              </div>
              {fieldErrors.current_password && <p className={styles.fieldError}>{fieldErrors.current_password}</p>}
            </div>

            {/* Nueva contraseña */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cp-new">Nueva contraseña</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><Lock size={14} /></span>
                <input
                  id="cp-new"
                  className={`${styles.input} ${styles.inputWithIcon} ${fieldErrors.new_password ? styles.inputError : ''}`}
                  type="password"
                  value={form.new_password}
                  onChange={handle('new_password')}
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                />
              </div>
              {fieldErrors.new_password
                ? <p className={styles.fieldError}>{fieldErrors.new_password}</p>
                : <p className={styles.hint}>8+ caracteres, 1 mayúscula y 1 número</p>
              }
            </div>

            {/* Confirmar */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cp-confirm">Confirmar nueva contraseña</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><Lock size={14} /></span>
                <input
                  id="cp-confirm"
                  className={`${styles.input} ${styles.inputWithIcon} ${fieldErrors.confirm_password ? styles.inputError : ''}`}
                  type="password"
                  value={form.confirm_password}
                  onChange={handle('confirm_password')}
                  placeholder="Repetí la nueva contraseña"
                  required
                  autoComplete="new-password"
                />
              </div>
              {fieldErrors.confirm_password && <p className={styles.fieldError}>{fieldErrors.confirm_password}</p>}
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading} style={{ marginTop: 4 }}>
              {loading
                ? <><span className={styles.btnSpinner} /> Cambiando…</>
                : 'Cambiar contraseña'
              }
            </button>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', margin: 0 }}>
              Al cambiar tu contraseña, tu sesión actual se va a cerrar por seguridad.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
