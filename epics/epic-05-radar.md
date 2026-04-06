# EPIC 05 — Radar (Tab 1)

> **Sprint**: 3
> **Prioridad**: Alta
> **Dependencias**: EPIC 04
> **Historias**: US-030, US-031, US-032

---

## Objetivo

Implementar el Tab 1 de la app mobile: el radar de partidos calientes. Un mapa centrado en la zona del usuario con partidos abiertos, alertas urgentes y filtros por ELO. Usa PostGIS para geolocalización.

## Contexto

El Radar es la pantalla principal de la app — lo primero que ve el usuario. Muestra partidos incompletos que se juegan HOY cerca de su ubicación. Es el centro de acción y FOMO de BlendPadel.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| PL-05 | Trust < 70: oculto del radar de jugadores con Trust ≥ 70 |
| TR-05 | Filtro bidireccional de visibilidad |
| MA-06 | Partidos con estado "open" o "pending_players" |

## Historias de Usuario

### US-030: Mapa de partidos activos en zona
- `GET /radar/matches?lat={}&lng={}&radius_km={}`
- PostGIS: `ST_DWithin` para radio
- Filtro Trust Score bidireccional
- Retornar: coordenadas, jugadores faltantes, ELO promedio, hora

### US-031: Alertas urgentes en el radar
- `GET /radar/alerts`
- Partidos `open` a ≤5km con scheduled_at en la próxima hora
- Máximo 5 alertas, ordenadas por urgencia
- Badge rojo en la UI

### US-032: Filtrar radar por rango ELO
- Parámetros opcionales `elo_min`, `elo_max`
- Default: ±200 del ELO del jugador
- ELO promedio del partido precalculado en `matches.avg_elo`

## Enfoque Técnico

### Queries PostGIS Clave
```sql
-- Partidos en radio
SELECT m.*, ST_Distance(m.location, ST_MakePoint($lng, $lat)::geography) as distance
FROM matches m
WHERE m.status = 'open'
  AND ST_DWithin(m.location, ST_MakePoint($lng, $lat)::geography, $radius_m)
  AND m.scheduled_at >= NOW()
  AND m.avg_elo BETWEEN $elo_min AND $elo_max
ORDER BY distance ASC;

-- Alertas urgentes
SELECT m.*
FROM matches m
WHERE m.status = 'open'
  AND ST_DWithin(m.location, ST_MakePoint($lng, $lat)::geography, 5000)
  AND m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
ORDER BY m.scheduled_at ASC
LIMIT 5;
```

### Endpoints
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/radar/matches` | Partidos en radio con filtros |
| GET | `/radar/alerts` | Alertas urgentes (<1h, <5km) |

## Testing

- **Tests de integración**: PostGIS queries con Testcontainers, filtros de Trust Score
- **NO TDD** (no es core domain)

## Definition of Done

- [ ] Radar retorna partidos dentro del radio especificado
- [ ] Filtro de Trust Score bidireccional funciona
- [ ] Alertas urgentes solo muestran partidos <1h <5km
- [ ] Filtro ELO con defaults ±200 funciona
- [ ] PostGIS queries usan índice GIST
