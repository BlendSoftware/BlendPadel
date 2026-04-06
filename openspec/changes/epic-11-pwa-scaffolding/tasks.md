# Tasks: Epic 11 — PWA Scaffolding

## FE-001: Project Init

- [x] T01 — Run `npm create vite@latest . -- --template react-ts` in `app/`
- [x] T02 — Install production deps: `zustand axios react-router-dom lucide-react`
- [x] T03 — Install dev deps: `tailwindcss @tailwindcss/vite vite-plugin-pwa`
- [x] T04 — Verify `npm run dev` starts on port 5173

## FE-002: TailwindCSS 4 + Theme

- [x] T05 — Replace `src/index.css` with `@import "tailwindcss"` + `@theme {}` block
- [x] T06 — Update `vite.config.ts`: add `tailwindcss()` plugin from `@tailwindcss/vite`
- [x] T07 — Remove any PostCSS config if Vite generated one
- [x] T08 — Add `@` path alias in `vite.config.ts` and `tsconfig.json`

## FE-003: PWA

- [x] T09 — Add `VitePWA()` plugin to `vite.config.ts` with manifest (name, icons, theme_color, display: standalone)
- [x] T10 — Place placeholder `icon-192.png` and `icon-512.png` in `public/`

## FE-004: App Shell + Routing

- [x] T11 — Create `src/routes/router.tsx` with `createBrowserRouter`
- [x] T12 — Create `src/components/layout/AppShell.tsx` (max-w-[480px] container + Outlet)
- [x] T13 — Create `src/components/layout/BottomNav.tsx` (4 tabs: Radar, Matchmaking, Rankings, Perfil)
- [x] T14 — Create `src/components/layout/Header.tsx` (optional — page title + back button)
- [x] T15 — Wire `PrivateRoute` wrapper: reads auth store, redirects to `/login` if unauthenticated
- [x] T16 — Update `src/main.tsx` to use `RouterProvider`

## FE-005: API Client + Auth Store

- [x] T17 — Create `src/services/api.ts`: axios instance with `baseURL: 'http://localhost'`
- [x] T18 — Add request interceptor: inject `Authorization: Bearer <accessToken>`
- [x] T19 — Add response interceptor: 401 → refresh → retry, else logout
- [x] T20 — Create `src/stores/auth-store.ts`: Zustand 5 store with `user`, `accessToken`, `isAuthenticated`, `login()`, `logout()`, `refresh()`, `initialize()`
- [x] T21 — Call `authStore.initialize()` on app boot (in main.tsx or App.tsx)

## FE-006: Base UI Components + Placeholder Pages

- [x] T22 — `src/components/ui/Button.tsx`: variants (primary, secondary, outline, danger), sizes (sm, md, lg), loading state
- [x] T23 — `src/components/ui/Input.tsx`: label, error, icon slot, password toggle
- [x] T24 — `src/components/ui/Card.tsx`: `bg-bg-card` wrapper with rounded-xl and optional padding
- [x] T25 — `src/components/ui/Badge.tsx`: colored pill (trust levels + custom color)
- [x] T26 — `src/components/ui/Avatar.tsx`: circular image with initials fallback
- [x] T27 — `src/components/ui/Spinner.tsx`: centered loading spinner (padel-green)
- [x] T28 — `src/components/ui/EmptyState.tsx`: icon + title + subtitle
- [x] T29 — `src/features/auth/LoginPage.tsx`: real login form with email/password + error handling
- [x] T30 — `src/features/auth/RegisterPage.tsx`: real register form (full_name, username, email, password)
- [x] T31 — `src/features/auth/OnboardingPage.tsx`: onboarding steps with feature highlights
- [x] T32 — `src/features/radar/RadarPage.tsx`: placeholder with map area + empty state
- [x] T33 — `src/features/matchmaking/MatchmakingPage.tsx`: placeholder with tabs + empty state
- [x] T34 — `src/features/rankings/RankingsPage.tsx`: placeholder with tabs + empty state
- [x] T35 — `src/features/profile/ProfilePage.tsx`: real profile using auth store user data
- [x] T36 — `src/features/profile/PublicProfilePage.tsx`: placeholder
- [x] T37 — `src/features/matchmaking/MatchDetailPage.tsx`: placeholder

## Verification

- [x] T38 — `npm run dev` starts in 395ms on localhost:5173
- [x] T39 — `/login` redirects unauthenticated users from protected routes (PrivateRoute)
- [x] T40 — `npx tsc --noEmit` passes with zero errors
