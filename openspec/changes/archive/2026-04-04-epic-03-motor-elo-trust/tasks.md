# Tasks: EPIC 03 — Motor ELO y Trust Score

> **TDD ESTRICTO**: Para cada función, escribir el test PRIMERO, verificar que FALLA, luego implementar.
> Cada task es atómico (5-30 min). Ejecutar en orden.

---

## 1. Migración y sqlc

- [x] 1.1 Crear `backend/migrations/000004_ranking_trust.up.sql`:
  ```sql
  CREATE TABLE elo_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID NOT NULL REFERENCES users(id),
      match_id UUID,
      elo_before INTEGER NOT NULL,
      elo_after INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      k_factor INTEGER NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'match_result',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_elo_history_player ON elo_history(player_id, created_at DESC);
  CREATE INDEX idx_elo_history_match ON elo_history(match_id);

  CREATE TABLE trust_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID NOT NULL REFERENCES users(id),
      event_type VARCHAR(30) NOT NULL,
      delta INTEGER NOT NULL,
      reference_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_trust_events_player ON trust_events(player_id, created_at DESC);
  CREATE INDEX idx_trust_events_type ON trust_events(player_id, event_type, created_at);
  ```
- [x] 1.2 Crear `backend/migrations/000004_ranking_trust.down.sql`
- [x] 1.3 Crear queries sqlc: `queries/elo_history.sql`
  - `InsertELOHistory` (INSERT player_id, match_id, elo_before, elo_after, delta, k_factor, type)
  - `GetELOHistory` (SELECT WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2)
  - `GetELOHistoryByMatch` (SELECT WHERE match_id = $1)
- [x] 1.4 Crear queries sqlc: `queries/trust_events.sql`
  - `InsertTrustEvent` (INSERT player_id, event_type, delta, reference_id)
  - `GetTrustEvents` (SELECT WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2)
  - `GetMonthlyRecoverySum` (SELECT COALESCE(SUM(delta), 0) WHERE player_id = $1 AND event_type = 'match_completed' AND created_at >= date_trunc('month', NOW()))
  - `CountRecentDisputes` (SELECT COUNT(*) WHERE player_id = $1 AND event_type IN ('dispute', 'systematic_dispute') AND created_at >= NOW() - INTERVAL '30 days')
- [x] 1.5 Crear queries sqlc adicionales para users: `queries/users_ranking.sql`
  - `GetPlayerELO` (SELECT id, elo, validated_match_count, elo_frozen FROM users WHERE id = $1)
  - `UpdatePlayerELOAndCount` (UPDATE elo = $2, validated_match_count = validated_match_count + 1 WHERE id = $1)
  - `FreezePlayerELO` (UPDATE elo_frozen = true WHERE id = $1)
  - `UnfreezePlayerELO` (UPDATE elo_frozen = false WHERE id = $1)
  - `UpdateTrustScore` (UPDATE trust_score = $2 WHERE id = $1)
  - `GetPlayerTrustScore` (SELECT id, trust_score FROM users WHERE id = $1)
- [x] 1.6 Ejecutar `sqlc generate` y verificar
- [x] 1.7 Aplicar migración al Docker postgres

## 2. ELO — funciones puras (TDD)

### 2.1 CalcExpected — probabilidad esperada

- [x] 2.1.1 ESCRIBIR TEST `internal/ranking/elo_test.go` — TestCalcExpected:
  - ELOs iguales (1200 vs 1200) → E = 0.5
  - Superior (1400 vs 1000) → E ≈ 0.909
  - Inferior (1000 vs 1400) → E ≈ 0.091
  - E_A + E_B = 1.0 para 10 pares random
  - Extremo (2000 vs 800) → E cercano a 1.0
  - Mismo valor alto (2000 vs 2000) → E = 0.5
- [x] 2.1.2 VERIFICAR que el test FALLA (no existe la función)
- [x] 2.1.3 IMPLEMENTAR `CalcExpected` en `internal/ranking/elo.go`
- [x] 2.1.4 VERIFICAR que el test PASA

### 2.2 CalcMarginMultiplier — multiplicador por margen

- [x] 2.2.1 ESCRIBIR TEST — TestCalcMarginMultiplier:
  - 6-4, 6-4 (diff 4) → M = 1.2
  - 6-0, 6-0 (diff 12) → M = 1.5
  - 7-6, 6-7, 7-6 (diff 1) → M = 1.0
  - 6-4, 7-5 (diff 4) → M = 1.2
  - 6-1, 6-0 (diff 11) → M = 1.5
  - 7-6, 7-6 (diff 2) → M = 1.0
  - 6-3, 6-4 (diff 5) → M = 1.5
- [x] 2.2.2 VERIFICAR que el test FALLA
- [x] 2.2.3 IMPLEMENTAR `CalcMarginMultiplier`
- [x] 2.2.4 VERIFICAR que el test PASA

### 2.3 CalcNewELO — fórmula completa

- [x] 2.3.1 ESCRIBIR TEST — TestCalcNewELO:
  - Calibración (K=60): 1200 gana vs 1200, M=1.0 → delta +30
  - Calibración (K=60): 1200 pierde vs 1200, M=1.0 → delta -30
  - Recurrente (K=20): 1200 gana vs 1200, M=1.0 → delta +10
  - Upset: 1000 gana vs 1400, K=20, M=1.0 → delta grande (~+18)
  - Favored: 1400 gana vs 1000, K=20, M=1.0 → delta chico (~+2)
  - Con margen: 1200 gana vs 1200, M=1.5 → delta mayor que M=1.0
  - K-factor boundary: validated_match_count = 4 → K=60, count = 5 → K=20
- [x] 2.3.2 VERIFICAR que el test FALLA
- [x] 2.3.3 IMPLEMENTAR `CalcNewELO(currentELO, rivalELO int, won bool, matchCount int, marginMult float64) int`
- [x] 2.3.4 VERIFICAR que el test PASA

## 3. ELO — repository y service

- [x] 3.1 Crear `internal/ranking/model.go`:
  - `ELOResult` struct (PlayerID, OldELO, NewELO, Delta, KFactor)
  - `MatchELOInput` struct (MatchID, TeamAPlayerIDs, TeamBPlayerIDs, WinnerTeam, GamesWon, GamesLost)
- [x] 3.2 Crear `internal/ranking/repository.go` — interface:
  - `GetPlayerELO(ctx, playerID uuid.UUID) (elo int, matchCount int, frozen bool, error)`
  - `UpdatePlayerELO(ctx, playerID uuid.UUID, newELO int) error`
  - `InsertELOHistory(ctx, record ELOHistoryRecord) error`
  - `GetELOHistory(ctx, playerID uuid.UUID, limit int) ([]ELOHistoryRecord, error)`
- [x] 3.3 Crear `internal/ranking/postgres.go` — implementación con sqlc
- [x] 3.4 Crear `internal/ranking/service.go`:
  - `type Service struct` con repo
  - `ApplyELO(ctx, input MatchELOInput) ([]ELOResult, error)`:
    - Fetch ELO + matchCount + frozen para 4 jugadores
    - Calcular ELO promedio por equipo
    - CalcExpected para cada equipo
    - CalcMarginMultiplier con gamesWon/gamesLost
    - CalcNewELO para cada jugador (skip si frozen)
    - Transacción: update 4 players + insert 4 elo_history
    - Retornar 4 ELOResult

## 4. Trust Score — modelos y constantes

- [x] 4.1 Crear `internal/trust/model.go`:
  - Constantes: `ThresholdVisible = 70`, `PenaltyLateCancellation = -10`, `PenaltyFirstDispute = -5`, `PenaltySystematicDispute = -20`, `PenaltyConductReport = -15`, `RecoveryPerMatch = 2`, `RecoveryMonthlyCap = 10`, `MaxTrustScore = 100`, `MinTrustScore = 0`
  - Event types como constantes string
  - `TrustEvent` struct

## 5. Trust Score — service (TDD)

### 5.1 Penalización por cancelación tardía

- [x] 5.1.1 ESCRIBIR TEST — TestPenalizeLateCancellation:
  - Trust 80 → cancelación → Trust 70
  - Trust 5 → cancelación → Trust 0 (no negativo)
  - Trust 0 → cancelación → Trust 0
  - Evento registrado con type 'late_cancellation' y delta -10
- [x] 5.1.2 IMPLEMENTAR `PenalizeLateCancellation(ctx, playerID, matchID uuid.UUID) (newScore int, error)`

### 5.2 Penalización por disputa

- [x] 5.2.1 ESCRIBIR TEST — TestPenalizeDispute:
  - Primera disputa en 30 días → -5, no freeze
  - Segunda disputa en 30 días → -20, ELO freeze activado
  - Cruce de umbral 70 → evento trust_threshold_crossed
- [x] 5.2.2 IMPLEMENTAR `PenalizeDispute(ctx, playerID, matchID uuid.UUID) (newScore int, frozen bool, error)`

### 5.3 Penalización por reporte de conducta

- [x] 5.3.1 ESCRIBIR TEST — TestPenalizeConductReport:
  - Trust 80 → reporte → Trust 65
  - Cruce de umbral 70 detectado
- [x] 5.3.2 IMPLEMENTAR `PenalizeConductReport(ctx, playerID, reportID uuid.UUID) (newScore int, error)`

### 5.4 Recuperación gradual

- [x] 5.4.1 ESCRIBIR TEST — TestRecoverTrust:
  - Trust 65, 0 recuperado este mes → +2 → Trust 67
  - Trust 65, 8 ya recuperado este mes → +2 → Trust 67 (cap no alcanzado, 10 total)
  - Trust 65, 10 ya recuperado este mes → +0 (cap alcanzado)
  - Trust 99 → +2 → Trust 100 (cap absoluto)
  - Trust 100 → +0 (ya en máximo)
- [x] 5.4.2 IMPLEMENTAR `RecoverFromMatch(ctx, playerID, matchID uuid.UUID) (newScore int, recovered int, error)`

### 5.5 Filtro de visibilidad

- [x] 5.5.1 ESCRIBIR TEST — TestIsVisibleTo:
  - Viewer Trust 80, Target Trust 80 → visible
  - Viewer Trust 80, Target Trust 65 → NOT visible
  - Viewer Trust 65, Target Trust 65 → visible (ambos bajo umbral)
  - Viewer Trust 65, Target Trust 80 → visible (viewer bajo ve a todos)
  - Viewer Trust 70, Target Trust 70 → visible (exacto en umbral)
  - Viewer Trust 70, Target Trust 69 → NOT visible
- [x] 5.5.2 IMPLEMENTAR `IsVisibleTo(viewerTrust, targetTrust int) bool` — función pura

## 6. Trust Score — repository y postgres

- [x] 6.1 Crear `internal/trust/repository.go` — interface:
  - `GetTrustScore(ctx, playerID uuid.UUID) (int, error)`
  - `UpdateTrustScore(ctx, playerID uuid.UUID, newScore int) error`
  - `InsertTrustEvent(ctx, event TrustEvent) error`
  - `GetMonthlyRecovery(ctx, playerID uuid.UUID) (int, error)`
  - `CountRecentDisputes(ctx, playerID uuid.UUID) (int, error)`
  - `FreezeELO(ctx, playerID uuid.UUID) error`
- [x] 6.2 Crear `internal/trust/postgres.go` — implementación con sqlc

## 7. Tests de integración

- [x] 7.1 Crear `internal/ranking/integration_test.go` con Testcontainers:
  - Test: ApplyELO con 4 jugadores — ELOs actualizados correctamente
  - Test: ApplyELO con jugador en freeze — ese jugador no se actualiza
  - Test: ApplyELO con jugador en calibración (K=60) — delta mayor
  - Test: elo_history registrado para cada jugador
- [x] 7.2 Crear `internal/trust/integration_test.go` con Testcontainers:
  - Test: penalización + recuperación + cap mensual
  - Test: disputa sistemática → freeze
  - Test: trust_events registrados correctamente

## 8. Verificación final

- [x] 8.1 `go build ./...` compila
- [x] 8.2 `go test ./...` pasa (auth + player + ranking + trust)
- [x] 8.3 `sqlc generate` sin errores
- [x] 8.4 Docker compose rebuild y verificar migración aplica
