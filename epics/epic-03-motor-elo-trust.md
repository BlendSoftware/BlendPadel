# EPIC 03 — Motor ELO y Trust Score

> **Sprint**: 2
> **Prioridad**: Alta (CORE DOMAIN — TDD ESTRICTO)
> **Dependencias**: EPIC 02
> **Historias**: US-016, US-017, US-018, US-019, US-020, US-021, US-022

---

## Objetivo

Implementar el corazón matemático de BlendPadel: el cálculo de ELO adaptado para pádel y el sistema de Trust Score con penalizaciones y recuperación. Este es el CORE DOMAIN del producto — todo test se escribe ANTES del código (TDD estricto).

## Contexto

Este motor es lo que diferencia a BlendPadel de un simple anotador de partidos. La fórmula ELO castiga la mentira y premia la paliza. El Trust Score es el sistema inmunológico de la comunidad: los tóxicos se hunden solos.

**IMPORTANTE**: TDD ESTRICTO para todo este dominio. Tests PRIMERO, código DESPUÉS.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| RK-01 | `ELO_new = ELO_current + K * (R - E) * M`. K=60 primeros 5 partidos, K=20 después. |
| RK-02 | `E = 1 / (1 + 10^((ELO_rival - ELO_propio) / 400))`. Promedio de equipo. |
| RK-03 | M: ≤2 games diff → 1.0, 3-4 → 1.2, ≥5 → 1.5 |
| RK-04 | Ranking global solo muestra jugadores con ≥3 partidos validados. |
| TR-01 | Trust Score inicial: 80/100 |
| TR-02 | Cancelación <2h: -10 puntos |
| TR-03 | Reporte validado por Moderador: -15 puntos |
| TR-04 | Disputa sistemática (2da en 30 días): -20 puntos ambos jugadores |
| TR-05 | Trust < 70: oculto del radar de jugadores serios |
| TR-06 | Recuperación: +2/partido completado, cap 10 pts/mes |

## Historias de Usuario

### US-016: Cálculo de probabilidad esperada E
- Función pura: `CalcExpected(eloOwn, eloRival float64) float64`
- ELO equipo = promedio de los 2 jugadores
- E_A + E_B = 1.0 siempre
- **TDD**: tabla de casos exhaustiva

### US-017: Cálculo del multiplicador por margen M
- Función pura: `CalcMarginMultiplier(gamesWon, gamesLost int) float64`
- Diferencia total de games sobre todos los sets
- **TDD**: tabla de casos con partidos reales

### US-018: Cálculo y aplicación del ELO post-partido
- `ApplyELO(matchID uuid.UUID)` — transacción: update players.elo + insert elo_history
- K=60 para primeros 5 partidos, K=20 después
- No actualizar si jugador está en freeze
- **TDD**: casos de calibración vs recurrente, freeze, etc.

### US-019: Trust Score — penalización por cancelación tardía
- Cancelación <2h: Trust Score -10
- Mínimo 0, no puede ser negativo
- Registrar en `trust_events`

### US-020: Trust Score — penalización por disputa
- Primera disputa en 30 días: -5
- Segunda disputa en 30 días (sistemática): -20 + ELO freeze
- Reporte validado: -15
- Emitir `trust_threshold_crossed` si cae bajo 70

### US-021: Recuperación gradual del Trust Score
- +2 por partido completado sin incidentes
- Cap: 10 puntos/mes calendario
- Máximo absoluto: 100

### US-022: Visibilidad condicionada por Trust Score
- Trust < 70: oculto para jugadores con Trust ≥ 70
- Bidireccional: jugadores con bajo Trust ven a otros con bajo Trust
- El jugador oculto NO sabe que está oculto

## Enfoque Técnico

### Fórmula ELO Completa
```
ELO_new = ELO_current + K * (R - E) * M

Donde:
- K = 60 si validated_match_count < 5, sino 20
- R = 1 (victoria), 0 (derrota)
- E = 1 / (1 + 10^((ELO_rival_avg - ELO_own_avg) / 400))
- M = 1.0 si |game_diff| ≤ 2, 1.2 si 3-4, 1.5 si ≥ 5
- game_diff = sum(games_won) - sum(games_lost) sobre todos los sets
```

### Tablas (migración)
```sql
CREATE TABLE elo_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    match_id UUID, -- NULL para manual_adjustment
    elo_before INTEGER NOT NULL,
    elo_after INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    k_factor INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'match_result', -- match_result | manual_adjustment
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_elo_history_player ON elo_history(player_id, created_at DESC);

CREATE TABLE trust_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL, -- late_cancellation | dispute | systematic_dispute | conduct_report | match_completed
    delta INTEGER NOT NULL,
    reference_id UUID, -- match_id o dispute_id
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trust_events_player ON trust_events(player_id, created_at DESC);
```

### Estructura del dominio
```
internal/ranking/
├── elo.go           # Funciones puras: CalcExpected, CalcMargin, CalcNewELO
├── elo_test.go      # TDD: tabla de casos exhaustiva
├── service.go       # ApplyELO: transacción DB
├── service_test.go  # Tests de integración con Testcontainers
├── repository.go    # Interface
└── postgres.go      # Implementación

internal/trust/
├── model.go         # TrustEvent, constantes (thresholds, deltas)
├── service.go       # Penalizar, Recuperar, CheckVisibility
├── service_test.go  # TDD: todos los escenarios
├── repository.go    # Interface
└── postgres.go      # Implementación
```

## Testing (TDD ESTRICTO)

### Tests que van PRIMERO (antes del código):

1. **CalcExpected**: ELOs iguales → 0.5, 1400 vs 1000 → ~0.91, suma siempre 1.0
2. **CalcMarginMultiplier**: 6-4/6-3 (diff 5) → 1.5, 7-6/6-5 (diff 2) → 1.0
3. **CalcNewELO**: integración completa con K=60 vs K=20
4. **Trust penalización**: cancelación <2h → -10, disputa sistemática → -20
5. **Trust recuperación**: +2/partido, cap 10/mes, max 100
6. **Trust visibilidad**: filtro bidireccional por threshold 70

## Definition of Done

- [ ] TODOS los tests escritos ANTES del código (TDD)
- [ ] CalcExpected pasa todos los casos de tabla
- [ ] CalcMarginMultiplier pasa todos los casos de tabla
- [ ] ApplyELO actualiza 4 jugadores en transacción
- [ ] K-factor correcto según validated_match_count
- [ ] Trust Score penaliza correctamente (3 tipos)
- [ ] Trust Score recupera con cap mensual
- [ ] Visibilidad filtrada por Trust threshold
- [ ] Tests de integración con Testcontainers pasan
