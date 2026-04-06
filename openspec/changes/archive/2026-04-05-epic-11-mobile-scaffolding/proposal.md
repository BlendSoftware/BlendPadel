# Proposal: EPIC 11 — Scaffolding Mobile App

## Status: proposed
## Stories: FE-001, FE-002, FE-003, FE-004, FE-005, FE-006

---

## Why

The `mobile/` directory is completely empty. There is no app to build screens on top of.

This EPIC is the mobile equivalent of EPIC 00 for the backend: it establishes the technical foundation that every subsequent sprint depends on. Without it, no feature screen can be built — not Radar, not Matchmaking, not Rankings, not Profile. Every FE story in sprints 6–10 blocks on this change.

Specifically:
- Without navigation scaffolding, there is nowhere to place screens.
- Without the API client and JWT interceptors, no screen can fetch data.
- Without the auth store, no screen knows who the user is or whether they are logged in.
- Without the design system base components, every screen reinvents Button and TextInput.
- Without the splash/loading logic, the app has no entry point that handles token state on cold start.

The backend is feature-complete (EPICs 00–10). The mobile app must now reach parity at the infrastructure level.

---

## What

A single scaffolding pass that leaves the project in a state where:

1. `npx expo start` compiles and runs without errors on iOS and Android simulators.
2. The app displays 4 navigable tabs (Radar, Matchmaking, Rankings, Perfil) when a user is authenticated.
3. The app shows an Auth Stack (Login, Register, Onboarding) when no valid token exists.
4. On cold start, the Splash screen silently attempts a token refresh and routes the user to the correct navigator.
5. The API client can reach the backend (`GET /health`) with automatic Bearer token injection.
6. All auth state is persisted across app restarts (refresh token in secure storage, user basics in AsyncStorage).
7. A set of shared UI primitives (Button, TextInput, Card, Badge, Avatar, LoadingSpinner, EmptyState) are available for all future screens.

The `mobile/` directory goes from zero to a working skeleton. No real data is displayed — placeholder screens only. Real feature screens are out of scope for this EPIC.

---

## Scope

### In Scope

- Expo project initialization with TypeScript template
- NativeWind 4 (TailwindCSS for React Native) configuration
- TypeScript path aliases (`@/` → `src/`)
- Feature-first folder structure (`src/features/{name}/`)
- React Navigation 7: Bottom Tab Navigator + Stack Navigator + Root conditional navigator
- Axios API client with request/response interceptors for JWT lifecycle
- Proactive token refresh (scheduled at `expiresIn - 60s`)
- Zustand 5 auth store with AsyncStorage + expo-secure-store persistence
- 7 shared UI components (Button, TextInput, Card, Badge, Avatar, LoadingSpinner, EmptyState)
- Splash screen with cold-start token verification flow
- Placeholder screens for all 4 tabs and all 3 auth screens
- BlendPadel color palette defined in `tailwind.config.js`

### Out of Scope

- Any real feature screen (Login form logic, Radar map, Matchmaking flow, Rankings list, Profile data)
- Push notifications (FCM) — EPIC 12
- Deep links
- App Store / Play Store configuration
- CI/CD for mobile

---

## Stack

| Concern | Technology | Version |
|---------|-----------|---------|
| Runtime | Expo Managed Workflow | SDK 52+ |
| Language | TypeScript | 5.x |
- | UI Primitives | React Native | bundled with Expo SDK 52 |
| Styling | NativeWind | 4.x |
| CSS utilities | TailwindCSS | 3.x (peer of NativeWind 4) |
| Navigation | React Navigation | 7.x |
| State management | Zustand | 5.x |
| HTTP client | Axios | 1.x |
| Secure storage | expo-secure-store | bundled with Expo SDK 52 |
| Async storage | @react-native-async-storage/async-storage | 2.x |
| Icons | @expo/vector-icons (Ionicons) | bundled with Expo |

---

## Approach

### Expo Managed Workflow

No bare React Native. The managed workflow is sufficient for the MVP and allows OTA updates via EAS Update. If we ever need a custom native module not available in Expo (e.g., background geolocation beyond expo-location), we can eject to bare workflow at that point. Cost of ejecting later: ~1 sprint. Cost of going bare now: ongoing native build complexity with zero benefit at MVP stage.

### React Navigation over Expo Router

Expo Router (file-system based) is compelling but still has rough edges with complex conditional navigation (auth vs. app flows). React Navigation gives us explicit, predictable control over the navigation tree and is more mature for deep-link handling and nested navigators. The admin panel (when built) will use React Router — having two different routing paradigms in the project is acceptable since they are separate apps.

### Zustand + dual persistence strategy

Access tokens are ephemeral (in-memory only, cleared on app restart). Refresh tokens go to `expo-secure-store` (hardware-backed encryption on supported devices). User basics (id, email, name, role) go to `AsyncStorage` so the UI can render without waiting for a network call. This matches industry-standard token storage practice for React Native.

### Proactive token refresh

Rather than waiting for a 401 and then refreshing (which creates a brief failed-request / spinner moment), we schedule a `setTimeout` at `(expiresIn - 60) * 1000` ms after each successful login or refresh. This keeps the access token fresh at all times and eliminates the 401-retry code path in normal usage. The 401 interceptor exists as a safety net, not the primary mechanism.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| NativeWind 4 + Expo SDK 52 config friction | Medium | Medium | Follow official NativeWind v4 Expo guide exactly; pin metro.config.js |
| React Navigation 7 breaking changes from v6 | Low | Low | Review v7 migration guide before installing |
| expo-secure-store unavailable on Android emulator | Low | Low | Fallback to AsyncStorage for development; production uses real device |
| Backend CORS not configured for Expo dev client origin | Low | Medium | Verify CORS_ORIGINS includes `exp://` and `localhost` during testing |
