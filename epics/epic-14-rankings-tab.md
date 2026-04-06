# EPIC 14 — Rankings (Tab 3 — Mobile Frontend)

> **Sprint**: 6
> **Prioridad**: Alta
> **Dependencias**: EPIC 13 (Perfil Mobile)
> **Historias**: FE-020, FE-021, FE-022, FE-023

---

## Objetivo

Implementar el Tab 3 de la app mobile: la tabla de rankings hiperlocales. El usuario ve el top de su zona, puede cambiar de región, su posición aparece destacada aunque no esté en el top visible, y puede proyectar cuántos puntos ganaría o perdería antes de aceptar un partido.

## Contexto

El ranking es la Arena del Ego del mendocino. "Top 10 de la Zona Este", "Los mejores de 5ta en Rivadavia". La gente necesita sentirse importante en su micro-comunidad. La proyección de puntos añade presión psicológica antes de pisar la cancha. Este tab consume datos del backend EPIC 07 ya implementado.

## Historias de Usuario

### FE-020: Leaderboard por zona
- Pantalla principal del tab con lista de jugadores de la región seleccionada
- `GET /rankings?region_id=&limit=10` con paginación load-more
- Posición del usuario autenticado siempre visible aunque no esté en top N (sticky row al fondo)
- Skeleton loader mientras carga, pull-to-refresh para actualizar

### FE-021: Selector de región
- Picker/modal para cambiar la región activa
- `GET /regions` para obtener lista de regiones disponibles
- Región seleccionada persiste en Zustand store (no solo local)
- Chip con nombre de región activa en el header del tab

### FE-022: Mi posición destacada
- La fila del usuario autenticado se muestra con fondo diferenciado (accent color)
- Badge con su posición global + posición en zona
- Si está en top 3 mostrar medalla (oro/plata/bronce) en lugar de número

### FE-023: Proyección de puntos antes de aceptar
- Card de proyección que se muestra antes de confirmar un partido en Tab 2
- `GET /matches/projection?team_a={id1},{id2}&team_b={id3},{id4}`
- Muestra delta ELO proyectado: +XX si ganás / -XX si perdés
- Integración con flujo de aceptar partido desde Matchmaking (EPIC 16)

## Enfoque Técnico

### Estructura de archivos
```
src/
  features/
    rankings/
      screens/
        RankingsScreen.tsx         # Tab root, header con RegionPicker
      components/
        RankingTable.tsx           # FlatList con RankEntry items
        RankEntry.tsx              # Fila individual: posición, avatar, nombre, ELO
        RegionPicker.tsx           # Modal/ActionSheet selector de región
        ProjectionCard.tsx         # Card win/loss delta ELO
      store/
        rankings-store.ts          # Zustand: region, rankings[], myPosition, loading
      hooks/
        useRankings.ts             # Fetch + refresh logic
        useProjection.ts           # Fetch proyección para un partido dado
      services/
        rankings.service.ts        # Calls a GET /rankings, /regions, /matches/projection
      types/
        rankings.types.ts          # RankingEntry, Region, Projection interfaces
```

### Zustand store: `rankings-store.ts`
```ts
interface RankingsStore {
  selectedRegionId: string | null;
  regions: Region[];
  rankings: RankingEntry[];
  myPosition: RankingEntry | null;
  isLoading: boolean;
  error: string | null;

  setRegion: (regionId: string) => void;
  fetchRegions: () => Promise<void>;
  fetchRankings: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

### Endpoints consumidos
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/rankings?region_id=&limit=10` | Ranking paginado por zona |
| GET | `/regions` | Lista de regiones disponibles |
| GET | `/matches/projection?team_a=&team_b=` | Proyección delta ELO |

### Componentes clave

**RankEntry**: fila con posición (número o medalla), avatar circular, nombre, ELO badge, win rate. Resaltada si `isMe === true`.

**RegionPicker**: ActionSheet nativo (expo-action-sheet o BottomSheet) con lista de regiones. Cierre al seleccionar, actualiza store y refetch rankings.

**ProjectionCard**: card compacta con dos columnas: "Si ganás: +XX ELO" / "Si perdés: -XX ELO". Fondo verde/rojo sutil. Se muestra en modal de aceptar partido.

**RankingTable**: FlatList con ListFooterComponent para load-more, sticky footer con fila del usuario autenticado si no está en el top visible.

### Navegación
- Tab 3 → `RankingsScreen` (stack raíz)
- `ProjectionCard` se usa como componente embebido en flujo de matchmaking, no como pantalla propia

## Testing

- **Tests unitarios**: `rankings-store.ts` — setRegion actualiza state y dispara refetch
- **Tests de componente**: `RankEntry` con prop `isMe` renderiza highlight correcto, `ProjectionCard` muestra deltas correctos
- **Tests de integración**: flujo completo cambio de región → nueva lista carga con datos mockeados

## Definition of Done

- [ ] Leaderboard muestra top jugadores de la región seleccionada
- [ ] Posición del usuario autenticado siempre visible en pantalla
- [ ] Selector de región funciona y persiste entre sesiones
- [ ] Usuarios en top 3 muestran medalla
- [ ] ProjectionCard muestra delta ELO correcto win/loss
- [ ] Pull-to-refresh actualiza datos
- [ ] Skeleton loader durante carga inicial
- [ ] Error state con retry cuando falla la red
