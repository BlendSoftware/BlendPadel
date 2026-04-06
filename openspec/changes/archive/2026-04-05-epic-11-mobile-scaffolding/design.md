# Design: EPIC 11 — Scaffolding Mobile App

## Status: proposed
## Depends on: proposal.md

---

## Architecture Decisions

### D1 — Expo Managed Workflow (no bare)

**Decision**: Use `expo` managed workflow. Do not eject to bare React Native.

**Rationale**:
- Zero native build configuration for MVP. No Xcode project or Android Gradle files to maintain.
- OTA updates via EAS Update — push JS-only fixes without an App Store review cycle.
- All required native modules for this EPIC are available as Expo SDK packages (`expo-secure-store`, `expo-location` for future Radar, `expo-image-picker` for future Profile).
- Eject is always possible if a custom native module is needed. Cost is one sprint. The inverse — going bare first — creates ongoing maintenance burden with no benefit at this stage.

**Trade-off**: Expo managed workflow restricts which native modules can be used and requires Expo Go or a custom dev client for testing. Accepted for MVP scope.

---

### D2 — React Navigation 7 (not Expo Router)

**Decision**: Use `@react-navigation/native` with `@react-navigation/bottom-tabs` and `@react-navigation/native-stack`.

**Rationale**:
- Expo Router uses file-system conventions. Conditional navigation (auth gate) requires workarounds (`(auth)` groups, `redirect`, `useSegments`). These workarounds are functional but opaque and harder to reason about.
- React Navigation uses explicit JavaScript navigator trees. The `RootNavigator` is a plain component that reads `isAuthenticated` from the auth store and renders either `AuthStack` or `MainTabs`. No file-system magic.
- React Navigation 7 has a stable deep-link API and is better documented for complex nested navigator scenarios (tab → stack → modal).
- The admin panel (React + React Router) is a separate app on a separate codebase. Having different routing solutions in different apps is normal and expected.

**Trade-off**: More boilerplate than Expo Router. Navigation types must be declared manually. Acceptable — the types are defined once and reused everywhere.

---

### D3 — NativeWind 4 (TailwindCSS for React Native)

**Decision**: Use `nativewind@^4.0` with `tailwindcss@^3.4`.

**Rationale**:
- Same utility-class mental model as any TailwindCSS web project. When the admin panel is built, the same color token names and spacing utilities will apply.
- NativeWind v4 uses the CSS-in-JS approach via StyleSheet generation at build time (via Babel/Metro plugin). No runtime overhead.
- Avoids a custom StyleSheet object system — components stay readable with inline className strings.
- Custom palette (padel-green, trust colors, dark backgrounds) is defined once in `tailwind.config.js` and available everywhere.

**Trade-off**: NativeWind v4 + Expo SDK 52 requires specific `metro.config.js` and `babel.config.js` configuration. The setup is documented but brittle — must be done carefully and pinned.

---

### D4 — Zustand 5 with Persist Middleware (AsyncStorage)

**Decision**: Use `zustand@^5` for auth store. Use `persist` middleware with a split storage strategy.

**Storage split**:
| Data | Storage | Reason |
|------|---------|--------|
| `accessToken` | In-memory only | Short-lived (15min), never persisted |
| `refreshToken` | `expo-secure-store` | Hardware-backed encryption on supported devices |
| `user` (id, email, name, role, elo, trustScore, onboardingCompleted, status) | `AsyncStorage` | Allows UI to render on cold start without network |

**Rationale**:
- Zustand v5 drops the legacy `create` API in favor of typed slices. Aligns with the project's TypeScript-first approach.
- Splitting storage by sensitivity follows the principle of least privilege: the most sensitive credential (refresh token) is isolated in secure storage.
- Persisting user basics to AsyncStorage means the app can show the user's name and avatar while the token refresh is in-flight on cold start.

**Trade-off**: The `persist` middleware with a custom storage adapter for `expo-secure-store` requires a thin async wrapper. Worth it for security.

---

### D5 — Axios for API Client

**Decision**: Use `axios@^1` as the HTTP client. Do not use `fetch`.

**Rationale**:
- Interceptors are first-class citizens in Axios. Request interceptors (inject Bearer token) and response interceptors (handle 401) are clean and well-documented.
- Implementing the same interceptor pattern with `fetch` requires a custom wrapper class. The wrapper ends up reimplementing what Axios already provides.
- Axios has built-in timeout support (`timeout` option), which `fetch` lacks natively.
- TypeScript generics for response types work well: `api.get<PlayerDTO>('/players/me')`.

**Trade-off**: Adds ~13KB gzipped to the bundle. Acceptable.

---

### D6 — expo-secure-store for Refresh Token

**Decision**: Store the refresh token exclusively in `expo-secure-store`. Do not use `AsyncStorage` for any token.

**Rationale**:
- `AsyncStorage` is unencrypted. On a rooted/jailbroken device, its contents are readable in plaintext.
- `expo-secure-store` uses iOS Keychain and Android Keystore — hardware-backed encryption where supported.
- The access token is not stored at all (in-memory only). It lives for 15 minutes and is always derivable from a valid refresh token.
- This is the React Native equivalent of storing tokens in HttpOnly cookies on web.

**Trade-off**: `expo-secure-store` is async and has a ~2ms overhead vs. synchronous `AsyncStorage` reads. Irrelevant at the scale of an auth check.

---

### D7 — Feature-First Folder Structure

**Decision**: Organize source code under `src/features/{domain}/` mirroring the backend domain structure.

**Rationale**:
- The backend is organized by domain: `auth/`, `players/`, `matches/`, `elo/`, `trust/`, `locations/`. The mobile app mirrors this.
- Feature folders are self-contained: `screens/`, `components/`, `hooks/` live inside the feature. Only truly shared code goes into `src/components/` or `src/hooks/`.
- Easy to find all code related to a feature. Easy to delete a feature without hunting across a flat `components/` folder.
- Scales well: new sprints add new feature folders without touching existing ones.

**Trade-off**: Cross-feature dependencies must be carefully managed. Rule: features may only import from `src/components/`, `src/hooks/`, `src/stores/`, `src/services/`, and `src/types/`. Features must not import from each other.

---

### D8 — Proactive Token Refresh

**Decision**: After every successful login or token refresh, schedule a `setTimeout` to call `refresh()` at `(expiresIn - 60) * 1000` ms.

**Rationale**:
- The reactive approach (401 → refresh → retry) works but creates a user-visible stutter: the request fails, the interceptor triggers a refresh call, then retries the original request. On slow connections this is a ~1–2 second delay.
- The proactive approach keeps the access token perpetually fresh. Normal API calls never hit a 401 under normal conditions.
- The 401 interceptor still exists as a safety net (e.g., token revoked server-side, clock skew, interceptor timer missed on backgrounding).
- The timer is cleared on logout to prevent a refresh attempt after the user has signed out.

**Trade-off**: The timer must be managed carefully (clear on logout, reset on refresh). A missed timer (e.g., app backgrounded for hours) still falls back gracefully to the 401 interceptor.

---

## Folder Structure

```
mobile/
├── App.tsx                          # Entry point — renders RootNavigator wrapped in providers
├── app.json                         # Expo config (name, slug, icons, splash, scheme)
├── babel.config.js                  # NativeWind plugin, module-resolver for @/ aliases
├── metro.config.js                  # NativeWind CSS interop
├── tailwind.config.js               # BlendPadel palette + content paths
├── tsconfig.json                    # strict: true, paths: { "@/*": ["src/*"] }
├── global.css                       # @tailwind base/components/utilities
├── package.json
└── src/
    ├── features/
    │   ├── auth/
    │   │   └── screens/
    │   │       ├── SplashScreen.tsx     # Cold-start token verification
    │   │       ├── LoginScreen.tsx      # Placeholder
    │   │       ├── RegisterScreen.tsx   # Placeholder
    │   │       └── OnboardingScreen.tsx # Placeholder
    │   ├── radar/
    │   │   └── screens/
    │   │       └── RadarScreen.tsx      # Placeholder
    │   ├── matchmaking/
    │   │   └── screens/
    │   │       └── MatchmakingScreen.tsx # Placeholder
    │   ├── rankings/
    │   │   └── screens/
    │   │       └── RankingsScreen.tsx   # Placeholder
    │   └── profile/
    │       └── screens/
    │           └── ProfileScreen.tsx    # Placeholder
    ├── components/
    │   ├── Button.tsx
    │   ├── TextInput.tsx
    │   ├── Card.tsx
    │   ├── Badge.tsx
    │   ├── Avatar.tsx
    │   ├── LoadingSpinner.tsx
    │   └── EmptyState.tsx
    ├── hooks/
    │   └── useAuth.ts                   # Convenience hook over auth store
    ├── stores/
    │   └── auth-store.ts                # Zustand store with persist
    ├── services/
    │   ├── api.ts                       # Axios instance + interceptors
    │   └── endpoints.ts                 # Typed API functions
    ├── types/
    │   └── api.ts                       # DTOs matching backend schemas
    ├── utils/
    │   └── token.ts                     # JWT decode helpers
    └── navigation/
        ├── AuthStack.tsx                # Login → Register → Onboarding
        ├── MainTabs.tsx                 # 4 bottom tabs
        ├── RootNavigator.tsx            # Conditional: auth vs. app
        └── types.ts                     # Navigation param list types
```

---

## Color Palette (tailwind.config.js)

```js
colors: {
  'padel-green': {
    DEFAULT: '#22C55E',   // primary CTA
    light:   '#4ADE80',
    dark:    '#16A34A',
  },
  'dark': {
    DEFAULT: '#0F172A',   // app background
    card:    '#1E293B',   // card surface
    border:  '#334155',   // dividers
    muted:   '#64748B',   // secondary text
  },
  'trust': {
    high:    '#22C55E',   // Trust Score >= 80
    medium:  '#EAB308',   // Trust Score 50–79
    low:     '#EF4444',   // Trust Score < 50
    unknown: '#94A3B8',   // no data
  },
}
```

---

## API Client Architecture

```
src/services/api.ts
┌──────────────────────────────────────┐
│  axios instance                       │
│  baseURL: EXPO_PUBLIC_API_URL         │
│  timeout: 10_000                      │
│                                       │
│  Request interceptor                  │
│    → read accessToken from auth store │
│    → set Authorization: Bearer {tok}  │
│                                       │
│  Response interceptor                 │
│    → on 401:                          │
│      → call auth store refresh()      │
│      → if OK: retry original request  │
│      → if fail: auth store logout()   │
└──────────────────────────────────────┘
```

---

## Auth Store State Shape

```typescript
interface AuthState {
  // Tokens
  accessToken: string | null;          // in-memory only
  refreshToken: string | null;         // expo-secure-store via persist

  // User
  user: {
    id: string;
    email: string;
    name: string;
    role: 'player' | 'captain' | 'moderator' | 'superadmin';
    elo: number;
    trustScore: number;
    onboardingCompleted: boolean;
    status: 'active' | 'suspended' | 'banned';
  } | null;                            // AsyncStorage via persist

  // UI state
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, name: string): Promise<void>;
  logout(): void;
  refresh(): Promise<void>;
  setUser(user: AuthState['user']): void;
  completeOnboarding(data: OnboardingData): Promise<void>;
}
```

---

## Splash Screen Flow

```
App cold start
     │
     ▼
SplashScreen mounts
     │
     ├── No refresh token in expo-secure-store
     │        └──→ navigate to AuthStack
     │
     └── Refresh token found
              │
              ▼
         POST /auth/refresh
              │
              ├── 401 / network error
              │        └──→ clear store → navigate to AuthStack
              │
              └── 200 OK → store access token
                       │
                       ▼
                  GET /players/me
                       │
                       ├── user.onboardingCompleted === false
                       │        └──→ navigate to OnboardingScreen
                       │
                       └── user.onboardingCompleted === true
                                └──→ navigate to MainTabs
```
