import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Clock, MapPin, MessageCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { useMatchmakingStore } from '@/stores/matchmaking-store'
import type { Flare } from '../types'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}


export function RespondFlarePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const flares = useMatchmakingStore((s) => s.flares)
  const isLoading = useMatchmakingStore((s) => s.isLoading)
  const error = useMatchmakingStore((s) => s.error)
  const respondToFlare = useMatchmakingStore((s) => s.respondToFlare)
  const fetchFlares = useMatchmakingStore((s) => s.fetchFlares)
  const clearError = useMatchmakingStore((s) => s.clearError)

  const [flare, setFlare] = useState<Flare | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (flares.length === 0) {
      fetchFlares()
    }
  }, [flares.length, fetchFlares])

  useEffect(() => {
    const found = flares.find((f) => f.id === id)
    if (found) setFlare(found)
  }, [flares, id])

  const handleRespond = async () => {
    if (!flare) return
    clearError()
    try {
      await respondToFlare(flare.id)
      setConfirmed(true)
    } catch {
      // error set in store
    }
  }

  if (!flare && flares.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Aceptar desafío" showBack />
        <div className="flex items-center justify-center flex-1 py-16">
          <Spinner />
        </div>
      </div>
    )
  }

  if (!flare) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Aceptar desafío" showBack />
        <div className="px-4 pt-8 text-center">
          <p className="text-text-secondary">Desafío no encontrado</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/matchmaking')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    )
  }

  if (confirmed) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Desafío aceptado" showBack />
        <div className="px-4 pt-16 flex flex-col items-center gap-6 text-center">
          <div className="h-20 w-20 rounded-full bg-padel-green/20 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-padel-green">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">¡Desafío aceptado!</h2>
            <p className="text-text-secondary mt-2">
              Respondiste al desafío de {flare.creator_name ?? flare.player?.name ?? 'Jugador'}. Te avisaremos cuando el partido esté confirmado.
            </p>
          </div>
          <Button fullWidth onClick={() => navigate('/matchmaking')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    )
  }

  const { player } = flare

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Aceptar desafío" showBack />

      <div className="px-4 pt-4 space-y-5 pb-8">
        {/* Flare details card */}
        <div className="bg-bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Avatar name={flare.creator_name ?? player?.name ?? 'Jugador'} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-text-primary">{flare.creator_name ?? player?.name ?? 'Jugador'}</span>
              </div>
              <p className="text-padel-green font-bold">{player?.elo ?? '?'} ELO</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Clock size={14} aria-hidden="true" />
              <span>{formatDate(flare.scheduled_at)}</span>
            </div>
            {flare.latitude !== null && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <MapPin size={14} aria-hidden="true" />
                <span>Ubicación disponible</span>
              </div>
            )}
            {flare.message && (
              <div className="flex items-start gap-2 text-sm text-text-secondary">
                <MessageCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{flare.message}</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="bg-trust-low/10 border border-trust-low/30 rounded-xl p-3 text-sm text-trust-low">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-text-secondary text-center">
            Al aceptar, confirmás que podés jugar en esa fecha y hora.
          </p>
          <Button fullWidth size="lg" loading={isLoading} onClick={handleRespond}>
            Confirmar — Quiero jugar
          </Button>
          <Button fullWidth variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
