# Design — EPIC 13: Tab Perfil

## Architecture

```
src/
├── types/index.ts              — agregar PlayerProfile, Preferences, MatchHistoryEntry, EloHistoryEntry
├── stores/
│   └── profile-store.ts        — Zustand store (profile, eloHistory, matchHistory, preferences)
└── features/profile/
    ├── ProfilePage.tsx          — REWRITE: Mi Perfil completo
    ├── EditProfilePage.tsx      — NEW: form apellido + geolocalización
    ├── AvatarUploadPage.tsx     — NEW: file input + preview + upload
    ├── PreferencesPage.tsx      — NEW: sliders radar + ELO range
    ├── PublicProfilePage.tsx    — REWRITE: perfil público readonly
    └── components/
        ├── EloChart.tsx         — SVG line chart
        ├── MatchHistoryList.tsx — lista de partidos
        └── TrustBadge.tsx      — badge trust con colores
```

## Profile Store Design

```typescript
interface ProfileState {
  profile: PlayerProfile | null
  eloHistory: EloHistoryEntry[]
  matchHistory: MatchHistoryEntry[]
  matchHistoryPage: number
  hasMoreMatches: boolean
  preferences: PlayerPreferences | null
  loading: boolean
  uploading: boolean
  error: string | null
}

interface ProfileActions {
  fetchProfile: () => Promise<void>
  updateProfile: (data: UpdateProfileData) => Promise<void>
  uploadAvatar: (file: File) => Promise<void>
  fetchEloHistory: () => Promise<void>
  fetchMatchHistory: (playerId?: number, reset?: boolean) => Promise<void>
  fetchPreferences: () => Promise<void>
  updatePreferences: (data: Partial<PlayerPreferences>) => Promise<void>
}
```

## API Types

```typescript
interface PlayerProfile {
  id: number
  name: string
  last_name: string
  username: string
  email: string
  avatar_url: string | null
  elo_rating: number
  trust_score: number
  trust_label: 'Excelente' | 'Bueno' | 'Bajo'
  status: string
  validated_match_count: number
  onboarding_completed: boolean
  calibration_matches_remaining?: number
  latitude?: number
  longitude?: number
}

interface PlayerPreferences {
  radar_radius_km: number
  elo_min_delta: number
  elo_max_delta: number
}

interface MatchHistoryEntry {
  id: number
  played_at: string
  result: string       // "6-4, 7-5"
  team1: string[]
  team2: string[]
  elo_delta: number    // +12 o -8
  won: boolean
}

interface EloHistoryEntry {
  date: string
  elo: number
  delta: number
}
```

## ELO Chart Design

SVG line chart sin dependencias externas:
- ViewBox: 0 0 300 80
- Path calculado desde array de puntos normalizados
- Puntos clickeables (círculos SVG)
- Gradiente de área bajo la curva
- Responsive: width 100%, height fija

## Geolocation Flow

```
1. Usuario toca "Usar mi ubicación"
2. navigator.geolocation.getCurrentPosition()
3. Validar bounds Mendoza: lat [-35.5, -32.0], lng [-70.5, -67.5]
4. Si fuera de bounds → toast "Ubicación fuera de Mendoza"
5. Si ok → mostrar "📍 lat, lng" y guardar en state
6. Al submit → incluir latitude/longitude en PUT /players/me
```

## Avatar Upload Flow

```
1. input[type=file] accept="image/jpeg,image/png,image/webp"
2. onChange → validar tamaño ≤ 5MB
3. FileReader → mostrar preview inmediato
4. Submit → new FormData(), append('file', file)
5. POST /players/me/avatar (sin Content-Type, browser lo setea con boundary)
6. Response → nueva avatar_url → actualizar profile store + auth store user
```

## Preferences Auto-save

```
1. onChange slider → debounce 800ms → PUT /players/me/preferences
2. Mostrar estado "Guardando..." / "Guardado" en UI
3. En error → revertir valor del slider
```

## Color Tokens

| Elemento | Token |
|----------|-------|
| Fondo página | bg-bg-dark |
| Cards | bg-bg-card |
| Texto principal | text-text-primary |
| Texto secundario | text-text-secondary |
| CTA (editar) | padel-green |
| ELO número | text-padel-green |
| Trust Excelente | trust-high (verde) |
| Trust Bueno | trust-medium (amarillo) |
| Trust Bajo | trust-low (rojo) |
| ELO delta + | text-trust-high |
| ELO delta - | text-trust-low |

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| /profile | ProfilePage | Mi perfil (Tab 4) |
| /profile/edit | EditProfilePage | Editar apellido + ubicación |
| /profile/avatar | AvatarUploadPage | Upload avatar |
| /profile/preferences | PreferencesPage | Preferencias matchmaking |
| /profile/:id | PublicProfilePage | Perfil público otro jugador |
