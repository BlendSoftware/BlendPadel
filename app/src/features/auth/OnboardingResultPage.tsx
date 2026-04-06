import { useNavigate, useLocation } from 'react-router-dom'
import { Trophy, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ResultState {
  elo?: number
  calibration_matches_remaining?: number
}

export function OnboardingResultPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const state = (location.state ?? {}) as ResultState
  const elo = state.elo ?? 1000
  const calibrationRemaining = state.calibration_matches_remaining ?? 5

  return (
    <div className="min-h-dvh bg-bg-dark flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-10 text-center">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-padel-green/20 flex items-center justify-center">
            <Trophy size={36} className="text-padel-green" aria-hidden="true" />
          </div>
        </div>

        {/* ELO reveal */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary uppercase tracking-widest">
            Tu ELO inicial
          </p>
          <div
            className="text-8xl font-black text-padel-green animate-elo-reveal tabular-nums"
            aria-label={`ELO: ${elo}`}
          >
            {elo}
          </div>
          <p className="text-text-primary text-base font-medium leading-relaxed max-w-xs mx-auto">
            Tu nivel inicial es{' '}
            <span className="text-padel-green font-bold">{elo}</span>. En tus primeros
            partidos, el sistema te va a ajustar rápido.
          </p>
        </div>

        {/* Calibration badge */}
        <div className="bg-bg-card border border-border rounded-xl px-5 py-4 flex items-start gap-3 text-left">
          <div className="h-9 w-9 rounded-lg bg-padel-green/20 flex items-center justify-center shrink-0 mt-0.5">
            <Zap size={18} className="text-padel-green" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-sm text-text-primary">Modo calibración activo</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Tus próximos{' '}
              <span className="font-medium text-text-primary">{calibrationRemaining} partidos</span>{' '}
              van a ajustar tu ELO más rápido. Jugá seguido para que el sistema te ubique bien.
            </p>
          </div>
        </div>

        {/* CTA */}
        <Button
          fullWidth
          size="lg"
          onClick={() => navigate('/radar', { replace: true })}
        >
          Empezar a jugar
        </Button>
      </div>

      {/* CSS animation for ELO number */}
      <style>{`
        @keyframes eloReveal {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-elo-reveal {
          animation: eloReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  )
}
