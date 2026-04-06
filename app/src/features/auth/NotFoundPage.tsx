import { useNavigate } from 'react-router-dom'
import { Home, AlertCircle } from 'lucide-react'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-bg-dark flex items-center justify-center px-6">
      <div className="w-full max-w-[480px] flex flex-col items-center gap-6 text-center">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-bg-card border border-border">
          <AlertCircle size={36} className="text-text-secondary" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="text-5xl font-black text-text-primary">404</p>
          <h1 className="text-lg font-semibold text-text-primary">Página no encontrada</h1>
          <p className="text-sm text-text-secondary">
            La ruta que buscás no existe o fue movida.
          </p>
        </div>

        <button
          onClick={() => navigate('/radar', { replace: true })}
          className="flex items-center justify-center gap-2 h-11 px-6 rounded-xl
                     bg-padel-green text-bg-dark font-semibold text-sm
                     hover:bg-padel-green-dark active:scale-95 transition-all
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-padel-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg-dark"
        >
          <Home size={16} aria-hidden="true" />
          Ir al inicio
        </button>
      </div>
    </div>
  )
}
