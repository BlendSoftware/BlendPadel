# Frontend Bugfixes — Plan de acción

Bugs detectados en sesión QA del 22/04/2026. El backend está corregido (14 bugfixes ya mergeados), pero el frontend tiene problemas de integración y UX.

## WAVE 1 — Backend devuelve UUIDs en vez de objetos (arregla 3 bugs)

### BUG A: Players muestran "Jugador" con ELO 0

**Síntoma**: En match detail y previsualización de equipos, jugadores aparecen como "Jugador" con ELO 0.

**Root cause**: `MatchResponse.TeamA/TeamB` son `[]uuid.UUID` (`internal/match/model.go:98-99`). El frontend resuelve nombres desde un cache que solo tiene el top 100 del ranking por región (`app/src/stores/player-cache.ts:53-61`). Jugadores en calibración o fuera del ranking → fallback "Jugador" ELO 0.

**Fix backend**:
- Cambiar `MatchResponse` en `internal/match/model.go:88-106`:
  - `TeamA []uuid.UUID` → `TeamA []MatchPlayerInfo`
  - `TeamB []uuid.UUID` → `TeamB []MatchPlayerInfo`
  - Crear struct `MatchPlayerInfo { ID, Name, ELO, AvatarURL }`
- Actualizar `matchToResponse()` en `internal/match/service.go:666-689` para hacer JOIN con users y popular los datos
- Hacer lo mismo en `MatchHistoryItem` si también devuelve UUIDs
- La query `GetMatchByID` y `GetActiveMatchesByPlayer` necesitan JOIN con users para traer name, elo, avatar_url

**Fix frontend**:
- Actualizar `MatchPlayer` type en `app/src/features/matchmaking/types.ts:52-58` si cambia la shape
- Eliminar `hydrateTeam()` y `hydrateMatch()` de `app/src/stores/match-store.ts:18-48` — ya no se necesita resolver desde cache
- Eliminar dependencia de `player-cache` en match-store

---

### BUG E: Flares muestran "Neutro" y "8va" división

**Síntoma**: Flare card muestra categoría "8va" (ELO 0) y trust "Neutro" porque no tiene datos del player.

**Root cause**: El backend devuelve flares sin datos del player embebidos. El frontend usa fallbacks: `flare.player?.elo ?? 0` → categoría "8va", `flare.player?.trust_score ?? 80` → "Neutro".

**Fix backend**:
- En `internal/matchmaking/service.go` — función que construye la respuesta de flares: hacer JOIN con users para incluir `player: { id, name, elo, trust_score, avatar_url }` en cada flare
- Verificar query `GetActiveFlares` en `queries/matchmaking.sql` — agregar JOIN a users

**Fix frontend**:
- Verificar que `FlareCard.tsx` use los campos del player cuando existan
- El componente ya tiene la lógica de fallback (`app/src/features/matchmaking/components/FlareCard.tsx:31-36`), solo necesita recibir datos reales

---

## WAVE 2 — Fixes puntuales de frontend

### BUG B: Flare sigue visible después de aceptar

**Síntoma**: Después de responder a un flare, sigue apareciendo en la lista.

**Root cause**: `respondToFlare()` en `app/src/stores/matchmaking-store.ts:96` llama `fetchFlares()` pero no filtra por status. Si el backend devuelve flares con status "matched" o "responded", siguen visibles.

**Fix**:
1. Verificar que la query SQL `GetActiveFlares` tenga `WHERE status = 'active'` (en `queries/matchmaking.sql`)
2. Si el backend ya filtra, el bug es de timing — agregar optimistic update en el store:
   ```typescript
   // En respondToFlare, antes del fetch:
   set((s) => ({ flares: s.flares.filter((f) => f.id !== flareId) }))
   ```
3. Si el backend NO filtra, agregar filtro client-side en `fetchFlares()`:
   ```typescript
   set({ flares: data.filter((f: Flare) => f.status === 'active'), isLoading: false })
   ```

**Archivos**: `app/src/stores/matchmaking-store.ts:89-102`

---

### BUG C: Jugador repetido en selección de equipo

**Síntoma**: Al buscar jugadores para armar un partido, el mismo jugador aparece dos veces en los resultados.

**Root cause**: Posible race condition en `PlayerSearchPicker.tsx:34-42` o duplicados en la respuesta del backend. El `exclude_ids` se pasa correctamente pero puede haber timing issues entre búsquedas.

**Fix**:
1. Deduplicar resultados en el store (`app/src/stores/match-store.ts:310`):
   ```typescript
   const seen = new Set<string>()
   const deduped = (res.data ?? []).filter((p) => {
     if (seen.has(p.id)) return false
     seen.add(p.id)
     return true
   })
   set({ searchResults: deduped, isSearching: false })
   ```
2. Verificar que `PlayerSearchPicker.tsx` pase todos los IDs seleccionados en `excludeIds`
3. Verificar que `CreateMatchPage.tsx:62-63` compute correctamente `excludeA` y `excludeB` incluyendo jugadores de ambos equipos

**Archivos**:
- `app/src/stores/match-store.ts:295-314`
- `app/src/features/matchmaking/components/PlayerSearchPicker.tsx:34-42`
- `app/src/features/matchmaking/screens/CreateMatchPage.tsx:62-63`

---

### BUG D: Partido no visible para otros jugadores

**Síntoma**: Después de crear un partido, los otros jugadores no lo ven en su lista.

**Root cause**: La query SQL `GetActiveMatchesByPlayer` (`queries/matches.sql:40-45`) usa `JOIN match_players` lo cual es correcto. El problema puede ser:
1. El frontend de los otros jugadores no refresca automáticamente
2. El endpoint `GET /players/{playerID}/matches/active` requiere que el caller use su propio ID (verificar handler en `internal/match/handler.go:150-170`)
3. Los match_players no se insertan correctamente al crear el match — verificar `CreateMatch` en `internal/match/service.go`

**Diagnóstico necesario**:
```bash
# Después de crear un match, verificar que match_players tenga los 4 jugadores:
SELECT * FROM match_players WHERE match_id = '<match_id>';

# Verificar que el endpoint devuelve el match para un participante:
curl -H "Authorization: Bearer <other_player_token>" http://localhost:8080/players/<other_player_id>/matches/active
```

**Archivos**:
- `backend/queries/matches.sql:40-45`
- `backend/internal/match/handler.go:150-170`
- `backend/internal/match/service.go` — CreateMatch, verificar inserción en match_players

---

## Prioridad de ejecución

| # | Bug | Impacto | Complejidad | Tipo |
|---|-----|---------|-------------|------|
| 1 | A — "Jugador" ELO 0 | ALTO | Media | Backend + Frontend |
| 2 | E — "Neutro" / "8va" en flares | ALTO | Media | Backend + Frontend |
| 3 | B — Flare no desaparece | MEDIO | Baja | Frontend (+ verificar backend) |
| 4 | C — Jugador repetido | MEDIO | Baja | Frontend |
| 5 | D — Match invisible | ALTO | Media | Backend (+ verificar datos) |

Wave 1 (bugs A y E) comparten la misma solución: que el backend devuelva objetos de player en vez de UUIDs. Resolverlos juntos.
