# Design: Epic 12 — Auth Screens

## Architecture

### File Structure

```
src/features/auth/
├── LoginPage.tsx                ← enhanced (401, 429 errors)
├── RegisterPage.tsx             ← enhanced (validation, 409, 422)
├── OnboardingPage.tsx           ← full rewrite (5-step questionnaire)
├── OnboardingResultPage.tsx     ← new (ELO reveal + CTA)
└── ChangePasswordScreen.tsx     ← new (current + new + confirm)

src/stores/
└── auth-store.ts                ← extend (onboarding_completed, completeOnboarding)

src/types/
└── index.ts                     ← extend User with onboarding_completed

src/routes/
├── PrivateRoute.tsx             ← extend (onboarding guard)
└── router.tsx                   ← add /onboarding/result, /change-password
```

### Data Flow

```
Register → auto-login → fetch /players/me → onboarding_completed=false → /onboarding
Login → fetch /players/me → onboarding_completed=false → /onboarding
Login → fetch /players/me → onboarding_completed=true → /radar
```

### Auth Store Extensions

```ts
// Added to User type
onboarding_completed: boolean

// New action
completeOnboarding: (answers: OnboardingAnswers) => Promise<OnboardingResult>
```

`completeOnboarding` calls POST /onboarding/questionnaire, updates `user.onboarding_completed = true`
in the store, and returns `{ elo, calibration_matches_remaining }` for the result screen.

### PrivateRoute Guard Logic

```
isInitializing → spinner
!isAuthenticated → /login
isAuthenticated && !user.onboarding_completed → /onboarding
isAuthenticated && user.onboarding_completed → <Outlet />
```

The `/onboarding` route is outside PrivateRoute (public) to avoid circular redirect.
However, OnboardingPage checks `isAuthenticated` internally: if not authenticated, redirect to /login.

### Onboarding State Machine

```
step: 0 → 1 → 2 → 3 → 4 → submit
answers: { frequency, tournaments, paddle_type, self_assessment, years_playing }
```

State is local `useState`. No store involvement until final submit.
On submit → call `completeOnboarding` → navigate to `/onboarding/result` with ELO in state.

## Design Tokens (project theme)

| Token | Value | Usage |
|-------|-------|-------|
| bg-bg-dark | #0f172a | Page background |
| bg-bg-card | #1e293b | Cards, option cards |
| bg-bg-input | #334155 | Input backgrounds |
| text-text-primary | #f8fafc | Main text |
| text-text-secondary | #94a3b8 | Labels, hints |
| padel-green | #22c55e | CTAs, selection state |
| trust-low | #ef4444 | Error states |
| border | #475569 | Default borders |

## Component Patterns

### Option Card (OnboardingPage)
- Full-width button, min-h-14, border rounded-xl
- Default: `border-border bg-bg-card text-text-primary`
- Selected: `border-padel-green bg-padel-green/10 text-padel-green`
- Focus-visible: `focus-visible:ring-2 focus-visible:ring-padel-green`

### Progress Bar
- Fixed at top of onboarding container
- `w-full h-1 bg-bg-card rounded-full` — track
- Inner: `h-full bg-padel-green rounded-full transition-all duration-300` — fill
- Width: `{(step / TOTAL_STEPS) * 100}%`

### ELO Reveal Animation
- CSS keyframe: opacity 0→1, translateY 20px→0
- Number displayed large: `text-7xl font-black text-padel-green`
- Animation class applied once on mount

## Error Mapping

### Login
| Status | Message |
|--------|---------|
| 401 | "Email o contraseña incorrectos" |
| 429 | "Demasiados intentos. Esperá un momento e intentá de nuevo." |
| default | "Ocurrió un error. Intentá de nuevo." |

### Register
| Status | Message |
|--------|---------|
| 409 | "Ya existe una cuenta con ese email." |
| 422 | Field-level errors from response body |
| default | "No se pudo crear la cuenta. Intentá de nuevo." |

### Change Password
| Status | Message |
|--------|---------|
| 400 | "La contraseña actual es incorrecta." |
| 422 | "La nueva contraseña no cumple los requisitos." |
| default | "No se pudo cambiar la contraseña." |

## Validation Rules (client-side)

| Field | Rule |
|-------|------|
| email | Valid format (regex) |
| password (register) | Min 8 chars, 1 uppercase, 1 digit |
| confirm password | Must match password |
| years_playing | Number, 0–60 |
