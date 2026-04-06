import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

// ─── Validation ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UPPER_RE = /[A-Z]/
const DIGIT_RE = /[0-9]/

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  confirm_password?: string
}

function validate(
  form: { name: string; email: string; password: string; confirm_password: string },
): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.name.trim()) {
    errors.name = 'El nombre es obligatorio.'
  }
  if (!EMAIL_RE.test(form.email)) {
    errors.email = 'Ingresá un email válido.'
  }
  if (form.password.length < 8) {
    errors.password = 'Mínimo 8 caracteres.'
  } else if (!UPPER_RE.test(form.password)) {
    errors.password = 'Necesita al menos una mayúscula.'
  } else if (!DIGIT_RE.test(form.password)) {
    errors.password = 'Necesita al menos un número.'
  }
  if (form.confirm_password !== form.password) {
    errors.confirm_password = 'Las contraseñas no coinciden.'
  }

  return errors
}

// ─── Server error mapping ──────────────────────────────────────────────────────

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

  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm_password: '',
  })

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      // Clear field error on change
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
      await register({
        email: form.email,
        password: form.password,
        name: form.name,
      })
      // Navigate to login — user must log in explicitly after registering
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err) {
      setServerError(mapRegisterError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg-dark flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="text-padel-green text-5xl font-black tracking-tight">BP</div>
          <h1 className="text-2xl font-bold text-text-primary">Crear cuenta</h1>
          <p className="text-text-secondary text-sm">Sumate a la comunidad</p>
        </div>

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
            label="Nombre"
            type="text"
            value={form.name}
            onChange={handleChange('name')}
            placeholder="Juan"
            icon={<User size={16} />}
            required
            autoComplete="name"
            error={fieldErrors.name}
          />

          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            placeholder="tu@email.com"
            icon={<Mail size={16} />}
            required
            autoComplete="email"
            autoCapitalize="none"
            error={fieldErrors.email}
          />

          <Input
            label="Contraseña"
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            placeholder="Mínimo 8 caracteres"
            icon={<Lock size={16} />}
            required
            autoComplete="new-password"
            hint="Mínimo 8 caracteres, 1 mayúscula y 1 número"
            error={fieldErrors.password}
          />

          <Input
            label="Confirmar contraseña"
            type="password"
            value={form.confirm_password}
            onChange={handleChange('confirm_password')}
            placeholder="Repetí tu contraseña"
            icon={<Lock size={16} />}
            required
            autoComplete="new-password"
            error={fieldErrors.confirm_password}
          />

          <Button type="submit" loading={loading} fullWidth size="lg">
            Crear cuenta
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          ¿Ya tenés cuenta?{' '}
          <Link
            to="/login"
            className="text-padel-green font-medium hover:text-padel-green-dark transition-colors focus-visible:outline-none focus-visible:underline"
          >
            Ingresá
          </Link>
        </p>
      </div>
    </div>
  )
}
