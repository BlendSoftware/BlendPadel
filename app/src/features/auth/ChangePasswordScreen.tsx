import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ChevronLeft } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import api from '@/services/api'

// ─── Validation ────────────────────────────────────────────────────────────────

const UPPER_RE = /[A-Z]/
const DIGIT_RE = /[0-9]/

interface FieldErrors {
  current_password?: string
  new_password?: string
  confirm_password?: string
}

function validate(form: {
  current_password: string
  new_password: string
  confirm_password: string
}): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.current_password) {
    errors.current_password = 'Ingresá tu contraseña actual.'
  }
  if (form.new_password.length < 8) {
    errors.new_password = 'Mínimo 8 caracteres.'
  } else if (!UPPER_RE.test(form.new_password)) {
    errors.new_password = 'Necesita al menos una mayúscula.'
  } else if (!DIGIT_RE.test(form.new_password)) {
    errors.new_password = 'Necesita al menos un número.'
  }
  if (form.confirm_password !== form.new_password) {
    errors.confirm_password = 'Las contraseñas no coinciden.'
  }

  return errors
}

// ─── Server error mapping ──────────────────────────────────────────────────────

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
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  // Guard: must be authenticated
  if (!isAuthenticated) {
    navigate('/login', { replace: true })
    return null
  }

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (fieldErrors[field]) {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const errors = validate(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      await api.put('/auth/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      setSuccess(true)
      // Token is revoked server-side — logout client and redirect to login
      setTimeout(() => {
        logout()
        navigate('/login', { replace: true })
      }, 2000)
    } catch (err) {
      setServerError(mapServerError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg-dark flex flex-col px-6 py-8">
      <div className="w-full max-w-sm mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-11 w-11 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green"
            aria-label="Volver"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-text-primary">Cambiar contraseña</h1>
        </div>

        {success ? (
          <div
            role="alert"
            className="bg-padel-green/10 border border-padel-green/30 rounded-xl px-4 py-4 text-center space-y-1"
          >
            <p className="font-semibold text-padel-green text-sm">Contraseña cambiada</p>
            <p className="text-xs text-text-secondary">Redirigiendo al login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {serverError && (
              <div
                role="alert"
                className="bg-trust-low/10 border border-trust-low/30 rounded-xl px-4 py-3 text-sm text-trust-low"
              >
                {serverError}
              </div>
            )}

            <Input
              label="Contraseña actual"
              type="password"
              value={form.current_password}
              onChange={handleChange('current_password')}
              placeholder="Tu contraseña actual"
              icon={<Lock size={16} />}
              required
              autoComplete="current-password"
              error={fieldErrors.current_password}
            />

            <Input
              label="Nueva contraseña"
              type="password"
              value={form.new_password}
              onChange={handleChange('new_password')}
              placeholder="Mínimo 8 caracteres"
              icon={<Lock size={16} />}
              required
              autoComplete="new-password"
              hint="Mínimo 8 caracteres, 1 mayúscula y 1 número"
              error={fieldErrors.new_password}
            />

            <Input
              label="Confirmar nueva contraseña"
              type="password"
              value={form.confirm_password}
              onChange={handleChange('confirm_password')}
              placeholder="Repetí la nueva contraseña"
              icon={<Lock size={16} />}
              required
              autoComplete="new-password"
              error={fieldErrors.confirm_password}
            />

            <Button
              type="submit"
              loading={loading}
              fullWidth
              size="lg"
              variant="primary"
            >
              Cambiar contraseña
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-text-secondary">
          Al cambiar tu contraseña, tu sesión actual se va a cerrar por seguridad.
        </p>
      </div>
    </div>
  )
}
