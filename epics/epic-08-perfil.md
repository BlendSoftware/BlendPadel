# EPIC 08 — Perfil (Tab 4)

> **Sprint**: 3
> **Prioridad**: Media
> **Dependencias**: EPIC 02, EPIC 04
> **Historias**: US-040, US-041, US-042

---

## Objetivo

Implementar el Tab 4 de la app: el perfil público de otros jugadores, las preferencias de matchmaking editables, y el sistema de reportes de mala conducta. Este tab es el "DNI Padelero" — la verdad absoluta de cada jugador.

## Contexto

El perfil público muestra la verdad del jugador sin filtros. Pero hay una diferencia clave: el Trust Score público se muestra como categoría (Excelente/Bueno/Bajo), no como número exacto, para no estigmatizar. El número exacto solo lo ve el propio jugador.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| PL-02 | Calibración: "En calibración" en vez de posición numérica |
| PL-05 | Trust < 70: oculto (soft) |
| PL-06 | Perfil público: rank, ELO, Trust icon, últimos partidos |
| AD-01 | Jugador con soft ban: invisible (HTTP 404) |
| TR-03 | Reporte validado: -15 Trust |

## Historias de Usuario

### US-040: Ver perfil público de otro jugador
- `GET /players/{id}` — nombre, ELO, posición ranking zonal, Trust icon, zona, últimos 5 partidos
- Trust Score público: ≥90 "Excelente", 70-89 "Bueno", <70 "Bajo"
- Jugador baneado (soft): retorna 404
- Jugador en calibración: `"rank": "En calibración"`

### US-041: Editar preferencias de matchmaking
- `PUT /players/me/preferences` — radar_radius_km, elo_range, preferred_schedule
- JSONB en tabla players
- Valores default: radio 10km, ±200 ELO
- Validación: radio 1-50km

### US-042: Reportar mala conducta
- `POST /matches/{id}/report` — motivo, descripción
- Solo jugadores del mismo partido pueden reportar
- Moderador de zona ve en `GET /admin/reports`
- Múltiples reportes en 7 días → flag "reportes frecuentes"

## Enfoque Técnico

### Tablas (migración)
```sql
-- Preferencias en users (JSONB)
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{"radar_radius_km": 10, "elo_min_delta": -200, "elo_max_delta": 200}'::jsonb;

-- Reportes de conducta
CREATE TABLE conduct_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id),
    reported_by UUID NOT NULL REFERENCES users(id),
    reported_player_id UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | validated | dismissed
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_player ON conduct_reports(reported_player_id);
CREATE INDEX idx_reports_status ON conduct_reports(status);
```

### Endpoints
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/players/{id}` | Perfil público |
| PUT | `/players/me/preferences` | Editar preferencias |
| POST | `/matches/{id}/report` | Reportar mala conducta |
| GET | `/admin/reports` | Listar reportes (Moderador) |

## Testing

- **Tests de integración**: perfil público con/sin ban, Trust icon mapping, reportes
- **NO TDD** (no es core domain)

## Definition of Done

- [ ] Perfil público con Trust icon (no número)
- [ ] Jugador baneado retorna 404
- [ ] Preferencias editables con validación
- [ ] Reportes solo desde jugadores del mismo partido
- [ ] Moderador ve reportes de su región
