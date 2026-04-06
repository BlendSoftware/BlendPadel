# EPIC 07 — Rankings (Tab 3)

> **Sprint**: 3
> **Prioridad**: Alta
> **Dependencias**: EPIC 03, EPIC 04
> **Historias**: US-036, US-037, US-038, US-039

---

## Objetivo

Implementar el Tab 3 de la app: las tablas de ranking hiperlocales. Rankings por zona geográfica de Mendoza, definición de zonas por el SuperAdmin, proyección de puntos antes de aceptar un partido, y gráfico de evolución de ELO.

## Contexto

El ranking es la Arena del Ego del mendocino. "Top 10 de la Zona Este", "Los mejores de 5ta en Rivadavia". La gente necesita sentirse importante en su micro-comunidad. La proyección de puntos añade presión psicológica antes de pisar la cancha.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| PL-02 | Solo jugadores con ≥3 partidos en ranking |
| RK-04 | Calibración = invisible en ranking global |
| RK-05 | Tablas hiperlocales por zona (PostGIS) |
| RK-06 | Proyección de puntos: delta ELO esperado antes de confirmar |

## Historias de Usuario

### US-036: Ranking global por zona
- `GET /rankings?zone_id=&limit=10`
- Solo jugadores `active` (≥3 partidos)
- `RANK() OVER (ORDER BY elo DESC)`
- Incluir posición del usuario autenticado aunque no esté en top N

### US-037: Definir zonas hiperlocales
- `POST /admin/regions` — nombre, descripción, polígono GeoJSON
- Asignación automática de jugadores por `ST_Contains`
- Seed con regiones de Mendoza

### US-038: Proyección de puntos antes de aceptar
- `GET /matches/projection?team_a={id1},{id2}&team_b={id3},{id4}`
- Calcula delta ELO para cada jugador en caso de win/lose
- M=1.0 asumido (margen desconocido)
- Solo lectura, no modifica DB

### US-039: Ranking histórico personal
- `GET /players/me/elo-history`
- Array de {date, elo_after, match_id, opponent_names}
- Paginación con cursor, max 100 puntos
- Filtro por rango de fechas

## Enfoque Técnico

### Queries Clave
```sql
-- Ranking por zona
SELECT u.id, u.name, u.elo, u.trust_score, u.validated_match_count,
       RANK() OVER (ORDER BY u.elo DESC) as position
FROM users u
WHERE u.status = 'active'
  AND u.region_id = $zone_id
ORDER BY u.elo DESC
LIMIT $limit;

-- Asignación automática de región
UPDATE users SET region_id = (
    SELECT r.id FROM regions r
    WHERE ST_Contains(r.boundary, users.location)
    ORDER BY ST_Area(r.boundary) ASC
    LIMIT 1
)
WHERE users.id = $user_id;
```

### Endpoints
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/rankings` | Ranking por zona |
| POST | `/admin/regions` | Crear zona (SuperAdmin) |
| GET | `/regions` | Listar zonas (público) |
| GET | `/matches/projection` | Proyección de puntos |
| GET | `/players/me/elo-history` | Historial ELO personal |

### Regiones Seed (Mendoza)
Incluir en migración:
- Gran Mendoza (Capital, Godoy Cruz, Guaymallén, Las Heras, Maipú)
- Zona Este (Rivadavia, Junín, San Martín)
- Valle de Uco (Tunuyán, Tupungato, San Carlos)
- Sur (San Rafael, General Alvear, Malargüe)

## Testing

- **Tests unitarios**: proyección de puntos (función pura)
- **Tests de integración**: ranking query, asignación de región, filtros
- **NO TDD** (no es core domain)

## Definition of Done

- [ ] Ranking por zona solo muestra jugadores activos
- [ ] Posición del usuario incluida en respuesta
- [ ] Zonas de Mendoza seeded en migración
- [ ] Asignación automática de región funciona
- [ ] Proyección de puntos calcula deltas correctos
- [ ] Historial ELO paginado funciona
