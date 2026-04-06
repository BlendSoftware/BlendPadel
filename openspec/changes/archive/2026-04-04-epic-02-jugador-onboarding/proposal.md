# Proposal: EPIC 02 — Jugador y Onboarding

## Why

El onboarding anti-humo es la razón de existir de BlendPadel. El problema central no es encontrar cancha — es el "falso 5ta", el humo, el jugador que dice ser de un nivel que no es. Si dejamos que los jugadores elijan su propia categoría, el sistema nace muerto.

El cuestionario de onboarding resuelve esto: evalúa frecuencia de juego, participación en torneos, tipo de paleta y autoevaluación, y el algoritmo asigna un ELO inicial que el jugador NO puede manipular. Si miente, los primeros partidos con K=60 lo van a acomodar violentamente.

Sin esta EPIC no hay jugadores con ELO, y sin ELO no hay ranking, ni matchmaking, ni radar.

## What Changes

### Cuestionario de onboarding anti-smoke (US-012)
- `POST /onboarding/questionnaire` — 5 preguntas con opciones cerradas
- Algoritmo de scoring: base 1000 + deltas por respuesta, rango final [800, 1400]
- Inconsistency check: si se autodeclara "Avanzado" pero juega 1 vez por semana → cap conservador
- Post-completar: `onboarding_completed = true`, ELO asignado, estado sigue `calibration`
- Respuestas guardadas en `onboarding_responses` para auditoría

### Completar perfil (US-013)
- `PUT /players/me` — last_name, coordenadas geográficas
- Validación de bounds para Mendoza: lat [-35.5, -32.0], lng [-70.5, -67.5]
- Coordenadas almacenadas como `GEOGRAPHY(Point, 4326)` con PostGIS
- Asignación automática de `region_id` v��a `ST_Contains`
- Perfil público retorna zona aproximada, NUNCA coordenadas exactas

### Upload de avatar (US-014)
- `POST /players/me/avatar` — multipart/form-data
- Validación MIME real por magic bytes (no confiar en extensión)
- Formatos: JPG, PNG, WebP. Máximo 5MB.
- Nombre en filesystem: `{user_id}_{timestamp}.{ext}`
- Servido desde `/uploads/avatars/` via Go static handler
- Al subir nuevo avatar, eliminar el anterior del filesystem

### Perfil completo propio (US-015)
- `GET /players/me` — toda la info del jugador autenticado
- ELO, Trust Score, rank posicional (si activo), estado calibración
- `calibration_matches_remaining` calculado (3 - validated_match_count)
- Últimos 10 partidos con delta ELO (placeholder hasta EPIC 04)

## Capabilities

### New
- Cuestionario de onboarding con algoritmo de scoring
- Perfil de jugador con geolocalización PostGIS
- Upload y servicio de avatares desde filesystem local
- Vista de perfil completo
- Tabla `onboarding_responses` para auditoría
- Migración 000003_player con columnas de player y tabla de onboarding

### Modified
- Tabla `users`: se agregan columnas de player (last_name, location, elo, avatar_url, etc.)

## Impact

- **Scope**: Backend Go, dominio `internal/player/`. File serving para avatares.
- **Risk**: Bajo para CRUD. Medio para el algoritmo de onboarding (core del producto — necesita tests exhaustivos).
- **Bloqueante**: EPIC 03 (ELO) necesita que existan jugadores con ELO asignado. EPIC 04 (Partidos) necesita perfiles completos.
