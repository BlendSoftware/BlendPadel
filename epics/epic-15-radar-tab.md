# EPIC 15 — Radar (Tab 1 — Mobile Frontend)

> **Sprint**: 6
> **Prioridad**: Alta (pantalla principal)
> **Dependencias**: EPIC 13 (Perfil Mobile)
> **Historias**: FE-024, FE-025, FE-026, FE-027, FE-028

---

## Objetivo

Implementar el Tab 1 de la app mobile: el radar de partidos calientes. Mapa interactivo centrado en la posición del usuario con marcadores por partido disponible, alertas de urgencia con FOMO, filtro ELO deslizante, y bottom sheet de detalle al tocar un marcador. Es la pantalla de mayor impacto visual y la que más va a retener usuarios.

## Contexto

El Radar es la pantalla principal de la app — lo primero que ve el usuario al abrir BlendPadel. Muestra partidos incompletos que se juegan HOY cerca de su ubicación. Es el centro de acción y FOMO. Un mapa vacío mata la retención; un mapa con 3-4 partidos a 2km genera urgencia de participar. Auto-refresh cada 30s mantiene la ilusión de actividad constante.

## Historias de Usuario

### FE-024: Mapa de partidos activos
- Pantalla principal con `MapView` (react-native-maps) centrada en posición del usuario
- `expo-location` para obtener coordenadas del dispositivo (pide permiso en onboarding)
- Marcadores custom (`MatchPin`) para cada partido del endpoint `GET /radar/matches`
- Zoom automático para que todos los partidos del radio sean visibles
- Pull-to-refresh y auto-refresh cada 30 segundos en background

### FE-025: Alertas de urgencia (FOMO banner)
- `GET /radar/alerts` al cargar y en cada refresh
- `AlertBanner` flotante en la parte superior del mapa cuando hay partidos urgentes (<1h, <5km)
- Máximo 1 banner visible a la vez, con texto "¡Partido en X min a Y km!"
- Badge rojo en el ícono del tab mientras haya alertas activas
- Animación de entrada (slide down) para el banner

### FE-026: Filtro ELO deslizante
- `ELOFilterSlider` en la parte inferior del mapa (sobre el mapa, no debajo)
- Range slider: mínimo y máximo ELO, default ±200 del ELO del usuario
- Al cambiar el rango, re-fetches `GET /radar/matches` con nuevos parámetros
- Debounce de 500ms para evitar llamadas excesivas mientras se arrastra

### FE-027: Bottom sheet de detalle de partido
- Al tocar un `MatchPin`, se abre un bottom sheet (react-native-bottom-sheet)
- Muestra: cancha, hora, jugadores confirmados, ELO promedio, slots disponibles
- CTA: "Quiero jugar" → navega a flujo de matchmaking/flares (EPIC 16)
- Se cierra con swipe down o tap fuera del sheet

### FE-028: Estado vacío e indicadores de carga
- Indicador de carga al primer fetch (spinner sobre el mapa)
- Estado vacío: si no hay partidos en el radio, mostrar mensaje + botón "Crear partido"
- Si `expo-location` es denegado, mostrar pantalla de prompt con explicación y botón de configuración del sistema

## Enfoque Técnico

### Estructura de archivos
```
src/
  features/
    radar/
      screens/
        RadarScreen.tsx            # Tab root, contiene MapView + overlays
      components/
        RadarMap.tsx               # MapView con MatchPin markers
        MatchPin.tsx               # Marcador custom: ícono de raqueta + ELO badge
        AlertBanner.tsx            # Banner flotante superior con partido urgente
        ELOFilterSlider.tsx        # Range slider sobre el mapa
        MatchDetailSheet.tsx       # Bottom sheet con detalle del partido
        RadarEmptyState.tsx        # Pantalla cuando no hay partidos
      store/
        radar-store.ts             # Zustand: matches[], alerts[], eloRange, userLocation
      hooks/
        useRadar.ts                # Fetch + auto-refresh interval + location
        useRadarAlerts.ts          # Fetch + polling alertas
      services/
        radar.service.ts           # Calls a GET /radar/matches, /radar/alerts
      types/
        radar.types.ts             # RadarMatch, RadarAlert, ELORange interfaces
```

### Zustand store: `radar-store.ts`
```ts
interface RadarStore {
  matches: RadarMatch[];
  alerts: RadarAlert[];
  userLocation: { lat: number; lng: number } | null;
  eloRange: { min: number; max: number };
  radiusKm: number;
  selectedMatchId: string | null;
  isLoading: boolean;
  error: string | null;

  setUserLocation: (loc: { lat: number; lng: number }) => void;
  setELORange: (range: { min: number; max: number }) => void;
  selectMatch: (id: string | null) => void;
  fetchMatches: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

### Endpoints consumidos
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/radar/matches?lat=&lng=&radius_km=&elo_min=&elo_max=` | Partidos en radio con filtros |
| GET | `/radar/alerts` | Alertas urgentes (<1h, <5km) |

### Dependencias nativas
- `react-native-maps`: MapView, Marker, custom callouts
- `expo-location`: `Location.getCurrentPositionAsync`, `Location.requestForegroundPermissionsAsync`
- `react-native-bottom-sheet`: BottomSheet, BottomSheetView
- `@react-native-community/slider` o librería de range slider compatible con Expo

### Auto-refresh
```ts
// En useRadar hook
useEffect(() => {
  fetchMatches();
  const interval = setInterval(fetchMatches, 30_000);
  return () => clearInterval(interval);
}, [eloRange, userLocation]);
```

### Consideraciones de rendimiento
- `MatchPin` usa `React.memo` — el mapa puede tener 10-30 marcadores simultáneos
- `MapView` con `provider={PROVIDER_GOOGLE}` en Android para mejor performance
- Evitar re-renders del mapa completo al cambiar solo el bottom sheet state

## Testing

- **Tests unitarios**: `radar-store.ts` — setELORange, selectMatch, refresh
- **Tests de componente**: `AlertBanner` con/sin alertas, `ELOFilterSlider` dispara onChange con debounce
- **Mocks**: `expo-location` mockeado en tests con coordenadas fijas de Mendoza
- **Tests de integración**: flujo tap en pin → bottom sheet abre con datos correctos

## Definition of Done

- [ ] Mapa centra en posición real del usuario al abrir
- [ ] Marcadores de partidos aparecen correctamente en el mapa
- [ ] AlertBanner aparece y desaparece según alertas del backend
- [ ] Badge rojo en tab ícono cuando hay alertas activas
- [ ] Filtro ELO filtra marcadores con debounce de 500ms
- [ ] Bottom sheet abre al tocar marcador con datos del partido
- [ ] Auto-refresh funciona cada 30s sin bloquear la UI
- [ ] Pull-to-refresh funciona
- [ ] Estado vacío visible cuando no hay partidos en radio
- [ ] Permiso de ubicación denegado muestra pantalla informativa
