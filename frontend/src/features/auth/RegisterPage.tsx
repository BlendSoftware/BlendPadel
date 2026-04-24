import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User, AlertCircle } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import styles from './AuthPage.module.css'

// ─── Validation ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UPPER_RE = /[A-Z]/
const DIGIT_RE = /[0-9]/

interface FieldErrors {
  name?: string
  last_name?: string
  email?: string
  password?: string
  confirm_password?: string
}

function validate(form: {
  name: string; last_name: string; email: string
  password: string; confirm_password: string
}): FieldErrors {
  const e: FieldErrors = {}
  if (!form.name.trim())             e.name           = 'El nombre es obligatorio.'
  if (!form.last_name.trim())        e.last_name      = 'El apellido es obligatorio.'
  if (!EMAIL_RE.test(form.email))    e.email          = 'Ingresá un email válido.'
  if (form.password.length < 8)      e.password       = 'Mínimo 8 caracteres.'
  else if (!UPPER_RE.test(form.password)) e.password  = 'Necesita al menos una mayúscula.'
  else if (!DIGIT_RE.test(form.password)) e.password  = 'Necesita al menos un número.'
  if (form.confirm_password !== form.password) e.confirm_password = 'Las contraseñas no coinciden.'
  return e
}

function mapRegisterError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 409) return 'Ya existe una cuenta con ese email.'
    if (status === 422) return 'Revisá los datos ingresados e intentá de nuevo.'
  }
  return 'No se pudo crear la cuenta. Intentá de nuevo.'
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)

  const [loading,     setLoading]     = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    name: '', last_name: '', email: '', password: '', confirm_password: '',
  })

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
      await register({ email: form.email, password: form.password, name: form.name, last_name: form.last_name })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err) {
      setServerError(mapRegisterError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* ── Brand ── */}
        <div className={styles.brand}>
          <div className={styles.logoMark}>
            <span className={styles.logoText}>BP</span>
          </div>
          <h1 className={styles.brandName}>BlendPadel</h1>
          <p className={styles.brandTagline}>Sumate a la comunidad</p>
        </div>

        <p className={styles.formTitle}>Crear cuenta nueva</p>

        {/* ── Error ── */}
        {serverError && (
          <div className={styles.errorAlert} role="alert">
            <AlertCircle size={16} className={styles.errorIcon} />
            <p className={styles.errorText}>{serverError}</p>
          </div>
        )}

        {/* ── Form ── */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Nombre + Apellido en fila */}
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="reg-name">Nombre</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><User size={14} /></span>
                <input
                  id="reg-name"
                  className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
                  type="text"
                  value={form.name}
                  onChange={handle('name')}
                  placeholder="Juan"
                  required
                  autoComplete="given-name"
                />
              </div>
              {fieldErrors.name && <p className={styles.fieldError}>{fieldErrors.name}</p>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="reg-last">Apellido</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><User size={14} /></span>
                <input
                  id="reg-last"
                  className={`${styles.input} ${fieldErrors.last_name ? styles.inputError : ''}`}
                  type="text"
                  value={form.last_name}
                  onChange={handle('last_name')}
                  placeholder="Perez"
                  required
                  autoComplete="family-name"
                />
              </div>
              {fieldErrors.last_name && <p className={styles.fieldError}>{fieldErrors.last_name}</p>}
            </div>
          </div>

          {/* Email */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-email">Email</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Mail size={15} /></span>
              <input
                id="reg-email"
                className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                type="email"
                value={form.email}
                onChange={handle('email')}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                autoCapitalize="none"
              />
            </div>
            {fieldErrors.email && <p className={styles.fieldError}>{fieldErrors.email}</p>}
          </div>

          {/* Contraseña */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-pass">Contraseña</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Lock size={15} /></span>
              <input
                id="reg-pass"
                className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                type="password"
                value={form.password}
                onChange={handle('password')}
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"
              />
            </div>
            {fieldErrors.password
              ? <p className={styles.fieldError}>{fieldErrors.password}</p>
              : <p className={styles.hint}>8 caracteres mínimo, 1 mayúscula y 1 número</p>}
          </div>

          {/* Confirmar contraseña */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-confirm">Confirmar contraseña</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Lock size={15} /></span>
              <input
                id="reg-confirm"
                className={`${styles.input} ${fieldErrors.confirm_password ? styles.inputError : ''}`}
                type="password"
                value={form.confirm_password}
                onChange={handle('confirm_password')}
                placeholder="Repetí tu contraseña"
                required
                autoComplete="new-password"
              />
            </div>
            {fieldErrors.confirm_password && <p className={styles.fieldError}>{fieldErrors.confirm_password}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading
              ? <><span className={styles.btnSpinner} /> Creando cuenta…</>
              : 'Crear cuenta'}
          </button>
        </form>

        <p className={styles.bottomText}>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className={styles.bottomLink}>Ingresá</Link>
        </p>
      </div>
    </div>
  )
}
