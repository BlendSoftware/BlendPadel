# Design: Frontend Full Restore + Sync

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 19.2 | Latest, stable, matches archive |
| Bundler | Vite 8 | Native ESM, fast HMR |
| Language | TypeScript 5.9 strict | Type safety at API boundary |
| Styling | TailwindCSS 4 (vite plugin) | Matches archive + mockup |
| State | Zustand 5 | Lightweight, per-domain stores |
| HTTP | Axios 1.14 + interceptors | Refresh token queue logic |
| Router | React Router 7 | File-based-ish createBrowserRouter |
| Maps | Leaflet + react-leaflet | Open-source, no API key |
| PWA | vite-plugin-pwa (Workbox) | Manifest + runtime NetworkFirst cache |

## Directory layout

```
frontend/src/
├── components/
│   ├── layout/         # AppShell, Header, BottomNav, Toast, OfflineBanner
│   └── ui/             # Button, Card, Input, Avatar, Badge, Spinner, Skeleton, EmptyState
├── features/
│   ├── auth/           # Login, Register, Onboarding, ChangePassword
│   ├── profile/        # Profile, Edit, Avatar, Preferences, PublicProfile
│   ├── matchmaking/    # Matchmaking, MatchDetail, + screens (CreateFlare, CreateMatch, RespondFlare, SubmitResult, ConfirmDispute)
│   ├── radar/          # RadarPage + RadarMap, MatchDetailSheet, ELOFilterPanel, ...
│   ├── venues/         # VenuesPage, CreateVenuePage
│   ├── rankings/       # RankingsPage, RankingTable, RegionPicker, ProjectionCard
│   ├── feed/           # FeedPage
│   ├── partnerships/   # PartnershipsPage
│   └── admin/          # AdminLayout + 7 pages
├── stores/             # 12 Zustand stores (1 per domain + admin + toast + player-cache)
├── services/           # api.ts (axios client), device-token.ts
├── lib/                # api-errors (RFC 7807 extractor), categories, utils
├── hooks/              # useAuth, useDeviceTokenRegistration
├── routes/             # router.tsx, PrivateRoute, AdminRoute
└── types/              # index.ts, radar.ts
```

## Axios client contract

- **Access token**: in-memory (`_accessToken`) — not persisted to localStorage (XSS safety).
- **Refresh token**: localStorage (`refresh_token`) — unavoidable for session persistence without cookies.
- **Proactive refresh**: timer at 25 min (token TTL is 60 min) — prevents 401 storms.
- **Reactive refresh**: 401 interceptor queues concurrent requests while one refresh is in flight.
- **Logout propagation**: `window.dispatchEvent('auth:logout')` — decoupled from store imports.
- **Toast dispatch**: `window.dispatchEvent('toast:add', {detail:{type,message}})` — dispatches on 403/5xx/network errors.

## Store conventions

- One store per domain. No cross-store imports (use `auth-store` for user ID lookup via local import inside functions).
- `isLoading`, `isActionLoading`, `error` fields standard.
- `clearError()` action on every store.
- Cursor-based pagination stores `nextCursor: string | null`.
- Page-based pagination stores current page as number.

## Dev proxy (vite.config.ts)

All backend paths routed to `http://localhost:8080`. HTML accept header triggers `bypass` on the SPA routes that collide with backend paths (e.g., `/rankings`, `/venues`).

## PWA

- Manifest: display=standalone, theme=slate-900, start_url=/
- Workbox: NetworkFirst for `/api/*`, cache-first for assets
- Icons: 192, 512 (already in public/)
- Registration: `registerType: 'autoUpdate'`

## RBAC in UI

- `PrivateRoute` wraps everything player-facing; redirects unauth → /login, no-onboarding → /onboarding.
- `AdminRoute` wraps `/admin/*`; requires `role === 'superadmin' || 'moderator'`; toast + redirect to /radar otherwise.
- `AdminLayout` sidebar filters links by role (superadmin sees all; moderator sees only Disputes + Reports).
- Server still enforces — client guard is UX, not security.

## Error shape alignment

Backend uses RFC 7807: `{ type, title, status, detail, errors? }`. The `extractApiError` helper in `lib/api-errors.ts` also handles the special-case `GENDER_MISMATCH` error_code format.

## What was NOT built (deferred)

- `fetchSentRequests` rendering on PartnershipsPage (store action added, UI not wired)
- `updateVenue` UI screen (store action added, no edit screen yet)
- Result override sets UI on admin dispute resolve (optional field, basic resolve works)
- E2E tests (runtime validation deferred to next session)
