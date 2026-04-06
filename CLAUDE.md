# BlendPadel — Project Context for Claude

## What Is This

Motor de Reputación y Ranking del Pádel Informal en Mendoza. ELO-based ranking, Trust Score, matchmaking geolocalizado. MVP enfocado en Rivadavia y zona metropolitana.

## Actors

| Actor | Role |
|-------|------|
| Jugador | Usuario estándar |
| Capitán | Carga resultados de partidos |
| SuperAdmin / Tribunal | Baneos, auditorías, recalibraciones globales |
| Moderador / Referente de Zona | Audita partidos de su región |
| Sistema | Auto-validación, cálculo ELO, Trust Score |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22+ con Chi router |
| Frontend Mobile | React Native + Expo + TypeScript + NativeWind (Tailwind) |
| Frontend Admin | React + Vite + TailwindCSS (dashboard web separado) |
| Database | PostgreSQL + PostGIS |
| DB Access | sqlc (genera Go desde SQL puro) |
| Auth | JWT propio (golang-jwt/jwt/v5) |
| Notifications | Firebase Cloud Messaging (FCM) — única dependencia externa |
| Storage | Local filesystem (volumen Docker), Go sirve /uploads/avatars/ |
| Migrations | golang-migrate |
| Infra | VPS propio, Docker Compose, Caddy (reverse proxy + SSL automático) |
| Cache | Sin Redis para MVP — rate limiting in-memory, leaderboards con índices Postgres |

---

## Architecture

- **Repo**: Monorepo
- **Backend pattern**: Feature-first / Domain-driven (carpeta por dominio dentro de `internal/`)
- **Frontend mobile pattern**: Feature folders
- **Frontend admin pattern**: Feature folders
- **API style**: REST
- **Error format**: RFC 7807 (Problem Details)
- **Multi-tenancy**: No (single tenant — `region_id`/`city_id` preparados para escalar)
- **i18n**: No (español único)

### Directory Structure

```
BlendPadel/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── player/           # Dominio: registro, perfil, onboarding
│   │   │   ├── model.go
│   │   │   ├── service.go
│   │   │   ├── handler.go
│   │   │   └── repository.go
│   │   ├── match/            # Dominio: partidos, validación cruzada
│   │   │   ├── model.go
│   │   │   ├── service.go
│   │   │   ├── handler.go
│   │   │   └── repository.go
│   │   ├── ranking/          # Dominio: ELO, leaderboards
│   │   │   ├── elo.go
│   │   │   ├── service.go
│   │   │   ├── handler.go
│   │   │   └── repository.go
│   │   ├── trust/            # Dominio: Trust Score, penalizaciones
│   │   │   ├── model.go
│   │   │   ├── service.go
│   │   │   └── repository.go
│   │   ├── auth/             # Dominio: JWT, login, refresh, RBAC
│   │   │   ├── jwt.go
│   │   │   ├── middleware.go
│   │   │   ├── handler.go
│   │   │   └── repository.go
│   │   ├── admin/            # Dominio: panel admin, baneos, auditoría
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   └── repository.go
│   │   ├── notification/     # Dominio: push notifications (FCM)
│   │   │   ├── notifier.go   # Interface
│   │   │   └── fcm.go        # Implementación FCM
│   │   └── platform/         # Cross-cutting
│   │       ├── config/
│   │       ├── database/
│   │       ├── middleware/    # Rate limiting, logging, CORS
│   │       ├── response/     # RFC 7807 helpers
│   │       └── storage/      # File upload helpers
│   ├── migrations/           # SQL migrations (golang-migrate)
│   ├── queries/              # sqlc SQL queries por dominio
│   │   ├── players.sql
│   │   ├── matches.sql
│   │   ├── rankings.sql
│   │   └── ...
│   ├── sqlc.yaml
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
├── mobile/                   # React Native + Expo
│   ├── src/
│   │   ├── features/
│   │   │   ├── radar/        # Tab 1: Mapa de partidos calientes
│   │   │   ├── matchmaking/  # Tab 2: Muro de desafíos
│   │   │   ├── rankings/     # Tab 3: Tablas hiper-locales
│   │   │   ├── profile/      # Tab 4: DNI Padelero
│   │   │   └── auth/         # Login, registro, onboarding
│   │   ├── components/       # Componentes compartidos
│   │   ├── hooks/
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API client
│   │   ├── types/
│   │   └── utils/
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
├── admin/                    # React + Vite + Tailwind
│   ├── src/
│   │   ├── features/
│   │   │   ├── dashboard/
│   │   │   ├── disputes/
│   │   │   ├── players/
│   │   │   └── moderation/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── services/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docker/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── .env.docker
├── docs/                     # Documentación SDD
│   ├── epics/
│   └── openspec/
├── CLAUDE.md
├── README.md
├── .env.example
└── .gitignore
```

---

## Development Conventions

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Go files | snake_case | `player_service.go` |
| Go variables/functions | camelCase | `calculateELO` |
| Go types/structs | PascalCase | `PlayerProfile` |
| Go packages | lowercase, single word | `ranking`, `trust` |
| TS/TSX files | kebab-case | `match-card.tsx` |
| TS variables/functions | camelCase | |
| TS types/interfaces | PascalCase | |
| DB tables | snake_case, plural | `players`, `matches` |
| DB columns | snake_case | `trust_score`, `elo_rating` |
| API endpoints | kebab-case | `/api/v1/match-results` |
| Branches | `feature/epic-{NN}/{descripcion-corta}` | `feature/epic-01/elo-calculation` |
| Commits | Conventional Commits | `feat(ranking): add ELO calculation` |

### Imports (Go)

```go
import (
    // Stdlib
    "fmt"
    "net/http"

    // Third-party
    "github.com/go-chi/chi/v5"

    // Local
    "github.com/blendpadel/internal/ranking"
)
```

Use `goimports` for auto-formatting.

### Imports (TS/React)

Order: React → Third-party → Local features → Local components → Types.
Use absolute imports with `@/` alias pointing to `src/`.

### Patterns

- **Repository pattern**: Interfaces defined in domain packages, implementations in the same package
- **Dependency injection**: Constructor injection — no globals
- **Interface segregation**: Small interfaces (`Notifier`, `Repository`), not god interfaces
- **Error wrapping**: `fmt.Errorf("operation: %w", err)` — always wrap with context at each layer

### Error Handling

- **Backend**: RFC 7807 Problem Details JSON (`type`, `title`, `status`, `detail`, `instance`)
- **Frontend**: Error boundaries + toast notifications for user-facing errors
- **Go**: Return errors, never `panic` in handlers. Log at the boundary, wrap at each layer.

---

## Security Rules

- **Passwords**: bcrypt, cost 10
- **JWT Access Token**: HS256, 1 hour TTL
- **JWT Refresh Token**: 30 days TTL, rotation on every use, detect replay attacks
- **Secrets**: NEVER in code — always env vars. `.env` in `.gitignore`
- **RBAC**: 3 levels — `SuperAdmin` (full access), `Moderador` (region-scoped), `Jugador` (standard user)
- **Rate limiting login**: 5 attempts / 15 min per IP — in-memory with `sync.Mutex` + map with TTL expiration
- **CORS**: Allow only `api.blendpadel.com`, `admin.blendpadel.com` (configurable via env)
- **Headers**: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, strict CSP
- **File uploads**: Validate MIME type, max 5MB, sanitize filename, serve from separate path
- **SQL injection**: Impossible with sqlc (parameterized queries by design)
- **FCM credentials**: Service account JSON in env var or mounted secret — never in repo

---

## Database Rules

- Migrations: golang-migrate — always with both `up` and `down`
- Migrations run as ephemeral Docker container before API starts
- **Soft delete**: players (never lose ranking history), matches (audit trail)
- **Hard delete**: sessions, expired tokens
- **Audit fields**: `created_at`, `updated_at` on ALL tables (`timestamptz DEFAULT NOW()`)
- `region_id` and `city_id` on players and matches — prepared for multi-region, not active in MVP
- **ELO**: stored as `INTEGER` (multiply by 100 internally for precision, display as float)
- **Trust Score**: stored as `INTEGER` (0–100)
- **PostGIS**: `geography` type for lat/lng, spatial index on match locations

---

## Testing

- **Framework**: `go test` + `testify` (assertions + mocks)
- **DB for tests**: Testcontainers (PostgreSQL + PostGIS real container per test run)
- **TDD estricto** SOLO para Core Domain: ELO calculation, Trust Score, cross-validation. Tests BEFORE code.
- **Everything else**: Integration tests post-code (CRUD endpoints, profile, etc.)
- **Frontend**: Jest (standard with Expo)
- **Mocking**: FCM mocked in tests (interface-based), DB always real via Testcontainers
- **CI**: Tests must pass before merge

---

## Workflow (1 dev — Juani + Claude)

1. Planificar: `/sdd-new` referencing `docs/epics/epic-{NN}.md`
2. Implementar: `/sdd-apply`
3. Subir: Branch `feature/epic-{NN}/{desc}` → PR to `main`
4. Verificar: `/sdd-verify`
5. Cerrar: `/sdd-archive` after merge

---

## Definition of Done

### Feature
- [ ] Code implemented per specs
- [ ] Tests written and passing
- [ ] No lint warnings (`golangci-lint`, `eslint`)
- [ ] PR merged to main

### Bug Fix
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Test that reproduces the bug (fails before fix, passes after)

---

## Anti-patterns — NUNCA hacer

- NUNCA usar `float64` para ELO o Trust Score — usar `int` (x100 para precisión)
- NUNCA commitear `.env`, `serviceAccountKey.json`, ni secrets
- NUNCA `git push --force` a `main`
- NUNCA hacer queries N+1 — usar JOINs o batch queries en sqlc
- NUNCA hardcodear URLs, API keys, o configuración
- NUNCA usar `sync.Map` para rate limiting (no tiene TTL) — usar `map` + `sync.Mutex` + goroutine de limpieza
- NUNCA usar `panic()` en handlers — siempre return error
- NUNCA usar `interface{}` / `any` sin type assertion — Go es tipado fuerte, usalo
- NUNCA servir uploads sin validar MIME type y tamaño
- NUNCA hacer cálculos de ELO en el handler — siempre en el service layer del dominio `ranking`
- NUNCA exponer endpoints de admin sin middleware RBAC
- NUNCA usar `SELECT *` en sqlc queries — listar columnas explícitamente
- NUNCA ignorar el error de `rows.Close()` o `tx.Rollback()`
- NUNCA usar `any` en TypeScript salvo que sea estrictamente necesario
- NUNCA importar entre features en mobile (feature A no importa de feature B — pasar por shared)
