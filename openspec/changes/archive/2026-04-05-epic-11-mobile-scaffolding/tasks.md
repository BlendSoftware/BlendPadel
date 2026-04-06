# Tasks: EPIC 11 — Scaffolding Mobile App

## Status: applied
## Depends on: proposal.md, design.md
## Stories: FE-001, FE-002, FE-003, FE-004, FE-005, FE-006

---

## 1. Inicializar proyecto Expo

- [x] 1.1 Run `npx create-expo-app@latest mobile --template blank-typescript` in `/home/juani/ProyectosStartup/BlendPadel/`
- [x] 1.2 Install core dependencies:
  ```
  npx expo install nativewind tailwindcss zustand axios \
    @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack \
    react-native-screens react-native-safe-area-context \
    expo-secure-store @react-native-async-storage/async-storage
  ```
- [x] 1.3 Configure NativeWind:
  - Create `tailwind.config.js` with content paths `["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"]` and BlendPadel color palette
  - Update `babel.config.js` to include `"nativewind/babel"` preset and `babel-plugin-module-resolver` for `@/` alias
  - Create `metro.config.js` with NativeWind CSS interop (`withNativeWind`)
  - Create `global.css` with `@tailwind base; @tailwind components; @tailwind utilities;`
  - Import `global.css` in `App.tsx`
- [x] 1.4 Configure TypeScript path aliases in `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "baseUrl": ".",
      "paths": { "@/*": ["src/*"] }
    }
  }
  ```
- [x] 1.5 Create folder structure:
  ```
  src/features/auth/screens/
  src/features/radar/screens/
  src/features/matchmaking/screens/
  src/features/rankings/screens/
  src/features/profile/screens/
  src/components/
  src/hooks/
  src/stores/
  src/services/
  src/types/
  src/utils/
  src/navigation/
  ```
- [x] 1.6 Verify: `npx expo export --platform web` bundles 729 modules with no errors

---

## 2. API Client

- [x] 2.1 Create `src/services/api.ts`:
  - Axios instance with `baseURL` from `process.env.EXPO_PUBLIC_API_URL` (fallback to `http://localhost:8080`)
  - `timeout: 10_000`
  - `Content-Type: application/json` default header
- [x] 2.2 Add request interceptor to `src/services/api.ts`:
  - Read `accessToken` from `useAuthStore.getState().accessToken`
  - If present, set `Authorization: Bearer {token}` header on every outgoing request
- [x] 2.3 Add response interceptor to `src/services/api.ts`:
  - On 401 response: call `useAuthStore.getState().refresh()`
  - If refresh succeeds: retry the original failed request with the new access token
  - If refresh throws: call `useAuthStore.getState().logout()` and rethrow
  - Use a `isRetry` flag on the config to avoid infinite retry loops
- [x] 2.4 Create `src/services/endpoints.ts` with typed API functions:
  - `authApi.login(email, password)` → `POST /auth/login`
  - `authApi.register(email, password, name)` → `POST /auth/register`
  - `authApi.refresh(refreshToken)` → `POST /auth/refresh`
  - `authApi.logout()` → `POST /auth/logout`
  - `playersApi.getMe()` → `GET /players/me`
  - `playersApi.updateProfile(data)` → `PATCH /players/me`
  - `playersApi.completeOnboarding(data)` → `POST /players/me/onboarding`
  - `matchesApi.list(params)` → `GET /matches`
  - `matchesApi.getById(id)` → `GET /matches/{id}`
  - `rankingsApi.list(params)` → `GET /rankings`
  - `healthApi.check()` → `GET /health`
- [x] 2.5 Create `src/types/api.ts` with TypeScript interfaces matching backend DTOs:
  - `LoginRequest`, `LoginResponse` (accessToken, refreshToken, expiresIn, user)
  - `RegisterRequest`, `RegisterResponse`
  - `RefreshRequest`, `RefreshResponse`
  - `PlayerDTO` (id, email, name, role, elo, eloCategory, trustScore, trustLevel, onboardingCompleted, status, avatarUrl, location, createdAt)
  - `MatchDTO`, `MatchResultDTO`, `RankingEntryDTO`
  - `ApiError` (code, message, details)

---

## 3. Auth Store (Zustand)

- [x] 3.1 Create `src/stores/auth-store.ts`:
  - State shape as defined in design.md (accessToken, refreshToken, user, isAuthenticated, isLoading)
  - `login(email, password)`: call `authApi.login()` → store tokens → store user → schedule proactive refresh
  - `register(email, password, name)`: call `authApi.register()` → store tokens → store user → schedule proactive refresh
  - `logout()`: call `authApi.logout()` (fire-and-forget) → clear all state → clear refresh timer → clear `expo-secure-store`
  - `refresh()`: call `authApi.refresh(refreshToken)` → update accessToken → reschedule proactive refresh timer
  - `setUser(user)`: update user in store
  - `completeOnboarding(data)`: call `playersApi.completeOnboarding(data)` → update `user.onboardingCompleted = true`
  - Persist config: `refreshToken` via custom `expo-secure-store` adapter; `user` via AsyncStorage; `accessToken` excluded from persistence
- [x] 3.2 Create `src/hooks/useAuth.ts`:
  - Re-export `useAuthStore` with a simpler `useAuth` name
  - Export individual selectors: `useIsAuthenticated()`, `useCurrentUser()`, `useAuthLoading()`
- [x] 3.3 Implement proactive token refresh in `src/stores/auth-store.ts`:
  - Track `_refreshTimerId` in a module-level variable (not in Zustand state)
  - After login/refresh success: `clearTimeout(_refreshTimerId)` then `_refreshTimerId = setTimeout(() => store.refresh(), (expiresIn - 60) * 1000)`
  - On logout: `clearTimeout(_refreshTimerId)`

---

## 4. Navigation

- [x] 4.1 Create `src/navigation/types.ts`:
  - `AuthStackParamList`: `{ Splash: undefined; Login: undefined; Register: undefined; Onboarding: undefined }`
  - `MainTabParamList`: `{ Radar: undefined; Matchmaking: undefined; Rankings: undefined; Perfil: undefined }`
  - `RootStackParamList`: `{ Auth: NavigatorScreenParams<AuthStackParamList>; Main: NavigatorScreenParams<MainTabParamList> }`
- [x] 4.2 Create `src/navigation/AuthStack.tsx`:
  - `createNativeStackNavigator` with screens: Splash (no header), Login, Register, Onboarding
  - Initial route: `Splash`
  - No header on all screens (`headerShown: false`)
- [x] 4.3 Create `src/navigation/MainTabs.tsx`:
  - `createBottomTabNavigator` with 4 tabs: Radar, Matchmaking, Rankings, Perfil
  - Tab bar style: `backgroundColor: '#0F172A'` (dark.DEFAULT), active tint `#22C55E` (padel-green), inactive tint `#64748B` (dark.muted)
  - Tab icons via `Ionicons` from `@expo/vector-icons`:
    - Radar: `map-outline` / `map`
    - Matchmaking: `tennisball-outline` / `tennisball`
    - Rankings: `trophy-outline` / `trophy`
    - Perfil: `person-outline` / `person`
- [x] 4.4 Create `src/navigation/RootNavigator.tsx`:
  - Read `isAuthenticated` and `isLoading` from auth store
  - If `isLoading`: render `<LoadingSpinner />` (prevents navigator flash)
  - If `isAuthenticated`: render `MainTabs`
  - Else: render `AuthStack`
  - Wrap in `<NavigationContainer>` and `<SafeAreaProvider>`
- [x] 4.5 Update `App.tsx` to render only `<RootNavigator />` wrapped in providers

---

## 5. Design System — Componentes Base

- [x] 5.1 Create `src/components/Button.tsx`:
  - Props: `variant: 'primary' | 'secondary' | 'outline'`, `size: 'sm' | 'md' | 'lg'`, `loading: boolean`, `disabled: boolean`, standard `TouchableOpacity` props
  - Primary: `bg-padel-green` text white
  - Secondary: `bg-dark-card` text white
  - Outline: `border border-padel-green` text padel-green
  - Loading state: replace children with `<ActivityIndicator />`
- [x] 5.2 Create `src/components/TextInput.tsx`:
  - Props: `label?: string`, `error?: string`, `leftIcon?: React.ReactNode`, `rightIcon?: React.ReactNode`, standard `TextInput` props
  - Dark background `bg-dark-card`, border `border-dark-border`, focus border `border-padel-green`
  - Error state: red border + error message below input
- [x] 5.3 Create `src/components/Card.tsx`:
  - Props: `className?: string`, `children: React.ReactNode`
  - Style: `bg-dark-card rounded-xl p-4` with subtle shadow
- [x] 5.4 Create `src/components/Badge.tsx`:
  - Props: `label: string`, `variant: 'trust-high' | 'trust-medium' | 'trust-low' | 'trust-unknown' | 'elo' | 'role'`
  - Maps variant to color: trust variants use trust color palette, elo uses padel-green, role uses a neutral
- [x] 5.5 Create `src/components/Avatar.tsx`:
  - Props: `uri?: string`, `name?: string`, `size: 'sm' | 'md' | 'lg' | 'xl'`
  - If `uri`: render `<Image>` with circular crop
  - If no `uri`: render colored circle with initials derived from `name`
  - Size map: sm=32, md=40, lg=56, xl=80 (px)
- [x] 5.6 Create `src/components/LoadingSpinner.tsx`:
  - Props: `size?: 'small' | 'large'`, `color?: string`, `fullScreen?: boolean`
  - `fullScreen`: centers spinner in `flex-1 bg-dark` container
  - Default color: `#22C55E` (padel-green)
- [x] 5.7 Create `src/components/EmptyState.tsx`:
  - Props: `icon: keyof typeof Ionicons.glyphMap`, `title: string`, `message?: string`, `action?: { label: string; onPress: () => void }`
  - Centered layout with icon, title, optional message, optional CTA button
- [x] 5.8 Define full color palette in `tailwind.config.js`:
  - `padel-green` (DEFAULT, light, dark)
  - `dark` (DEFAULT, card, border, muted)
  - `trust` (high, medium, low, unknown)
  - All in `extend.colors` section

---

## 6. Splash / Loading Screen

- [x] 6.1 Create `src/features/auth/screens/SplashScreen.tsx`:
  - Full-screen dark background with centered BlendPadel logo/wordmark and `<LoadingSpinner />`
  - No navigation header
- [x] 6.2 On component mount (`useEffect` with empty deps), execute token verification flow:
  - Read `refreshToken` from `expo-secure-store` directly (not from Zustand, which may not be hydrated yet)
  - If no token found: navigate to `Login` (within AuthStack)
- [x] 6.3 If no refresh token:
  - Navigate to `Login` screen
- [x] 6.4 If refresh token found:
  - Call `useAuthStore.getState().refresh()`
  - On success: call `GET /players/me` → store user via `setUser()`
    - If `user.onboardingCompleted === false`: navigate to `Onboarding`
    - If `user.onboardingCompleted === true`: RootNavigator will automatically show `MainTabs` (isAuthenticated becomes true)
  - On failure: clear store → navigate to `Login`

---

## 7. Placeholder Screens

- [x] 7.1 Create placeholder tab screens (each just renders a centered text label):
  - `src/features/radar/screens/RadarScreen.tsx` — "Radar — Coming Soon"
  - `src/features/matchmaking/screens/MatchmakingScreen.tsx` — "Matchmaking — Coming Soon"
  - `src/features/rankings/screens/RankingsScreen.tsx` — "Rankings — Coming Soon"
  - `src/features/profile/screens/ProfileScreen.tsx` — "Perfil — Coming Soon"
- [x] 7.2 Create placeholder auth screens:
  - `src/features/auth/screens/LoginScreen.tsx` — "Login — Coming Soon"
  - `src/features/auth/screens/RegisterScreen.tsx` — "Register — Coming Soon"
  - `src/features/auth/screens/OnboardingScreen.tsx` — "Onboarding — Coming Soon"

---

## 8. Verificación

- [x] 8.1 `npx expo export --platform web` bundles 729 modules with zero TypeScript errors and zero metro bundler errors
- [ ] 8.2 Navigation between all 4 tabs works (tap each tab, screen changes) — requires device/emulator
- [ ] 8.3 Auth stack shows when no refresh token is present — requires device/emulator
- [ ] 8.4 API client can reach backend — requires running backend
- [ ] 8.5 NativeWind classes render correctly — requires device/emulator
- [ ] 8.6 All 7 base components render without errors — requires device/emulator
- [ ] 8.7 Auth store persists across restart — requires device/emulator

---

## Completion Criteria

Static verification complete: TypeScript passes, Metro bundler compiles all 729 modules with no errors.
Runtime verification (8.2–8.7) requires a physical device or emulator.
