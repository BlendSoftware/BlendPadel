# EPIC 04 — Partidos y Validación Cruzada

> **Sprint**: 2
> **Prioridad**: Alta (CORE DOMAIN — TDD para validación cruzada)
> **Dependencias**: EPIC 02, EPIC 03
> **Historias**: US-023, US-024, US-025, US-026, US-027, US-028, US-029

---

## Objetivo

Implementar el ciclo de vida completo de un partido: creación, carga de resultado, validación cruzada (el Capitán B confirma o disputa), auto-sellado a las 6 horas, resolución de disputas por Moderador, egreso de calibración y consulta de historial. Este es el flujo central del producto.

## Contexto

La validación cruzada es el mecanismo anti-fraude principal de BlendPadel. Sin ella, cualquiera podría cargar resultados falsos. El flujo es: Capitán A carga → push a Capitán B → 6h para objetar → si no objeta, se sella y se aplica ELO.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| MA-01 | 4 jugadores: 2 equipos de 2. Un capitán por equipo. |
| MA-02 | Resultado en sets y games. Margen afecta multiplicador M. |
| MA-03 | Cross-validation: Capitán A carga → push a B → 6h ventana → auto-seal. |
| MA-04 | Disputa: ambos pierden Trust. Moderador de zona audita. |
| MA-05 | Disputa sistemática (≥2 en 30 días): freeze ELO ambos. |
| MA-06 | Partido puede ser "abierto" (buscando) o "cerrado" (4 confirmados). |
| MA-07 | Resultado en calibración solo afecta ELO cuando sellado. |
| PL-02 | Egreso calibración: 3 partidos validados → estado "active". |
| RK-04 | Ranking solo muestra jugadores con ≥3 partidos. |

## Historias de Usuario

### US-023: Crear partido
- `POST /matches` — 4 player_ids, coordenadas cancha, scheduled_at, my_team
- Creador = captain_a, primer jugador equipo B = captain_b
- Validar: no duplicados, todos existen
- Estado inicial: `pending_result`

### US-024: Cargar resultado de partido
- `POST /matches/{id}/result` — sets con games por equipo
- Solo el capitán puede cargar
- Cambiar estado a `awaiting_confirmation`
- Disparar evento para push notification a Capitán B

### US-025: Validación cruzada — confirmación/disputa por Capitán B
- `POST /matches/{id}/confirm` → `sealed` → disparar ApplyELO
- `POST /matches/{id}/dispute` → `disputed` → freeze ELO + Trust penalty
- Ventana: 6 horas desde carga del resultado

### US-026: Auto-sellado sin objeción (6h)
- Job con goroutine ticker cada 5 minutos
- Query: `WHERE status = 'awaiting_confirmation' AND result_submitted_at < now() - 6h`
- Para cada partido: cambiar a `sealed` + ApplyELO
- Registrar `sealed_by: "auto"`

### US-027: Resolución de disputa por Moderador
- `GET /admin/disputes` — lista disputas de su región
- `POST /admin/disputes/{id}/resolve` — resultado correcto + penalización opcional
- Desfreeze ELO, aplicar resultado auditado, penalizar Trust si corresponde
- Middleware `RequireRegion()` aplicado

### US-028: Egreso del estado de calibración
- Al sellar partido: contar validated_match_count del jugador
- Si llega a 3 y status = 'calibration' → cambiar a 'active'
- Emitir evento para push notification

### US-029: Historial de partidos
- `GET /players/{id}/matches?limit=10&page=1`
- JOIN matches + match_players + match_results + elo_history
- Solo partidos `sealed`

## Enfoque Técnico

### Estados del Partido (FSM)
```
pending_result → awaiting_confirmation → sealed
                                       → disputed → sealed (post-moderación)
```

### Tablas (migración)
```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_result',
    -- pending_result | awaiting_confirmation | sealed | disputed
    scheduled_at TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(Point, 4326),
    captain_a_id UUID NOT NULL REFERENCES users(id),
    captain_b_id UUID NOT NULL REFERENCES users(id),
    avg_elo INTEGER,
    sealed_by VARCHAR(20), -- captain_b | auto | moderator
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_location ON matches USING GIST(location);
CREATE INDEX idx_matches_scheduled ON matches(scheduled_at);

CREATE TABLE match_players (
    match_id UUID NOT NULL REFERENCES matches(id),
    player_id UUID NOT NULL REFERENCES users(id),
    team CHAR(1) NOT NULL, -- A o B
    PRIMARY KEY (match_id, player_id)
);

CREATE TABLE match_results (
    match_id UUID PRIMARY KEY REFERENCES matches(id),
    sets JSONB NOT NULL, -- [{team_a: 6, team_b: 4}, {team_a: 7, team_b: 5}]
    winner_team CHAR(1) NOT NULL, -- A o B
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
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | resolved
    resolved_by UUID REFERENCES users(id),
    resolution_result JSONB,
    penalized_player_id UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_disputes_status ON disputes(status);
```

### Estructura del dominio match/
```
internal/match/
├── handler.go      # CreateMatch, SubmitResult, Confirm, Dispute, GetHistory
├── service.go      # Lógica de negocio, FSM de estados
├── sealer.go       # Job de auto-sellado (goroutine)
├── repository.go   # Interface
├── postgres.go     # Implementación
└── model.go        # DTOs, Match states enum
```

## Testing

- **TDD estricto para**: validación cruzada (flujo confirm/dispute), auto-sellado, FSM de estados
- **Tests de integración**: flow completo crear → cargar → confirmar → ELO aplicado
- **Tests unitarios**: validación de sets, cálculo de game_diff, FSM transitions

## Definition of Done

- [ ] Crear partido con 4 jugadores funciona
- [ ] Cargar resultado valida formato de sets
- [ ] Confirm sella partido y dispara ApplyELO
- [ ] Dispute congela ELO y penaliza Trust
- [ ] Auto-sellado funciona después de 6h
- [ ] Moderador puede resolver disputas de su región
- [ ] Egreso calibración a 3 partidos funciona
- [ ] Historial paginado funciona
- [ ] Tests de integración pasan con Testcontainers
