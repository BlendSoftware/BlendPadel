# Design: Epic 11 — PWA Scaffolding

## Architecture Decisions

### D1 — Vite + React 18 + TypeScript (not Next.js)
Next.js adds SSR/RSC complexity that we don't need. This is a pure SPA authenticating
against a REST API — server rendering provides zero benefit and complicates deployment.
Vite gives us sub-second HMR and a straightforward config surface.

### D2 — TailwindCSS 4, CSS-based config
TailwindCSS v4 drops `tailwind.config.js` entirely. Config lives in `src/index.css` via
the `@theme {}` directive. Plugin: `@tailwindcss/vite` (not PostCSS). This is the only
supported path for v4 with Vite.

### D3 — React Router v7 (SPA mode)
File-based routing is optional — we use the declarative `createBrowserRouter` API.
Protected routes via a `PrivateRoute` wrapper that reads the auth store.

### D4 — Zustand 5, selector pattern
All store access via selectors (`useStore((s) => s.field)`) — never direct destructure.
Auth tokens: accessToken in memory, refreshToken in localStorage.

### D5 — Axios with dual-interceptor pattern
- Request interceptor: inject `Authorization: Bearer <accessToken>`
- Response interceptor: on 401 → call refresh endpoint → swap token → retry original request
- If refresh fails → logout + redirect `/login`
- Proactive refresh: setTimeout at token TTL − 60s

### D6 — vite-plugin-pwa (Workbox autoUpdate)
Strategy: `autoUpdate` (service worker updates silently in background).
Cache strategy for API calls: NetworkFirst (always wants fresh data).
Manifest: standalone display, dark splash, padel-green theme color override.

### D7 — Mobile-first layout
```
<body>                          ← bg-bg-dark, full viewport
  <div max-w-[480px] mx-auto>  ← phone-width container, centered on desktop
    <main pb-16>               ← scrollable content, padded for bottom nav
      <Outlet />
    </main>
    <BottomNav fixed bottom>   ← fixed 4-tab nav
  </div>
</body>
```
On screens wider than 480px, the app renders as a centered phone silhouette.

### D8 — Feature-first folder structure
```
src/
├── features/
│   ├── auth/           # Login, Register, Onboarding
│   ├── radar/          # Tab 1: Map + nearby matches
│   ├── matchmaking/    # Tab 2: Flares + match management
│   ├── rankings/       # Tab 3: Leaderboards
│   └── profile/        # Tab 4: My profile + public profiles
├── components/
│   ├── ui/             # Button, Input, Card, Badge, Avatar, Spinner, EmptyState
│   └── layout/         # AppShell, BottomNav, Header
├── hooks/              # useAuth (reads auth store), useApi (typed axios wrapper)
├── stores/             # auth-store.ts (Zustand 5)
├── services/           # api.ts (axios instance + interceptors)
├── types/              # Shared TypeScript interfaces
├── lib/                # utils.ts (cn helper, date formatters)
└── routes/             # router.tsx (createBrowserRouter)
```

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-padel-green` | `#22c55e` | Primary CTA, active tab, badges |
| `--color-padel-green-dark` | `#16a34a` | Hover state |
| `--color-bg-dark` | `#0f172a` | App background |
| `--color-bg-card` | `#1e293b` | Cards, modals, bottom nav |
| `--color-bg-input` | `#334155` | Input fields |
| `--color-text-primary` | `#f8fafc` | Main text |
| `--color-text-secondary` | `#94a3b8` | Labels, hints, inactive tabs |
| `--color-trust-high` | `#22c55e` | Trust level high |
| `--color-trust-medium` | `#f59e0b` | Trust level medium |
| `--color-trust-low` | `#ef4444` | Trust level low |
| `--color-border` | `#475569` | Borders, dividers |

## Route Map

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | LoginPage | public |
| `/register` | RegisterPage | public |
| `/onboarding` | OnboardingPage | public |
| `/` | redirect → `/radar` | private |
| `/radar` | RadarPage | private |
| `/matchmaking` | MatchmakingPage | private |
| `/rankings` | RankingsPage | private |
| `/profile` | ProfilePage | private |
| `/profile/:id` | PublicProfilePage | private |
| `/matches/:id` | MatchDetailPage | private |

## Non-Goals

- No SSR / no server components
- No i18n in this epic (Spanish only, hardcoded)
- No real map integration yet (placeholder in radar)
- No push notifications yet (service worker only for offline cache)
