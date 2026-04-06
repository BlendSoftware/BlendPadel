# Design: EPIC 04 — Partidos y Validación Cruzada

## Context

EPICs 00-03 completadas. Backend con auth, player profiles, motor ELO (funciones puras + service) y Trust Score (penalizaciones + recuperación + visibilidad). Todo testeado. Docker corriendo.

Esta EPIC es la orquestación: el dominio match/ consume ranking/ y trust/ para aplicar ELO y Trust cuando un partido se sella.

## Goals

- Ciclo de vida completo: pending_result → awaiting_confirmation → sealed/disputed
- Validación cruzada con ventana de 6h
- Auto-sellado por goroutine
- ELO aplicado a 4 jugadores al sellar
- Trust Score actualizado (recuperación al completar, penalización al disputar)
- Egreso automático de calibración al 3er partido
- Disputas resolvibles por Moderador
- Historial de partidos consultable

## Non-Goals

- Push notifications reales (EPIC 10) — acá solo emitimos eventos/logs
- Radar de partidos abiertos (EPIC 05)
- Matchmaking / flares (EPIC 06)
- UI de ningún tipo

## Decisions

### D1: FSM explícita con validación de transiciones
**Decisión**: Definir transiciones válidas como mapa estático. Cualquier transición no definida → error.
**Razón**: El estado del partido es crítico. No queremos que un partido `sealed` vuelva a `awaiting_confirmation` por un bug.
```
pending_result → awaiting_confirmation (solo via SubmitResult)
awaiting_confirmation → sealed (via Confirm o AutoSeal)
awaiting_confirmation → disputed (via Dispute)
disputed → sealed (via ModeratorResolve)
```

### D2: Auto-sealer como goroutine interna, no cron externo
**Decisión**: Goroutine con `time.NewTicker(5 * time.Minute)` iniciada en main.go, cancelable via context.
**Razón**: No agregar dependencias externas (cron, scheduler). Una goroutine Go es liviana, se cancela con el shutdown del server, y es testeable.
**Trade-off**: Si hay muchos partidos pendientes, el ticker de 5 min puede causar delay de hasta 5 min extra. Aceptable para MVP.

### D3: Orquestación de ELO + Trust en match/service, no en un orchestrator separado
**Decisión**: `match.Service.sealMatch()` llama a `ranking.Service.ApplyELO()` y `trust.Service.RecoverFromMatch()` directamente.
**Razón**: La orquestación es simple (2 calls secuenciales). No amerita un mediator o event bus para MVP. Si crece, refactorizar a events.
**Trade-off**: match/ depende de ranking/ y trust/. Acoplamiento aceptable — estos 3 dominios son inherentemente acoplados por el evento "partido sellado".

### D4: Sets como JSONB, winner y game_diff calculados al cargar
**Decisión**: Los sets se almacenan como JSONB (flexible). winner_team, total_games_a, total_games_b y game_diff se calculan al momento de cargar y se guardan desnormalizados.
**Razón**: Evitar recalcular en cada lectura. Los sets son datos raw, los campos calculados son para queries rápidas.

### D5: Dispute como tabla separada, no como estado en matches
**Decisión**: Tabla `disputes` separada con referencia a match_id. El match tiene status `disputed` pero el detalle de la disputa (razón, resolución, penalización) vive en disputes.
**Razón**: Un match puede tener un solo dispute, pero el dispute tiene su propio ciclo de vida (pending → resolved) y campos propios. Mantenerlo separado es más limpio.

### D6: Egreso de calibración post-sellado, no como proceso separado
**Decisión**: Después de sellar un partido, verificar inline si algún jugador alcanzó 3 partidos validados y cambiar status.
**Razón**: Es una verificación simple (if count >= 3). No amerita un proceso separado. Se hace en la misma transacción que el sellado.

### D7: Historial con offset pagination, no cursor
**Decisión**: Paginación con `?limit=10&page=1` usando OFFSET/LIMIT en SQL.
**Razón**: El historial de un jugador es finito (~cientos de partidos máximo). Offset es simple y suficiente. Cursor pagination es para feeds infinitos.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Race condition: dos requests de confirm llegan simultáneamente | SELECT ... FOR UPDATE en el match antes de cambiar estado |
| Auto-sealer procesa partido que ya fue confirmado entre ticker ticks | Verificar estado dentro de transacción antes de sellar |
| ELO se aplica mal si el resultado tiene datos inválidos | Validar sets exhaustivamente al cargar (antes de guardar) |
| Moderador resuelve disputa que ya fue resuelta | Check status = 'pending' en transacción |

## Migration Plan

### Migración 000005_matches.up.sql
```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_result',
    scheduled_at TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(Point, 4326),
    captain_a_id UUID NOT NULL REFERENCES users(id),
    captain_b_id UUID NOT NULL REFERENCES users(id),
    avg_elo INTEGER,
    sealed_by VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_location ON matches USING GIST(location);
CREATE INDEX idx_matches_scheduled ON matches(scheduled_at);

CREATE TABLE match_players (
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES users(id),
    team CHAR(1) NOT NULL CHECK (team IN ('A', 'B')),
    PRIMARY KEY (match_id, player_id)
);
CREATE INDEX idx_match_players_player ON match_players(player_id);

CREATE TABLE match_results (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    sets JSONB NOT NULL,
    winner_team CHAR(1) NOT NULL CHECK (winner_team IN ('A', 'B')),
    total_games_a INTEGER NOT NULL,
    total_games_b INTEGER NOT NULL,
    game_diff INTEGER NOT NULL,
    submitted_by UUID NOT NULL REFERENCES users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id),
    raised_by UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolution_result JSONB,
    penalized_player_id UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_match ON disputes(match_id);
```

## Open Questions

Ninguna.
