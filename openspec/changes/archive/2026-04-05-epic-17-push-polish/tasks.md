# Tasks: EPIC 17 — Push Notifications + Polish

## Task List

- [x] Create `src/stores/toast-store.ts` — Zustand store with `addToast`, `dismissToast`, max-3 FIFO queue
- [x] Create `src/components/layout/Toast.tsx` — animated toast container + individual items with auto-dismiss + progress bar
- [x] Create `src/components/layout/OfflineBanner.tsx` — sticky offline indicator using `navigator.onLine` events
- [x] Update `src/components/layout/AppShell.tsx` — mount `<ToastContainer />` and `<OfflineBanner />`
- [x] Create `src/components/ErrorBoundary.tsx` — class-based React error boundary with recovery UI
- [x] Update `src/main.tsx` — wrap app in `<ErrorBoundary>`, wire `toast:add` CustomEvent bridge
- [x] Update `src/services/api.ts` — add 403/5xx/network error interceptor that dispatches `toast:add` CustomEvent
- [x] Create `src/components/ui/Skeleton.tsx` — animated skeleton primitives + SkeletonFlareCard, SkeletonMatchCard, SkeletonList
- [x] Update `src/features/matchmaking/MatchmakingPage.tsx` — replace Spinner in FlareWall + MyMatchesSection with SkeletonList; add page-enter
- [x] Update `src/features/rankings/RankingsPage.tsx` — add page-enter class
- [x] Update `src/features/radar/RadarPage.tsx` — add page-enter class
- [x] Update `src/features/profile/ProfilePage.tsx` — add page-enter class
- [x] Update `src/index.css` — add `@keyframes slideDown` and `@keyframes fadeIn`, `.page-enter` class
- [x] Create `src/services/device-token.ts` — PWA device token registration service
- [x] Create `src/hooks/useDeviceTokenRegistration.ts` — hook that registers placeholder token once per session
- [x] Update `src/routes/PrivateRoute.tsx` — call `useDeviceTokenRegistration`
- [x] Create `src/features/auth/NotFoundPage.tsx` — 404 page with navigate to /radar
- [x] Update `src/routes/router.tsx` — add `path: '*'` catch-all to NotFoundPage
- [x] Run `npx tsc --noEmit` — verify zero TypeScript errors
