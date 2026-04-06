# EPIC 06 — Matchmaking (Tab 2)

> **Sprint**: 3
> **Prioridad**: Alta
> **Dependencias**: EPIC 04
> **Historias**: US-033, US-034, US-035

---

## Objetivo

Implementar el Tab 2 de la app: el muro de desafíos (matchmaking). Los jugadores publican "flares" buscando rivales, otros jugadores los ven filtrados por ELO y distancia, y al aceptar un desafío se crea un partido automáticamente.

## Contexto

El matchmaking es donde se gestiona la oferta y demanda. Un jugador publica "busco rival de 6ta para mañana a las 21h en El Portillo" y los jugadores del nivel adecuado lo ven y responden.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| PL-05 | Trust < 70: oculto del matchmaking de jugadores serios |
| MA-01 | Siempre dobles: 4 jugadores, 2 equipos de 2 |
| MA-06 | Partido creado desde flare con estado "pending_result" |

## Historias de Usuario

### US-033: Crear flare de desafío
- `POST /matchmaking/flares` — fecha, hora, zona, mensaje
- Un flare activo por jugador
- Expiración automática a las 24h
- Visible para jugadores a ≤15km con ELO ±300

### US-034: Consultar muro de desafíos filtrado
- `GET /matchmaking/flares` — filtrado automático por ELO + distancia + Trust
- Incluir: nombre, ELO, zona, horario, Trust Score icon
- Paginación con cursor

### US-035: Aceptar desafío y crear partido
- `POST /matchmaking/flares/{id}/respond` — con partner_id
- Transacción: crear partido + actualizar flare a "matched"
- Push notification a ambos creadores
- Validar: no solapamiento horario, partner válido

## Enfoque Técnico

### Tablas (migración)
```sql
CREATE TABLE matchmaking_flares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(Point, 4326),
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | matched | expired | cancelled
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_flares_status ON matchmaking_flares(status);
CREATE INDEX idx_flares_location ON matchmaking_flares USING GIST(location);
CREATE INDEX idx_flares_player ON matchmaking_flares(player_id);
```

### Endpoints
| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/matchmaking/flares` | Crear flare |
| GET | `/matchmaking/flares` | Listar flares filtrados |
| POST | `/matchmaking/flares/{id}/respond` | Aceptar y crear partido |
| DELETE | `/matchmaking/flares/{id}` | Cancelar flare propio |

## Testing

- **Tests de integración**: flow completo crear flare → aceptar → partido creado
- **NO TDD** (no es core domain)

## Definition of Done

- [ ] Crear flare con límite de 1 activo por jugador
- [ ] Expiración automática a 24h
- [ ] Muro filtrado por ELO + distancia + Trust
- [ ] Aceptar desafío crea partido en transacción
- [ ] Push notification al aceptar
