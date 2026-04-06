# EPIC 02 — Jugador y Onboarding

> **Sprint**: 1
> **Prioridad**: Alta
> **Dependencias**: EPIC 00, EPIC 01
> **Historias**: US-012, US-013, US-014, US-015

---

## Objetivo

Implementar el perfil del jugador, el cuestionario de onboarding anti-humo que asigna ELO inicial, upload de avatar y la vista de perfil completo. Al terminar esta EPIC, los jugadores nuevos pasan por el cuestionario, reciben un ELO inicial justo y pueden gestionar su perfil.

## Contexto

El onboarding anti-humo es CORE del producto. Nadie elige su categoría — el sistema la asigna. Esto es lo que diferencia a BlendPadel de cualquier app de pádel genérica. El cuestionario evalúa frecuencia, torneos, paleta y autoevaluación cualitativa para calcular un ELO inicial algorítmico.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| PL-01 | Los jugadores NO eligen su categoría. El nivel se determina por el cuestionario. |
| PL-02 | Estado "Calibración" hasta 3 partidos validados. Invisible en ranking global. |
| PL-03 | Cuestionario: frecuencia, torneos, paleta, autoevaluación. ELO asignado algorítmicamente. |
| PL-04 | Avatar: JPG/PNG/WebP, max 5MB, filesystem local. |
| PL-06 | Perfil público: rank, ELO, Trust Score, últimos 10 partidos. |
| TR-01 | Trust Score inicial: 80/100. |

## Historias de Usuario

### US-012: Cuestionario de onboarding anti-smoke
- `POST /onboarding/questionnaire` — 5 preguntas
- Algoritmo de scoring: puntaje por respuesta → ELO_inicial = 1000 + delta (rango 800-1400)
- Respuestas inconsistentes → ELO conservador
- Post-completar: estado `calibration`, Trust Score 80

### US-013: Completar perfil de jugador
- `PUT /players/me` — nombre, apellido, coordenadas
- Coordenadas como `GEOGRAPHY(Point, 4326)`
- Validar bounds Mendoza: lat [-35.5, -32.0], lng [-70.5, -67.5]
- Perfil público: zona aproximada, no coordenadas exactas

### US-014: Upload de avatar
- `POST /players/me/avatar` — multipart/form-data
- Validar MIME type real (magic bytes), no solo extensión
- Nombre: `{user_id}_{timestamp}.{ext}`
- Servir via `/uploads/avatars/` (Caddy o Go static)

### US-015: Consultar propio perfil completo
- `GET /players/me` — ELO, Trust Score, rank, calibración, historial
- Últimos 10 partidos con delta ELO
- `calibration_matches_remaining: N` si en calibración

## Enfoque Técnico

### Tablas (migración)
```sql
-- Extender users con campos de player
ALTER TABLE users ADD COLUMN name VARCHAR(100);
ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN location GEOGRAPHY(Point, 4326);
ALTER TABLE users ADD COLUMN region_id UUID REFERENCES regions(id);
ALTER TABLE users ADD COLUMN elo INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE users ADD COLUMN trust_score INTEGER NOT NULL DEFAULT 80;
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN validated_match_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN elo_frozen BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_users_location ON users USING GIST(location);
CREATE INDEX idx_users_elo ON users(elo DESC);
CREATE INDEX idx_users_region ON users(region_id);

-- Respuestas de onboarding (para auditoría)
CREATE TABLE onboarding_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    responses JSONB NOT NULL,
    calculated_elo INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Algoritmo de Onboarding
```
Base ELO = 1000

Frecuencia:     Nunca/Rara vez → -100 | 1-2/sem → 0 | 3+/sem → +100
Torneos:        Nunca → -50 | Amateur → +50 | Federado → +150
Tipo de paleta: Iniciación → -100 | Intermedia → 0 | Avanzada → +100
Autoevaluación: Principiante → -100 | Intermedio → 0 | Avanzado → +100 | Competitivo → +150

Inconsistency check: si autoevaluación >= Avanzado pero frecuencia <= 1/sem → cap a +50
Rango final: clamp(800, resultado, 1400)
```

### Estructura del dominio player/
```
internal/player/
├── handler.go      # Handlers: Onboarding, UpdateProfile, UploadAvatar, GetProfile
├── service.go      # Lógica: calcular ELO onboarding, validar perfil
├── onboarding.go   # Algoritmo de scoring del cuestionario
├── repository.go   # Interface
├── postgres.go     # Implementación
└── model.go        # DTOs
```

## Testing

- **TDD**: NO (no es core domain, excepto el algoritmo de onboarding que merece tests unitarios exhaustivos)
- **Tests unitarios**: Algoritmo de onboarding con tabla de casos (respuestas → ELO esperado)
- **Tests de integración**: CRUD perfil, upload avatar, flow completo de onboarding

## Definition of Done

- [ ] Cuestionario asigna ELO inicial sin manipulación del usuario
- [ ] Respuestas inconsistentes → ELO conservador
- [ ] Perfil editable con geolocalización validada para Mendoza
- [ ] Avatar upload con validación MIME real
- [ ] Perfil completo con ELO, Trust Score, estado calibración
- [ ] Tests del algoritmo de onboarding pasan
