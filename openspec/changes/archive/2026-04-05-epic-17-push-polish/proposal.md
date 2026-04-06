# Proposal: EPIC 17 — Push Notifications + Polish

## Intent

Add the UX robustness layer that separates a working app from a delightful one:
global toast system, error boundary, offline banner, loading skeletons, HTTP
error interception, PWA device token registration, 404 handling, and page
transition animations.

## Scope

### In scope
- Toast notification system (Zustand store + animated component, max 3 queue)
- React Error Boundary wrapping the entire app tree
- Offline detection banner (sticky, auto-dismisses on reconnect)
- Global HTTP error interceptor (403 → toast, 5xx → toast, network → toast)
- Loading skeletons for Matchmaking (flares + matches) and Rankings
- PWA device token registration on login (POST /players/me/device-token)
- 404 catch-all page
- Page-level fade-in animations via CSS class

### Out of scope (native-app concerns)
- expo-notifications / FCM real push tokens
- Deep link scheme `blendpadel://` (Web SPA router handles this natively)
- Background push notification tap-to-navigate (requires native shell)

## Approach

1. **Toast system** — Zustand store (`toast-store.ts`) with `addToast` /
   `dismissToast`. Component `Toast.tsx` renders a fixed overlay container with
   auto-dismiss timer + animated progress bar per item. Max 3 toasts via FIFO
   slice.

2. **API interceptor bridge** — avoids circular import (store → api → store) by
   dispatching a `CustomEvent('toast:add')` in `api.ts` and wiring the listener
   to the store in `main.tsx`.

3. **ErrorBoundary** — class component wrapping `<RouterProvider>` in `main.tsx`.
   Shows recovery UI with "Reintentar" (resets state) and "Recargar" (full
   reload).

4. **OfflineBanner** — uses `navigator.onLine` + `online`/`offline` events. No
   third-party dependency. Mounted inside `AppShell` above `<main>`.

5. **Skeletons** — shared `Skeleton.tsx` with composites: `SkeletonRankingRow`,
   `SkeletonFlareCard`, `SkeletonMatchCard`, and `SkeletonList` for bulk
   rendering. Rankings already had a local `SkeletonRow`; new shared component
   adds flare and match variants.

6. **Device token** — `deviceTokenService` + `useDeviceTokenRegistration` hook
   called in `PrivateRoute`. Registers `{token: "pwa-placeholder", platform: "web"}`
   once per session (guarded by `localStorage` flag). Silently swallows errors.

7. **404 page** — `NotFoundPage` added as `path: '*'` at top of router array.

8. **Page transitions** — `@keyframes fadeIn` in `index.css`, `.page-enter` CSS
   class applied to top-level div of Radar, Matchmaking, Rankings, and Profile
   pages.

## Files Changed

| File | Action |
|------|--------|
| `src/stores/toast-store.ts` | New |
| `src/components/layout/Toast.tsx` | New |
| `src/components/layout/OfflineBanner.tsx` | New |
| `src/components/layout/AppShell.tsx` | Updated (Toast + OfflineBanner) |
| `src/components/ErrorBoundary.tsx` | New |
| `src/components/ui/Skeleton.tsx` | New |
| `src/services/api.ts` | Updated (error interceptor + CustomEvent bridge) |
| `src/services/device-token.ts` | New |
| `src/hooks/useDeviceTokenRegistration.ts` | New |
| `src/main.tsx` | Updated (ErrorBoundary + event bridge) |
| `src/routes/router.tsx` | Updated (404 catch-all) |
| `src/routes/PrivateRoute.tsx` | Updated (useDeviceTokenRegistration) |
| `src/features/auth/NotFoundPage.tsx` | New |
| `src/features/matchmaking/MatchmakingPage.tsx` | Updated (SkeletonList, page-enter) |
| `src/features/rankings/RankingsPage.tsx` | Updated (page-enter) |
| `src/features/radar/RadarPage.tsx` | Updated (page-enter) |
| `src/features/profile/ProfilePage.tsx` | Updated (page-enter) |
| `src/index.css` | Updated (slideDown + fadeIn keyframes) |

## Risks

- **OfflineBanner**: `navigator.onLine` can be unreliable (true even on captive
  portal). Acceptable for MVP — real fix requires fetch probe.
- **Device token placeholder**: Backend `notification_log` rows will have
  `token = "pwa-placeholder"` until native app ships. Backend should handle
  this gracefully.
- **ErrorBoundary + React 19**: React 19 may show dev-mode double-invoke during
  `StrictMode` — expected behavior, not a production issue.
