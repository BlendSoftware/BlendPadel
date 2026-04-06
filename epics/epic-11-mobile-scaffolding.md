# EPIC 11 — Scaffolding Mobile App

> **Sprint**: 5
> **Prioridad**: Alta (bloqueante para todo el frontend)
> **Dependencias**: Ninguna (backend ya completo)
> **Historias**: FE-001 a FE-006

---

## Objetivo

Scaffoldear la app mobile con Expo, configurar navegación (Tab + Stack), crear el API client con interceptors para JWT, configurar el auth store con Zustand, y crear los componentes base del design system. Al terminar esta EPIC, la app compila, navega entre tabs y se conecta al backend.

## Contexto

Greenfield. La carpeta `mobile/` está vacía. Necesitamos la base técnica sobre la que se construyen todas las pantallas. Igual que EPIC 00 para el backend, esta EPIC es la fundación del frontend.

## Historias de Usuario

### FE-001: Inicializar proyecto Expo con TypeScript + NativeWind
- `npx create-expo-app mobile --template blank-typescript`
- Configurar NativeWind (Tailwind CSS para React Native)
- Configurar path aliases (`@/` → `src/`)
- Estructura de carpetas: src/{features,components,hooks,stores,services,types,utils}

### FE-002: Configurar navegación Tab + Stack
- Bottom Tab Navigator con 4 tabs: Radar, Matchmaking, Rankings, Perfil
- Stack Navigator dentro de cada tab para pantallas de detalle
- Auth Stack separado (Login, Register, Onboarding) — se muestra si no hay token
- Navegación condicional: sin token → Auth Stack, con token → Main Tabs

### FE-003: API Client con JWT interceptors
- Crear `src/services/api.ts` con axios o fetch wrapper
- Request interceptor: inyectar `Authorization: Bearer {token}` en cada request
- Response interceptor: si 401 → intentar refresh → si falla → logout
- Base URL configurable por environment
- Proactive refresh: programar refresh 1 min antes de expiración

### FE-004: Auth Store con Zustand
- `src/stores/auth-store.ts` — Zustand store
- Estado: accessToken, refreshToken, user (id, email, name, role, elo, trustScore, onboardingCompleted)
- Actions: login, logout, refresh, setUser
- Persist: AsyncStorage para refresh token (no access token)
- Al abrir app: intentar refresh si hay token guardado

### FE-005: Design System — Componentes base
- Colors: definir paleta BlendPadel (verde pádel, fondo oscuro, acentos)
- Typography: tamaños y pesos estándar
- Componentes: Button, TextInput, Card, Badge, Avatar, LoadingSpinner, EmptyState
- NativeWind classes personalizadas en tailwind.config.js

### FE-006: Pantalla de Loading / Splash
- Splash screen mientras se verifica el token
- Si hay refresh token guardado → intentar refresh → si OK → Main Tabs
- Si no hay token o refresh falla → Auth Stack

## Enfoque Técnico

### Estructura de Carpetas
```
mobile/
├── src/
│   ├── features/
│   │   ├── auth/          # Login, Register, Onboarding screens
│   │   ├── radar/         # Tab 1
│   │   ├── matchmaking/   # Tab 2
│   │   ├── rankings/      # Tab 3
│   │   └── profile/       # Tab 4
│   ├── components/        # Shared UI components
│   │   ├── Button.tsx
│   │   ├── TextInput.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   └── LoadingSpinner.tsx
│   ├── hooks/             # Custom hooks
│   ├── stores/            # Zustand stores
│   │   └── auth-store.ts
│   ├── services/          # API client
│   │   └── api.ts
│   ├── types/             # TypeScript types
│   │   └── api.ts
│   ├── utils/             # Helpers
│   └── navigation/        # Navigation config
│       ├── AuthStack.tsx
│       ├── MainTabs.tsx
│       └── RootNavigator.tsx
├── app.json
├── App.tsx
├── tailwind.config.js
├── package.json
└── tsconfig.json
```

### Dependencias Clave
- expo, expo-router o @react-navigation/native + @react-navigation/bottom-tabs + @react-navigation/stack
- nativewind + tailwindcss
- zustand
- axios
- @react-native-async-storage/async-storage
- expo-secure-store (para tokens)

## Testing

- Verificar: `npx expo start` levanta sin errores
- Navegación entre 4 tabs funciona
- API client se conecta al backend (health check)
- Auth store persiste/recupera refresh token

## Definition of Done

- [ ] Expo app compila y arranca en emulador/dispositivo
- [ ] 4 tabs con navegación funcional
- [ ] API client conecta al backend con JWT
- [ ] Auth store con Zustand funciona (login/logout/refresh)
- [ ] Componentes base renderean correctamente
- [ ] Splash screen con auto-refresh
