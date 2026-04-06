import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function mapLoginError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 401) return 'Email o contraseña incorrectos.'
    if (status === 429) return 'Demasiados intentos. Esperá un momento e intentá de nuevo.'
  }
  return 'Ocurrió un error. Intentá de nuevo.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already authenticated — redirect based on onboarding state
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
      // Read fresh user state post-login to decide redirect target
      const freshUser = useAuthStore.getState().user
      const target = freshUser?.onboarding_completed ? '/radar' : '/onboarding'
      navigate(target, { replace: true })
    } catch (err) {
      setError(mapLoginError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg-dark flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div className="text-padel-green text-5xl font-black tracking-tight">BP</div>
          <h1 className="text-2xl font-bold text-text-primary">BlendPadel</h1>
          <p className="text-text-secondary text-sm">Encontrá partidos cerca tuyo</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="bg-trust-low/10 border border-trust-low/30 rounded-xl px-4 py-3 text-sm text-trust-low"
            >
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            icon={<Mail size={16} />}
            required
            autoComplete="email"
            autoCapitalize="none"
          />

          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={<Lock size={16} />}
            required
            autoComplete="current-password"
          />

          <Button type="submit" loading={loading} fullWidth size="lg">
            Ingresar
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          ¿No tenés cuenta?{' '}
          <Link
            to="/register"
            className="text-padel-green font-medium hover:text-padel-green-dark transition-colors focus-visible:outline-none focus-visible:underline"
          >
            Registrate
          </Link>
        </p>
      </div>
    </div>
  )
}
