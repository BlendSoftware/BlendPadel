# EPIC 16 — Matchmaking + Gestión de Partidos (Tab 2 — Mobile Frontend)

> **Sprint**: 6-7
> **Prioridad**: Alta (funcionalidad core)
> **Dependencias**: EPIC 13 (Perfil Mobile)
> **Historias**: FE-029, FE-030, FE-031, FE-032, FE-033, FE-034, FE-035, FE-036, FE-037

---

## Objetivo

Implementar el Tab 2 de la app mobile: el hub de matchmaking y ciclo de vida completo de un partido. Es el tab más complejo — combina el muro de flares (buscar compañeros de partido) con la gestión post-partido (cargar resultado, confirmar/disputar, reportar misconduct). Es el corazón transaccional de BlendPadel.

## Contexto

Un partido en BlendPadel tiene un ciclo de vida completo: se crea como flare (o directamente), se completan los 4 jugadores, se juega, se carga el resultado, se confirma o se disputa dentro de una ventana de 6 horas. La UI debe guiar al usuario por cada paso sin fricción. El muro de flares es el mercado donde la gente busca compañeros; la gestión de resultado es donde el sistema de ELO cobra vida.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| MA-01 | Partido 2v2: exactamente 4 jugadores |
| MA-03 | Resultado pendiente hasta que ambos equipos confirmen |
| MA-04 | Ventana de confirmación: 6 horas desde submit |
| MA-05 | Disputa abre caso en Tribunal Admin |
| TR-02 | Trust score afecta visibilidad de flares |

## Historias de Usuario

### FE-029: Muro de flares (explorar)
- Lista de flares activos en la zona del usuario
- `GET /matchmaking/flares?region_id=&status=open`
- Card por flare con: zona, hora propuesta, slots disponibles, ELO promedio, creador
- Filtros rápidos: zona, hora, ELO range
- Pull-to-refresh, paginación load-more

### FE-030: Crear flare
- Form para publicar un flare de búsqueda de compañeros
- `POST /matchmaking/flares` — zona, hora propuesta, nivel, slots disponibles (1, 2 o 3)
- Validación inline: hora futura, zona requerida
- Confirmación al publicar: "Tu flare está activo"

### FE-031: Responder a un flare
- CTA "Quiero jugar" en FlareCard → `POST /matchmaking/flares/{id}/responses`
- Si el flare se completa (4 jugadores), el backend crea el partido automáticamente
- Notificación push cuando el flare se completa (ver EPIC 17)
- Mis flares respondidos visibles en sección "Mis actividades"

### FE-032: Crear partido directo
- FAB (+) en el tab → modal de creación de partido sin flare
- `POST /matches` — tipo, zona, hora, jugadores (por username o búsqueda)
- Búsqueda de jugadores: `GET /players/search?q=` con debounce
- Selección de 3 compañeros/rivales con avatares

### FE-033: Mis partidos (lista)
- Sección "Mis partidos" en el tab con estados: upcoming, pending_result, pending_confirm, completed
- `GET /matches?player_id=me&status=` con filtro por estado
- Tabs horizontales: Próximos / Pendientes / Historial
- MatchCard con estado visual claro (colores por estado)

### FE-034: Cargar resultado
- Pantalla de entrada de resultado para partidos en estado `pending_result`
- `POST /matches/{id}/result` — sets con games por equipo
- UI: `SetScoreInput` para cada set (ej. 6-4, 7-5, 10-8)
- Validación de scores: games válidos por set (0-7 rango)
- Confirmación visual antes de enviar: "¿Confirmar resultado 6-4 / 3-6 / 10-8?"

### FE-035: Confirmar resultado con countdown
- Pantalla para partidos en estado `pending_confirm`
- Muestra el resultado cargado por el otro equipo
- `ConfirmCountdown` con tiempo restante de la ventana de 6h
- Botón "Confirmar" → `POST /matches/{id}/confirm`
- Botón "Disputar" → abre `DisputeForm`

### FE-036: Disputar resultado
- `DisputeForm` como modal/pantalla: motivo de la disputa (texto libre)
- `POST /matches/{id}/dispute` — reason requerido
- Aviso claro: "La disputa será revisada por el Admin en 48h"
- Estado del partido pasa a `disputed` — visible en historial con badge

### FE-037: Reportar misconduct
- Disponible en pantalla de resultado confirmado o disputado
- `POST /matches/{id}/misconduct` — player_id afectado + descripción
- Botón "Reportar conducta" accesible pero no prominente (evitar abuse)
- Confirmación antes de enviar

## Enfoque Técnico

### Estructura de archivos
```
src/
  features/
    matchmaking/
      screens/
        MatchmakingScreen.tsx      # Tab root con secciones flares + mis partidos
        FlareDetailScreen.tsx      # Detalle de un flare con lista de respuestas
        FlareCreateScreen.tsx      # Form de creación de flare
      components/
        FlareCard.tsx              # Card de flare en el muro
        FlareForm.tsx              # Form fields reutilizables para crear flare
        FlareResponseList.tsx      # Lista de jugadores que respondieron
      store/
        matchmaking-store.ts       # Zustand: flares[], myFlares[], loading, filters
      hooks/
        useFlares.ts               # Fetch + pagination flares
      services/
        matchmaking.service.ts     # /matchmaking/flares CRUD
      types/
        matchmaking.types.ts       # Flare, FlareResponse interfaces

    match/
      screens/
        MatchListScreen.tsx        # Mis partidos con tabs de estado
        MatchCreateScreen.tsx      # Crear partido directo
        MatchDetailScreen.tsx      # Detalle + acciones según estado
        ResultEntryScreen.tsx      # Cargar resultado
        ConfirmResultScreen.tsx    # Confirmar/disputar resultado
        DisputeScreen.tsx          # Form de disputa
      components/
        MatchCard.tsx              # Card de partido con estado visual
        SetScoreInput.tsx          # Input pair para games de un set
        ConfirmCountdown.tsx       # Timer 6h con barra de progreso
        DisputeForm.tsx            # Form texto libre para disputar
        MisconductButton.tsx       # Botón discreto para reportar
        PlayerSearchPicker.tsx     # Búsqueda y selección de jugadores
      store/
        match-store.ts             # Zustand: matches[], selectedMatch, loading
      hooks/
        useMatches.ts              # Fetch matches por estado
        useMatchActions.ts         # submit result, confirm, dispute
      services/
        match.service.ts           # /matches CRUD + actions
      types/
        match.types.ts             # Match, SetScore, MatchResult interfaces
```

### Zustand store: `matchmaking-store.ts`
```ts
interface MatchmakingStore {
  flares: Flare[];
  myFlares: Flare[];
  filters: { regionId: string | null; eloMin: number; eloMax: number };
  isLoading: boolean;

  setFilters: (filters: Partial<FlareFilters>) => void;
  fetchFlares: () => Promise<void>;
  createFlare: (data: CreateFlareDTO) => Promise<void>;
  respondToFlare: (flareId: string) => Promise<void>;
  deleteFlare: (flareId: string) => Promise<void>;
}
```

### Zustand store: `match-store.ts`
```ts
interface MatchStore {
  matches: Match[];
  selectedMatch: Match | null;
  activeTab: 'upcoming' | 'pending' | 'history';
  isLoading: boolean;

  setActiveTab: (tab: MatchStore['activeTab']) => void;
  fetchMatches: () => Promise<void>;
  createMatch: (data: CreateMatchDTO) => Promise<void>;
  submitResult: (matchId: string, result: MatchResult) => Promise<void>;
  confirmResult: (matchId: string) => Promise<void>;
  disputeResult: (matchId: string, reason: string) => Promise<void>;
  reportMisconduct: (matchId: string, playerId: string, desc: string) => Promise<void>;
}
```

### Endpoints consumidos
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/matchmaking/flares` | Listar flares activos |
| POST | `/matchmaking/flares` | Crear flare |
| DELETE | `/matchmaking/flares/{id}` | Eliminar propio flare |
| POST | `/matchmaking/flares/{id}/responses` | Responder a un flare |
| GET | `/matches` | Mis partidos con filtros |
| POST | `/matches` | Crear partido directo |
| GET | `/matches/{id}` | Detalle de partido |
| POST | `/matches/{id}/result` | Cargar resultado |
| POST | `/matches/{id}/confirm` | Confirmar resultado |
| POST | `/matches/{id}/dispute` | Disputar resultado |
| POST | `/matches/{id}/misconduct` | Reportar misconduct |
| GET | `/players/search?q=` | Buscar jugadores para invitar |

### Componente `SetScoreInput`
```tsx
// Un par de inputs numéricos para un set
<SetScoreInput
  setNumber={1}
  value={{ teamA: 6, teamB: 4 }}
  onChange={(score) => updateSet(0, score)}
/>
// Renderiza: [6] - [4]  con validación 0-7
```

### Componente `ConfirmCountdown`
- Calcula tiempo restante desde `match.result_submitted_at + 6h`
- Barra de progreso que se vacía
- Cuando llega a 0: resultado se confirma automáticamente (backend), UI muestra "Confirmado"
- Polling cada 60s para sincronizar estado del match

### Navegación
```
Tab 2 (MatchmakingScreen)
  ├── FlareDetailScreen  [flare/:id]
  ├── FlareCreateScreen  [flares/new]
  ├── MatchCreateScreen  [matches/new]
  ├── MatchDetailScreen  [matches/:id]
  │     ├── ResultEntryScreen    [matches/:id/result]
  │     └── ConfirmResultScreen  [matches/:id/confirm]
  │           └── DisputeScreen  [matches/:id/dispute]
```

## Testing

- **Tests unitarios**: `match-store.ts` — submitResult, confirmResult actualizan estado correctamente; `SetScoreInput` valida rango de games
- **Tests de componente**: `ConfirmCountdown` renderiza tiempo restante correcto dado un timestamp, `MatchCard` muestra badge de estado correcto
- **Tests de integración**: flujo crear flare → responder flare → partido creado automáticamente (mocked backend)
- **Tests de integración**: flujo cargar resultado → confirm → match en estado `completed`

## Definition of Done

- [ ] Muro de flares muestra lista paginada con filtros funcionales
- [ ] Crear flare publica y aparece en el muro
- [ ] Responder a flare funciona y muestra feedback
- [ ] Crear partido directo con búsqueda de jugadores funciona
- [ ] Tabs Próximos/Pendientes/Historial muestran partidos correctos
- [ ] SetScoreInput valida scores y confirma antes de enviar
- [ ] ConfirmCountdown muestra tiempo restante real
- [ ] Disputa envía reason y muestra estado `disputed`
- [ ] Reportar misconduct accesible desde partido confirmado/disputado
- [ ] Pull-to-refresh en todas las listas
- [ ] Navegación entre pantallas es fluida y con back correcto
