import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import styles from './AuthPage.module.css'

function mapLoginError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 401) return 'Email o contraseña incorrectos.'
    if (status === 429) return 'Demasiados intentos. Esperá un momento e intentá de nuevo.'
  }
  return 'Ocurrió un error. Intentá de nuevo.'
}

export function LoginPage() {
  const navigate        = useNavigate()
  const login           = useAuthStore((s) => s.login)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user            = useAuthStore((s) => s.user)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  if (isAuthenticated) {
    const target = user?.onboarding_completed ? '/radar' : '/onboarding'
    navigate(target, { replace: true })
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      const freshUser = useAuthStore.getState().user
      navigate(freshUser?.onboarding_completed ? '/radar' : '/onboarding', { replace: true })
    } catch (err) {
      setError(mapLoginError(err))
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
          <p className={styles.brandTagline}>Encontrá partidos cerca tuyo</p>
        </div>

        <p className={styles.formTitle}>Ingresar a tu cuenta</p>

        {/* ── Error ── */}
        {error && (
          <div className={styles.errorAlert} role="alert">
            <AlertCircle size={16} className={styles.errorIcon} />
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {/* ── Form ── */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">Email</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Mail size={15} /></span>
              <input
                id="login-email"
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                autoCapitalize="none"
              />
            </div>
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">Contraseña</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Lock size={15} /></span>
              <input
                id="login-password"
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading
              ? <><span className={styles.btnSpinner} /> Ingresando…</>
              : 'Ingresar'}
          </button>
        </form>

        <p className={styles.bottomText}>
          ¿No tenés cuenta?{' '}
          <Link to="/register" className={styles.bottomLink}>
            Registrate
          </Link>
        </p>
      </div>
    </div>
  )
}
