# Proposal: EPIC 03 — Motor ELO y Trust Score

## Why

Esta es la EPIC más importante del proyecto. El Motor ELO y el Trust Score son la razón por la que BlendPadel existe. Sin esto, es una agenda de turnos más.

El ELO adaptado para pádel resuelve el problema del "falso 5ta": si mentiste en el onboarding y te toca jugar contra alguien de verdad, el K=60 de calibración te baja 60 puntos de un saque. En 3 partidos el sistema sabe quién sos realmente.

El Trust Score es el sistema inmunológico: los que cancelan a último momento, los que disputan resultados por deporte, los que se portan mal — se hunden solos. Y cuando bajan de 70, los jugadores serios dejan de verlos.

**TDD ESTRICTO**: todo test se escribe ANTES del código. No es negociable para este dominio.

## What Changes

### Cálculo de probabilidad esperada E (US-016)
- Función pura `CalcExpected(eloOwn, eloRival float64) float64`
- Fórmula: `1 / (1 + 10^((eloRival - eloOwn) / 400))`
- ELO de equipo = promedio de los 2 jugadores
- Propiedad: E_A + E_B = 1.0 siempre

### Multiplicador por margen de victoria M (US-017)
- Función pura `CalcMarginMultiplier(gamesWon, gamesLost int) float64`
- Diferencia ≤2 games → 1.0, 3-4 → 1.2, ≥5 → 1.5
- Calculado sobre total de games en todos los sets

### Cálculo y aplicación del ELO post-partido (US-018)
- `ApplyELO(matchID)` — transacción DB: update 4 jugadores + insert 4 elo_history
- K=60 para primeros 5 partidos (calibración), K=20 después
- No actualiza jugadores con ELO freeze activo
- Tablas: `elo_history` con elo_before, elo_after, delta, k_factor, type

### Trust Score — penalización por cancelación tardía (US-019)
- Cancelación <2h antes del partido: -10 Trust
- Mínimo absoluto: 0 (no puede ser negativo)
- Registrado en `trust_events` con tipo `late_cancellation`

### Trust Score — penalización por disputa (US-020)
- Primera disputa en 30 días: -5 Trust
- Segunda disputa en 30 días (sistemática): -20 Trust + ELO freeze
- Reporte de conducta validado por Moderador: -15 Trust
- Evento `trust_threshold_crossed` cuando cruza el umbral de 70

### Trust Score — recuperación gradual (US-021)
- +2 por partido completado sin incidentes
- Cap mensual: máximo 10 puntos recuperados por mes calendario
- Máximo absoluto: 100

### Visibilidad condicionada por Trust Score (US-022)
- Trust < 70 → oculto del radar y matchmaking de jugadores con Trust ≥ 70
- Bidireccional: jugadores con bajo Trust ven a otros con bajo Trust
- Transparente: el jugador oculto NO sabe que está oculto

## Capabilities

### New
- Motor de cálculo ELO adaptado para pádel (funciones puras + service)
- Sistema de Trust Score con 3 tipos de penalización y recuperación
- Filtro de visibilidad bidireccional por Trust Score
- Tablas `elo_history` y `trust_events`
- Migración 000004_ranking_trust

### Modified
- Tabla `users`: usa campos existentes (elo, trust_score, elo_frozen, validated_match_count)

## Impact

- **Scope**: Backend Go, dominios `internal/ranking/` y `internal/trust/`
- **Risk**: Alto si la matemática está mal → rankings injustos, usuarios se van. Mitigado con TDD estricto.
- **Bloqueante**: EPIC 04 (Partidos) llama a ApplyELO cuando se sella un partido. EPIC 07 (Rankings) consume los datos de ELO.
