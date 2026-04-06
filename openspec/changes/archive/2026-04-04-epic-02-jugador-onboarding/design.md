# Design: EPIC 02 — Jugador y Onboarding

## Context

EPIC 00 y 01 completadas. Backend Go con auth funcional (JWT, RBAC, rate limiting). Tabla `users` tiene: id, email, password_hash, role, status, name, trust_score, created_at, updated_at. Faltan las columnas de player (location, elo, avatar, onboarding, etc.).

Docker Compose corriendo con PostgreSQL+PostGIS, Caddy reverse proxy, API Go.

## Goals

- Jugadores completan onboarding y reciben ELO inicial algorítmico
- Perfiles editables con geolocalización validada para Mendoza
- Upload de avatares al filesystem local
- Vista de perfil completo para el usuario autenticado

## Non-Goals

- Perfil público de OTRO jugador (se implementa en EPIC 08)
- Historial de partidos real (placeholder hasta EPIC 04)
- Asignación automática de región por polígono (las regiones se definen en EPIC 07, acá solo guardamos region_id si el frontend lo envía)

## Decisions

### D1: Algoritmo de onboarding determinístico con tabla de puntajes
**Decisión**: Scoring basado en tabla fija de deltas, no ML ni fuzzy logic.
**Razón**: Predecible, testeable, auditable. Si un jugador se queja de su ELO inicial, podemos mostrarle exactamente por qué le dieron ese puntaje.
**Fórmula**:
```
Base = 1000
+ Frecuencia:     nunca=-100, rara_vez=-100, 1_2_sem=0, 3_mas_sem=+100
+ Torneos:        nunca=-50, amateur=+50, federado=+150
+ Paleta:         iniciacion=-100, intermedia=0, avanzada=+100
+ Autoevaluacion: principiante=-100, intermedio=0, avanzado=+100, competitivo=+150

Inconsistency: autoevaluacion >= avanzado AND frecuencia <= 1_2_sem → cap delta a +50
Clamp: max(800, min(resultado, 1400))
```

### D2: Validación MIME por magic bytes
**Decisión**: Leer los primeros 512 bytes del archivo y usar `http.DetectContentType` para validar.
**Razón**: La extensión del archivo es trivial de falsificar. Los magic bytes son la fuente real del tipo. Go tiene `http.DetectContentType` built-in.
**Formatos permitidos**: `image/jpeg`, `image/png`, `image/webp`

### D3: Avatares servidos por Go, no por Caddy
**Decisión**: Go sirve los archivos estáticos con `http.FileServer` en ruta `/uploads/`.
**Razón**: En desarrollo es más simple (no hay que configurar Caddy). En producción se puede optimizar con Caddy después si necesitamos, pero para el MVP Go lo maneja bien.
**Trade-off**: Un poco más de carga en Go, pero los avatares son archivos chicos (<5MB) y pocos usuarios en MVP.

### D4: Coordenadas como GEOGRAPHY, validación bounds server-side
**Decisión**: Guardar como `GEOGRAPHY(Point, 4326)` en PostGIS. Validar bounds de Mendoza en el service layer antes de guardar.
**Razón**: GEOGRAPHY usa metros para cálculos de distancia (vs GEOMETRY que usa grados). Los bounds de Mendoza son una validación simple: lat [-35.5, -32.0], lng [-70.5, -67.5].
**Trade-off**: No es un polígono exacto de Mendoza, es un bounding box. Suficiente para MVP.

### D5: Perfil público sin coordenadas exactas
**Decisión**: `GET /players/{id}` retorna `region_name` pero NUNCA lat/lng.
**Razón**: Privacidad. No queremos que alguien pueda geolocalizar la casa de un jugador.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Algoritmo de onboarding demasiado simple → ELO inicial impreciso | K=60 en primeros 5 partidos corrige rápido. Guardar respuestas para auditoría y ajustar pesos después. |
| Upload de archivos maliciosos (no imágenes) | Validar magic bytes + limitar tamaño + no ejecutar el archivo (solo servir como estático con Content-Type fijo) |
| PostGIS queries lentas sin índice | GIST index en location. Para MVP con pocos usuarios, no es un problema. |

## Migration Plan

### Migración 000003_player.up.sql
```sql
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326),
    ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id),
    ADD COLUMN IF NOT EXISTS elo INTEGER NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS validated_match_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS elo_frozen BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo DESC);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region_id);

CREATE TABLE onboarding_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    responses JSONB NOT NULL,
    calculated_elo INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Open Questions

Ninguna.
