# Design: EPIC 03 — Motor ELO y Trust Score

## Context

EPICs 00-02 completadas. Backend Go con auth, RBAC, onboarding, perfiles con ELO inicial asignado. Docker corriendo. Tabla `users` tiene: elo, trust_score, elo_frozen, validated_match_count.

Esta EPIC implementa las funciones de cálculo puro (sin DB) y los services que las aplican en transacciones DB. TDD estricto: tests ANTES del código.

## Goals

- Funciones puras de ELO matemáticamente correctas y exhaustivamente testeadas
- Service que aplica ELO a 4 jugadores en transacción atómica
- Trust Score con 3 penalizaciones, recuperación con cap mensual, y filtro de visibilidad
- Todo testeable sin dependencias externas (funciones puras) + integración con Testcontainers

## Non-Goals

- Endpoints HTTP para ELO/Trust (se consumen internamente por EPIC 04 — Partidos)
- Endpoint de ranking/leaderboard (EPIC 07)
- UI de Trust Score (EPIC 08 — Perfil)
- Cron job de auto-sellado que dispara ApplyELO (EPIC 04)

## Decisions

### D1: Dos dominios separados — ranking/ y trust/
**Decisión**: ELO y Trust Score son dominios separados, no un solo paquete.
**Razón**: Responsabilidades distintas. El ELO es matemática pura + historial. El Trust es sistema de reputación con reglas de negocio propias. Se acoplan solo en el punto donde "partido completado" afecta ambos.
**Trade-off**: El service de partidos (EPIC 04) va a llamar a ambos. Esa orquestación vive en match/service.go, no acá.

### D2: ELO como int * 100 internamente, float solo en cálculo
**Decisión**: ELO se almacena como INTEGER en DB (ya está así). Los cálculos intermedios usan float64. El resultado se redondea a int con `math.Round`.
**Razón**: Evitar problemas de precisión de float en DB. Un ELO de 1234 significa 1234 puntos. Simple.

### D3: Trust Score desnormalizado en users + event log
**Decisión**: `users.trust_score` es el valor actual (desnormalizado). `trust_events` es el log de cambios.
**Razón**: Leer el Trust Score es una operación muy frecuente (cada query de radar/matchmaking filtra por Trust). Calcularlo como SUM de eventos sería O(n) por lectura. Mantener el valor desnormalizado es O(1).
**Trade-off**: Riesgo de inconsistencia si alguien modifica trust_score sin crear evento. Mitigamos: el service SIEMPRE crea evento + actualiza users en la misma transacción.

### D4: ApplyELO recibe matchID, no los datos del partido
**Decisión**: `ApplyELO(ctx, matchID)` busca todo en DB (jugadores, resultado, teams).
**Razón**: Garantiza consistencia. No depende de datos pasados por el caller que podrían estar stale. El service es la fuente de verdad.
**Trade-off**: Una query más. Aceptable por consistencia.

### D5: Trust visibility como cláusula WHERE, no como middleware
**Decisión**: El filtro de visibilidad (Trust ≥ 70) se implementa como cláusula WHERE en las queries de radar y matchmaking, no como middleware HTTP.
**Razón**: Es un filtro de datos, no de acceso. El jugador con Trust bajo SÍ puede acceder al radar — simplemente ve menos resultados. Un middleware bloquearía el endpoint entero.

### D6: Cap mensual de recuperación calculado en query
**Decisión**: Para verificar el cap de +10/mes, hacer `SELECT COALESCE(SUM(delta), 0) FROM trust_events WHERE player_id = $1 AND event_type = 'match_completed' AND created_at >= date_trunc('month', NOW())`.
**Razón**: Exacto, sin estado extra. El costo de la query es mínimo porque tiene índice en (player_id, created_at).

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Fórmula ELO incorrecta → rankings injustos | TDD con casos conocidos de ELO chess. Validar E_A + E_B = 1.0 en tests. |
| Trust Score baja demasiado rápido → jugadores abandonan | Los valores (-10, -15, -20) son configurables. Monitorear y ajustar post-launch. |
| Race condition en ApplyELO (dos partidos se sellan simultáneamente) | Transacción con `SELECT ... FOR UPDATE` en los jugadores. |

## Migration Plan

### Migración 000004_ranking_trust.up.sql
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

## Open Questions

Ninguna.
