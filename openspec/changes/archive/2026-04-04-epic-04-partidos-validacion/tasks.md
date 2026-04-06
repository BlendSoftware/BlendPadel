# Tasks: EPIC 04 — Partidos y Validación Cruzada

> TDD parcial: tests ANTES del código para FSM, validación cruzada y auto-sealer.
> Cada task es atómico (5-30 min). Ejecutar en orden.

---

## 1. Migración y sqlc

- [x] 1.1 Crear `backend/migrations/000005_matches.up.sql` con las 4 tablas: matches, match_players, match_results, disputes (ver design.md para el SQL completo)
- [x] 1.2 Crear `backend/migrations/000005_matches.down.sql`
- [x] 1.3 Crear queries sqlc: `queries/matches.sql`
  - `CreateMatch` (INSERT matches → RETURNING *)
  - `GetMatchByID` (SELECT * WHERE id = $1)
  - `UpdateMatchStatus` (UPDATE status, sealed_by, updated_at WHERE id = $1)
  - `GetMatchesAwaitingConfirmation` (SELECT WHERE status = 'awaiting_confirmation' AND result submitted_at + 6h < NOW()) — para auto-sealer
  - `GetMatchesByPlayer` (SELECT matches JOIN match_players WHERE player_id = $1 AND status = 'sealed' ORDER BY created_at DESC LIMIT $2 OFFSET $3)
- [x] 1.4 Crear queries sqlc: `queries/match_players.sql`
  - `InsertMatchPlayer` (INSERT match_id, player_id, team)
  - `GetMatchPlayers` (SELECT WHERE match_id = $1)
  - `GetMatchPlayersByTeam` (SELECT WHERE match_id = $1 AND team = $2)
- [x] 1.5 Crear queries sqlc: `queries/match_results.sql`
  - `InsertMatchResult` (INSERT match_id, sets, winner_team, total_games_a, total_games_b, game_diff, submitted_by)
  - `GetMatchResult` (SELECT WHERE match_id = $1)
- [x] 1.6 Crear queries sqlc: `queries/disputes.sql`
  - `CreateDispute` (INSERT match_id, raised_by, reason → RETURNING *)
  - `GetDisputeByMatch` (SELECT WHERE match_id = $1)
  - `GetDisputesByStatus` (SELECT WHERE status = $1 ORDER BY created_at ASC)
  - `GetDisputeByID` (SELECT WHERE id = $1)
  - `ResolveDispute` (UPDATE resolved_by, resolution_result, penalized_player_id, resolved_at, status = 'resolved' WHERE id = $1)
- [x] 1.7 Ejecutar `sqlc generate` y verificar
- [x] 1.8 Aplicar migración al Docker postgres

## 2. Modelos y FSM

- [x] 2.1 Crear `internal/match/model.go`:
  - Match status constants: `StatusPendingResult`, `StatusAwaitingConfirmation`, `StatusSealed`, `StatusDisputed`
  - `CreateMatchRequest` — TeamA []UUID, TeamB []UUID, ScheduledAt, Latitude, Longitude
  - `SubmitResultRequest` — Sets []SetScore (TeamAGames, TeamBGames int)
  - `SetScore` struct
  - `DisputeRequest` — Reason string
  - `ResolveDisputeRequest` — ResultOverride *SubmitResultRequest, PenalizePlayerID *UUID
  - `MatchResponse`, `MatchHistoryItem` DTOs
- [x] 2.2 Crear `internal/match/fsm.go` — TDD:
  - `ValidTransition(from, to string) bool`
  - Mapa de transiciones válidas:
    - pending_result → awaiting_confirmation
    - awaiting_confirmation → sealed
    - awaiting_confirmation → disputed
    - disputed → sealed
  - Cualquier otra → false
- [x] 2.3 Escribir test `fsm_test.go` PRIMERO — verificar todas las transiciones válidas e inválidas

## 3. Validación de sets

- [x] 3.1 Crear `internal/match/validation.go` — TDD:
  - `ValidateSets(sets []SetScore) error` — min 2 sets, max 3, games ≥ 0, lógica de pádel
  - `CalculateResult(sets []SetScore) (winnerTeam string, totalA, totalB, gameDiff int)`
  - Reglas: un equipo debe ganar más sets que el otro, games válidos (0-7 range)
- [x] 3.2 Escribir test `validation_test.go` PRIMERO:
  - 6-4, 7-5 → winner A, total 13-9, diff 4
  - 6-0, 6-0 → winner A, total 12-0, diff 12
  - 4-6, 5-7 → winner B, total 9-13, diff 4
  - 6-4, 4-6, 7-5 → winner A (3 sets), diff 4
  - Sets inválidos: games negativo → error
  - Sets inválidos: ambos equipos ganan misma cantidad de sets → error
  - Sets inválidos: 1 solo set → error
  - Sets inválidos: 4 sets → error

## 4. Repository

- [x] 4.1 Crear `internal/match/repository.go` — interface:
  - `CreateMatch(ctx, match) (*Match, error)`
  - `GetMatch(ctx, matchID uuid.UUID) (*Match, error)`
  - `GetMatchWithPlayers(ctx, matchID uuid.UUID) (*MatchFull, error)`
  - `InsertMatchPlayers(ctx, matchID uuid.UUID, teamA, teamB []uuid.UUID) error`
  - `InsertResult(ctx, matchID uuid.UUID, result MatchResult) error`
  - `UpdateStatus(ctx, matchID uuid.UUID, status, sealedBy string) error`
  - `GetPendingSealMatches(ctx) ([]MatchFull, error)` — para auto-sealer
  - `GetMatchHistory(ctx, playerID uuid.UUID, limit, offset int) ([]MatchHistoryItem, error)`
  - `CreateDispute(ctx, matchID, raisedBy uuid.UUID, reason string) (*Dispute, error)`
  - `GetDispute(ctx, disputeID uuid.UUID) (*Dispute, error)`
  - `GetDisputesByStatus(ctx, status string) ([]Dispute, error)`
  - `ResolveDispute(ctx, disputeID uuid.UUID, resolvedBy uuid.UUID, result JSONB, penalizedID *uuid.UUID) error`
- [x] 4.2 Crear `internal/match/postgres.go` — implementación con sqlc

## 5. Service — crear partido

- [x] 5.1 Crear `internal/match/service.go`:
  - `type Service struct` con matchRepo, rankingService, trustService
  - `CreateMatch(ctx, creatorID uuid.UUID, req CreateMatchRequest) (*MatchResponse, error)`:
    - Validar 4 jugadores únicos
    - Validar creador es parte del partido
    - Verificar jugadores existen en DB
    - Asignar captain_a (creador) y captain_b (primer jugador equipo B)
    - Calcular avg_elo del partido
    - Insertar match + match_players
    - Retornar MatchResponse

## 6. Service — cargar resultado

- [x] 6.1 Implementar `SubmitResult(ctx, matchID, submitterID uuid.UUID, req SubmitResultRequest) error`:
  - Verificar match existe y status = 'pending_result'
  - Verificar submitter es captain_a o captain_b
  - Validar sets con ValidateSets
  - Calcular resultado con CalculateResult
  - Insertar match_result
  - Transición FSM → awaiting_confirmation
  - Log: "resultado pendiente de validación por Capitán B"

## 7. Service — validación cruzada (TDD)

- [x] 7.1 ESCRIBIR TEST — TestConfirmMatch:
  - Capitán B confirma → estado sealed, ELO aplicado, Trust recuperado
  - Capitán A intenta confirmar (no es B) → error forbidden
  - Partido no en awaiting_confirmation → error invalid state
  - Confirm después de 6h → error window closed
- [x] 7.2 Implementar `ConfirmMatch(ctx, matchID, confirmerID uuid.UUID) error`:
  - Verificar status = awaiting_confirmation
  - Verificar confirmer es captain_b
  - Verificar dentro de ventana 6h
  - Transición → sealed, sealed_by = "captain_b"
  - Llamar sealMatch() helper
- [x] 7.3 ESCRIBIR TEST — TestDisputeMatch:
  - Capitán B disputa → estado disputed, Trust penalizado, dispute creado
  - Disputa fuera de ventana 6h → error
- [x] 7.4 Implementar `DisputeMatch(ctx, matchID, disputerID uuid.UUID, req DisputeRequest) error`:
  - Verificar status = awaiting_confirmation
  - Verificar disputer es captain_b
  - Verificar dentro de ventana 6h
  - Transición → disputed
  - Crear dispute en DB
  - Llamar trust.PenalizeDispute para ambos capitanes

## 8. Service — sealMatch helper (orquestación)

- [x] 8.1 Implementar `sealMatch(ctx, matchID uuid.UUID) error` — helper interno:
  - Fetch match con players y result
  - Construir MatchELOInput para ranking.ApplyELO
  - Llamar ranking.ApplyELO → actualiza ELO de 4 jugadores
  - Llamar trust.RecoverFromMatch para cada jugador (4 calls)
  - Llamar checkCalibrationEgress para cada jugador
- [x] 8.2 Implementar `checkCalibrationEgress(ctx, playerID uuid.UUID) error`:
  - Fetch player
  - Si validated_match_count >= 3 Y status = 'calibration' → UPDATE status = 'active'

## 9. Auto-sealer (goroutine)

- [x] 9.1 Crear `internal/match/sealer.go`:
  - `type AutoSealer struct` con service, interval
  - `NewAutoSealer(svc *Service, interval time.Duration) *AutoSealer`
  - `Start(ctx context.Context)` — goroutine con ticker
  - Cada tick: query partidos awaiting_confirmation con result > 6h, sellar cada uno
  - Log cada auto-sellado
  - Parar cuando ctx se cancela
- [x] 9.2 ESCRIBIR TEST — TestAutoSealer (con mock o Testcontainers):
  - Crear partido awaiting_confirmation con result_submitted_at > 6h ago
  - Ejecutar un tick del sealer
  - Verificar partido ahora está sealed con sealed_by = "auto"

## 10. Service — resolución de disputas (Moderador)

- [x] 10.1 Implementar `GetPendingDisputes(ctx, regionID *uuid.UUID) ([]Dispute, error)`:
  - Si regionID != nil → filtrar por región del match
  - Solo disputes con status 'pending'
- [x] 10.2 Implementar `ResolveDispute(ctx, disputeID, moderatorID uuid.UUID, req ResolveDisputeRequest) error`:
  - Verificar dispute existe y status = 'pending'
  - Si hay resultado override → recalcular winner/games
  - Marcar dispute como resolved
  - Desfreeze ELO de ambos jugadores
  - Llamar sealMatch() con el resultado (original o override)
  - Si penalizePlayerID → llamar trust.PenalizeConductReport

## 11. Handlers HTTP

- [x] 11.1 Crear `internal/match/handler.go`:
  - `CreateMatch(w, r)` — POST /matches
  - `SubmitResult(w, r)` — POST /matches/{id}/result
  - `ConfirmMatch(w, r)` — POST /matches/{id}/confirm
  - `DisputeMatch(w, r)` — POST /matches/{id}/dispute
  - `GetMatchHistory(w, r)` — GET /players/{id}/matches
  - `GetPendingDisputes(w, r)` — GET /admin/disputes
  - `ResolveDispute(w, r)` — POST /admin/disputes/{id}/resolve
  - Todos con RFC 7807 error mapping
- [x] 11.2 Crear `internal/match/routes.go`:
  ```
  POST /matches                         (autenticado)
  POST /matches/{id}/result             (autenticado)
  POST /matches/{id}/confirm            (autenticado)
  POST /matches/{id}/dispute            (autenticado)
  GET  /players/{playerID}/matches      (autenticado)
  GET  /admin/disputes                  (moderator/superadmin)
  POST /admin/disputes/{id}/resolve     (moderator/superadmin)
  ```

## 12. Integración con main.go

- [x] 12.1 Registrar rutas de match en main.go:
  - Crear matchRepo, matchService (inyectar rankingService + trustService), matchHandler
  - Montar rutas con auth middleware
  - Admin routes con RequireRole("moderator", "superadmin")
- [x] 12.2 Iniciar AutoSealer goroutine en main.go:
  - `sealer := match.NewAutoSealer(matchService, 5*time.Minute)`
  - `go sealer.Start(ctx)` — ctx del server para graceful shutdown

## 13. Tests de integración

- [x] 13.1 Crear `internal/match/integration_test.go` con Testcontainers:
  - Test flow completo: register 4 users → onboard → create match → submit result → confirm → verify ELO changed
  - Test: submit result por no-capitán → 403
  - Test: confirm por capitán A (no B) → 403
  - Test: dispute → match disputed, Trust penalized
  - Test: resolve dispute por moderator → match sealed, ELO applied
  - Test: get match history → returns sealed matches with delta ELO
  - Test: calibration egress → 3er partido sella → status changes to active
- [x] 13.2 Ejecutar `go test ./internal/match/... -v` — todo pasa

## 14. Verificación final

- [x] 14.1 `go build ./...` compila
- [x] 14.2 `go test ./...` pasa (auth + player + ranking + trust + match)
- [x] 14.3 `sqlc generate` sin errores
- [ ] 14.4 Docker compose rebuild + test manual end-to-end:
  - Registrar 4 usuarios, onboard todos, login
  - POST /matches con los 4
  - POST /matches/{id}/result con sets
  - POST /matches/{id}/confirm como capitán B
  - GET /players/me → verificar ELO cambió
  - GET /players/{id}/matches → historial con delta
