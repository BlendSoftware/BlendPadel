# Proposal: EPIC 04 — Partidos y Validación Cruzada

## Why

Esta EPIC es donde TODO se conecta. El ELO existe pero nadie lo usa todavía. Los partidos son el evento que dispara el motor: crear partido → cargar resultado → validar → sellar → aplicar ELO + Trust Score → actualizar ranking.

La validación cruzada es el mecanismo anti-fraude central: el Capitán A carga el resultado, el Capitán B tiene 6 horas para confirmar o disputar. Si no dice nada, el resultado se sella automáticamente. Si disputa, ambos pierden Trust y un Moderador resuelve.

Sin esta EPIC, BlendPadel es un perfil con un número. Con esta EPIC, es un sistema de ranking vivo.

## What Changes

### Crear partido (US-023)
- `POST /matches` — 4 player_ids, coordenadas cancha, scheduled_at, asignación de equipos
- Creador = captain_a, primer jugador equipo B = captain_b
- Validar: no duplicados, todos existen, 4 jugadores exactos
- Estado inicial: `pending_result`
- Calcular y guardar avg_elo del partido

### Cargar resultado (US-024)
- `POST /matches/{id}/result` — sets con games por equipo (ej: [{team_a: 6, team_b: 4}, {team_a: 7, team_b: 5}])
- Solo el capitán del partido puede cargar
- Validar formato de sets: games ≥ 0, al menos 2 sets, un equipo ganó más sets
- Calcular winner_team, total_games, game_diff automáticamente
- Estado → `awaiting_confirmation`
- Disparar evento para push notification a Capitán B (placeholder — EPIC 10)

### Validación cruzada (US-025)
- `POST /matches/{id}/confirm` — Capitán B confirma
  - Estado → `sealed`, `sealed_by: "captain_b"`
  - Llamar `ranking.ApplyELO()` → actualiza ELO de 4 jugadores
  - Llamar `trust.RecoverFromMatch()` → +2 Trust por jugador
  - Verificar egreso calibración (US-028)
- `POST /matches/{id}/dispute` — Capitán B disputa
  - Estado → `disputed`
  - Llamar `trust.PenalizeDispute()` → -5 o -20 + freeze
  - Crear registro en tabla `disputes`
- Ventana: 6 horas desde carga del resultado. Después de 6h → endpoints retornan 409

### Auto-sellado (US-026)
- Goroutine con ticker cada 5 minutos
- Query: partidos `awaiting_confirmation` con result_submitted_at > 6h
- Para cada uno: sellar + ApplyELO + RecoverTrust + check calibración
- Registrar `sealed_by: "auto"`

### Resolución de disputas por Moderador (US-027)
- `GET /admin/disputes?status=pending` — filtrado por region_id del Moderador
- `POST /admin/disputes/{id}/resolve` — resultado correcto, penalización opcional
- Desfreeze ELO de ambos jugadores
- Aplicar ELO con resultado auditado
- Penalizar Trust del jugador culpable si corresponde (-15)
- Middleware RequireRole("moderator", "superadmin") + RequireRegion()

### Egreso de calibración (US-028)
- Post-sellado: verificar validated_match_count de cada jugador
- Si llega a 3 y status = 'calibration' → cambiar a 'active'
- El jugador aparece en ranking global

### Historial de partidos (US-029)
- `GET /players/{id}/matches?limit=10&page=1`
- Solo partidos sellados
- Incluye: fecha, resultado, equipos, delta ELO
- Paginación con offset

## Capabilities

### New
- Ciclo de vida completo de partidos (FSM de 4 estados)
- Validación cruzada con ventana temporal de 6h
- Job de auto-sellado con goroutine
- Resolución de disputas por Moderador
- Egreso automático de calibración
- Historial de partidos paginado
- 4 tablas: matches, match_players, match_results, disputes
- 9 endpoints HTTP nuevos

### Modified
- `users.validated_match_count` — incrementado al sellar partido
- `users.status` — cambia de 'calibration' a 'active' al 3er partido
- `users.elo` — actualizado via ApplyELO (EPIC 03)
- `users.trust_score` — actualizado via Trust service (EPIC 03)

## Impact

- **Scope**: Backend Go, dominio `internal/match/`. Consume `internal/ranking/` y `internal/trust/`.
- **Risk**: Alto. Es el flujo central del producto. FSM de estados + concurrencia (auto-sealer goroutine). TDD para validación cruzada y FSM.
- **Bloqueante**: EPICs 05-08 (las 4 tabs) consumen datos de partidos. EPIC 09 (Admin) consume disputas.
- **Primera EPIC testeable end-to-end con curl**: crear → cargar → confirmar → ver ELO actualizado.
