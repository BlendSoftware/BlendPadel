# Proposal: Epic 12 — Auth Screens

## Why

Epic 11 delivered the PWA scaffold with routes and stub auth screens. Those stubs have no
real validation, no onboarding questionnaire, and no onboarding-state guard on the router.
Users who land on the app after registering have no path to complete onboarding.

The backend already exposes all required endpoints:
- POST /auth/login, /auth/register, /auth/refresh
- POST /onboarding/questionnaire (returns assigned ELO)
- PUT /auth/password
- GET /players/me (returns onboarding_completed flag)

## What

Replace stub screens with production-grade auth flow:

| Screen | Status |
|--------|--------|
| LoginPage | Exists (stub) — enhance with 429 handling |
| RegisterPage | Exists (stub) — add validation, error codes |
| OnboardingPage | Exists (wrong concept) — full rewrite to 5-step questionnaire |
| OnboardingResultPage | Missing — create |
| ChangePasswordScreen | Missing — create |

Plus:
- Auth store: add `onboarding_completed` to User type, add `completeOnboarding` action
- PrivateRoute: redirect authenticated users without onboarding to /onboarding
- Router: add /onboarding/result and /change-password routes

## Approach

- All forms are uncontrolled state via `useState` — no external form library
- Client-side validation before any API call (email format, password strength, match)
- Server-side errors mapped to human-readable Spanish messages by status code
- Onboarding multi-step uses local `useState` for currentStep and answers, submits all at once on final step
- ELO reveal uses CSS animation (count-up via keyframes or transition)
- No React.memo / useMemo / useCallback — React Compiler handles it
- Zustand selectors always individual: `const x = useStore(s => s.x)` — never destructure

## Scope

In scope:
- Login, Register, Onboarding (5 steps), OnboardingResult, ChangePassword screens
- Auth store extension (onboarding_completed, completeOnboarding)
- Route protection logic

Out of scope:
- Social login (Google/Apple)
- Email verification flow
- Password reset via email
