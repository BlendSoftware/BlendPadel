# Tasks: Epic 12 — Auth Screens

## T1: Types — Add onboarding_completed to User
- [x] Add `onboarding_completed: boolean` to `User` interface in `src/types/index.ts`

## T2: Auth Store — Add completeOnboarding action
- [x] Add `OnboardingAnswers` and `OnboardingResult` types to store file
- [x] Add `completeOnboarding` action to `AuthActions` interface
- [x] Implement: POST /onboarding/questionnaire → update user.onboarding_completed = true
- [x] Fix register action: remove auto-login, navigate caller handles it
- [x] Update login action: set error for 429 status specifically

## T3: LoginPage — Enhance error handling
- [x] Map 401 → "Email o contraseña incorrectos"
- [x] Map 429 → "Demasiados intentos. Esperá un momento e intentá de nuevo."
- [x] After login, check user.onboarding_completed → redirect to /onboarding or /radar
- [x] Extract error mapping from store (login now throws AxiosError, page handles it)

## T4: RegisterPage — Add validation and fix flow
- [x] Add confirm password field
- [x] Client-side validation: email format, password strength, passwords match
- [x] Show per-field validation errors using Input's `error` prop
- [x] Map server 409 → "Ya existe una cuenta con ese email."
- [x] On success → navigate to /login (no auto-login)

## T5: OnboardingPage — Full rewrite (5-step questionnaire)
- [x] Replace placeholder welcome screen with multi-step form
- [x] Progress bar (step/5)
- [x] Step 1: Frecuencia (nunca | rara_vez | 1_2_sem | 3_mas_sem)
- [x] Step 2: Torneos (nunca | amateur | federado)
- [x] Step 3: Tipo de paleta (iniciacion | intermedia | avanzada)
- [x] Step 4: Autoevaluación (principiante | intermedio | avanzado | competitivo)
- [x] Step 5: Años jugando (number input, 0–60)
- [x] "Siguiente" button validates current step has a selection
- [x] "Enviar" on last step calls completeOnboarding
- [x] On success → navigate to /onboarding/result with ELO data

## T6: OnboardingResultPage — Create new screen
- [x] Create `src/features/auth/OnboardingResultPage.tsx`
- [x] Read ELO and calibration_matches_remaining from navigation state
- [x] Display ELO with fade-in animation
- [x] Show calibration badge
- [x] "Empezar a jugar" CTA → navigate to /radar

## T7: ChangePasswordScreen — Create new screen
- [x] Create `src/features/auth/ChangePasswordScreen.tsx`
- [x] Three inputs: current password, new password, confirm new password
- [x] Client-side: new password strength, passwords match
- [x] PUT /auth/password → on success: logout + navigate to /login

## T8: PrivateRoute — Add onboarding guard
- [x] After auth check, if `!user.onboarding_completed` → redirect to /onboarding
- [x] Guard only applies when user is fully initialized

## T9: Router — Add new routes
- [x] Add `/onboarding/result` route → OnboardingResultPage
- [x] Add `/change-password` route (outside PrivateRoute, auth-checked internally)
- [x] Ensure /onboarding stays outside PrivateRoute (avoids circular redirect)

## T10: Verification
- [x] `npx tsc --noEmit` — zero errors
