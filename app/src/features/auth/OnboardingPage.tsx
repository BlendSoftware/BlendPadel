import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { OnboardingAnswers } from '@/types'

// ─── Step definitions ──────────────────────────────────────────────────────────

interface OptionCard {
  value: string
  label: string
  description?: string
}

const STEPS = [
  {
    id: 'gender' as const,
    title: '¿Cuál es tu género?',
    subtitle: 'Esto nos ayuda a organizar partidos femeninos y mixtos.',
    options: [
      { value: 'male', label: 'Masculino' },
      { value: 'female', label: 'Femenino' },
      { value: 'other', label: 'Otro' },
    ] as OptionCard[],
  },
  {
    id: 'frequency' as const,
    title: '¿Con qué frecuencia jugás pádel?',
    subtitle: 'Sé honesto — esto calibra tu nivel inicial.',
    options: [
      { value: 'nunca', label: 'Nunca', description: 'Soy nuevo en el deporte' },
      { value: 'rara_vez', label: 'Rara vez', description: 'Algunas veces al año' },
      { value: '1_2_sem', label: '1–2 veces por semana', description: 'Juego regularmente' },
      { value: '3_mas_sem', label: '3 o más veces por semana', description: 'Entreno seguido' },
    ] as OptionCard[],
  },
  {
    id: 'tournaments' as const,
    title: '¿Participaste en torneos?',
    subtitle: 'Incluí tanto torneos locales como federados.',
    options: [
      { value: 'nunca', label: 'Nunca', description: 'Solo juego amateur' },
      { value: 'amateur', label: 'Torneos amateur', description: 'Torneos entre amigos o clubes' },
      { value: 'federado', label: 'Torneos federados', description: 'Competiciones oficiales' },
    ] as OptionCard[],
  },
  {
    id: 'paddle_type' as const,
    title: '¿Qué tipo de paleta usás?',
    subtitle: 'La paleta dice mucho sobre tu nivel de experiencia.',
    options: [
      { value: 'iniciacion', label: 'Iniciación', description: 'Paleta redonda, más liviana' },
      { value: 'intermedia', label: 'Intermedia', description: 'Paleta lágrima o híbrida' },
      { value: 'avanzada', label: 'Avanzada', description: 'Paleta diamante, para jugadores experimentados' },
    ] as OptionCard[],
  },
  {
    id: 'self_assessment' as const,
    title: '¿Cómo te evaluás a vos mismo?',
    subtitle: 'Sé objetivo — el sistema te va a ajustar rápido.',
    options: [
      { value: 'principiante', label: 'Principiante', description: 'Aprendiendo los fundamentos' },
      { value: 'intermedio', label: 'Intermedio', description: 'Controlo los golpes básicos' },
      { value: 'avanzado', label: 'Avanzado', description: 'Juego táctico, buen control' },
      { value: 'competitivo', label: 'Competitivo', description: 'Nivel alto, busco desafíos' },
    ] as OptionCard[],
  },
] as const

const TOTAL_STEPS = 6 // 5 option steps + 1 number input

// ─── Component ─────────────────────────────────────────────────────────────────

type SelectAnswers = {
  gender: string
  frequency: string
  tournaments: string
  paddle_type: string
  self_assessment: string
}

const EMPTY_ANSWERS: SelectAnswers = {
  gender: '',
  frequency: '',
  tournaments: '',
  paddle_type: '',
  self_assessment: '',
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)

  const [step, setStep] = useState(0) // 0–4: option steps, 5: years input
  const [answers, setAnswers] = useState<SelectAnswers>(EMPTY_ANSWERS)
  const [yearsPlaying, setYearsPlaying] = useState('')
  const [yearsError, setYearsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Guard: must be authenticated to reach onboarding
  if (!isAuthenticated) {
    navigate('/login', { replace: true })
    return null
  }

  const currentOptionStep = step < 5 ? STEPS[step] : null
  const currentAnswer = step < 5 ? answers[STEPS[step].id] : yearsPlaying
  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100

  function selectOption(value: string) {
    if (step < 5) {
      setAnswers((prev) => ({ ...prev, [STEPS[step].id]: value }))
    }
  }

  function handleNext() {
    if (step < 5) {
      if (!answers[STEPS[step].id]) return // no selection, don't advance
      setStep((s) => s + 1)
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  function validateYears(): boolean {
    const num = parseInt(yearsPlaying, 10)
    if (yearsPlaying === '' || isNaN(num)) {
      setYearsError('Ingresá los años que llevás jugando.')
      return false
    }
    if (num < 0 || num > 60) {
      setYearsError('Ingresá un número entre 0 y 60.')
      return false
    }
    setYearsError(null)
    return true
  }

  async function handleSubmit() {
    if (!validateYears()) return

    setSubmitError(null)
    setLoading(true)
    try {
      const payload: OnboardingAnswers = {
        gender: answers.gender as OnboardingAnswers['gender'],
        frequency: answers.frequency as OnboardingAnswers['frequency'],
        tournaments: answers.tournaments as OnboardingAnswers['tournaments'],
        paddle_type: answers.paddle_type as OnboardingAnswers['paddle_type'],
        self_assessment: answers.self_assessment as OnboardingAnswers['self_assessment'],
        years_playing: parseInt(yearsPlaying, 10),
      }
      const result = await completeOnboarding(payload)
      navigate('/onboarding/result', {
        replace: true,
        state: {
          elo: result.elo,
          calibration_matches_remaining: result.calibration_matches_remaining,
        },
      })
    } catch {
      setSubmitError('No se pudo completar el cuestionario. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg-dark flex flex-col px-6 py-8">
      <div className="w-full max-w-sm mx-auto flex flex-col flex-1 gap-8">

        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              Paso {step + 1} de {TOTAL_STEPS}
            </span>
            <span className="text-xs font-medium text-padel-green">
              {Math.round(progressPercent)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-bg-card rounded-full overflow-hidden">
            <div
              className="h-full bg-padel-green rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 space-y-6">
          {currentOptionStep ? (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-text-primary leading-snug">
                  {currentOptionStep.title}
                </h1>
                <p className="text-sm text-text-secondary">{currentOptionStep.subtitle}</p>
              </div>

              <div className="space-y-3" role="radiogroup" aria-label={currentOptionStep.title}>
                {currentOptionStep.options.map((opt) => {
                  const isSelected = currentAnswer === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => selectOption(opt.value)}
                      className={[
                        'w-full text-left rounded-xl border px-5 py-4 min-h-[72px]',
                        'transition-all duration-300 focus-visible:outline-none',
                        'focus-visible:ring-2 focus-visible:ring-padel-green',
                        isSelected
                          ? 'border-padel-green bg-padel-green/10 shadow-[inset_0_0_20px_rgba(215,255,45,0.05),0_0_15px_rgba(215,255,45,0.2)] scale-[1.02] transform'
                          : 'border-border bg-bg-card hover:border-padel-green/50 hover:bg-bg-input',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={[
                            'font-bold text-lg',
                            isSelected ? 'text-padel-green' : 'text-text-primary',
                          ].join(' ')}>
                            {opt.label}
                          </p>
                          {opt.description && (
                            <p className={[
                              'text-sm mt-1 transition-colors',
                              isSelected ? 'text-padel-green/80' : 'text-text-secondary',
                            ].join(' ')}>
                              {opt.description}
                            </p>
                          )}
                        </div>

                        {isSelected ? (
                          <div className="flex h-7 items-center justify-center rounded bg-padel-green/20 px-2.5 shadow-[0_0_10px_rgba(215,255,45,0.3)] ring-1 ring-padel-green/50">
                            <CheckCircle2 size={16} className="text-padel-green mr-1.5" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-padel-green">
                              Elegida
                            </span>
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white/10" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            /* Step 5: Years playing */
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-text-primary leading-snug">
                  ¿Cuántos años llevás jugando pádel?
                </h1>
                <p className="text-sm text-text-secondary">
                  Ingresá 0 si estás empezando.
                </p>
              </div>

              <Input
                label="Años jugando"
                type="number"
                inputMode="numeric"
                value={yearsPlaying}
                onChange={(e) => {
                  setYearsPlaying(e.target.value)
                  setYearsError(null)
                }}
                placeholder="Ej: 3"
                min={0}
                max={60}
                error={yearsError ?? undefined}
              />

              {submitError && (
                <div
                  role="alert"
                  className="bg-trust-low/10 border border-trust-low/30 rounded-xl px-4 py-3 text-sm text-trust-low"
                >
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="space-y-3 pb-safe">
          {step < 5 ? (
            <Button
              fullWidth
              size="lg"
              onClick={handleNext}
              disabled={!currentAnswer}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              fullWidth
              size="lg"
              loading={loading}
              onClick={handleSubmit}
            >
              Ver mi nivel
            </Button>
          )}

          {step > 0 && (
            <Button
              fullWidth
              variant="ghost"
              size="md"
              onClick={handleBack}
              disabled={loading}
            >
              Volver
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
