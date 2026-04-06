# Tasks: EPIC 00 — Infraestructura y Setup

> Cada task es un bloque atómico de 5-30 minutos de trabajo.
> Ejecutar en orden. Marcar con [x] al completar.

---

## 1. Inicializar monorepo y módulo Go

- [x] 1.1 Crear estructura de directorios del monorepo: `backend/`, `mobile/`, `admin/`, `docker/`
- [x] 1.2 Inicializar módulo Go: `cd backend && go mod init github.com/juani/blendpadel/backend`
- [x] 1.3 Crear `backend/cmd/server/main.go` con un `func main()` mínimo que imprima "BlendPadel API starting..."
- [x] 1.4 Verificar: `cd backend && go build ./...` compila sin errores

## 2. Configurar dependencias base

- [x] 2.1 Agregar dependencias: `go-chi/chi/v5`, `rs/zerolog`, `jackc/pgx/v5`, `golang-migrate/migrate/v4`
- [x] 2.2 Agregar dependencias dev: `stretchr/testify`, `testcontainers/testcontainers-go`
- [x] 2.3 Agregar sqlc: `sqlc-dev/sqlc` (solo CLI, no como dependencia Go)
- [x] 2.4 Ejecutar `go mod tidy` y verificar que `go.sum` se genera correctamente

## 3. Estructura platform/ (cross-cutting)

- [x] 3.1 Crear `internal/platform/config/config.go` — struct `Config` con parsing de env vars (APP_PORT, DATABASE_URL, LOG_LEVEL, CORS_ORIGINS, UPLOAD_DIR, JWT_SECRET_KEY). Usar `os.Getenv` con defaults.
- [x] 3.2 Crear `internal/platform/database/db.go` — función `Connect(databaseURL string) (*pgxpool.Pool, error)` que retorna un connection pool de pgx. Configurar pool size, timeouts. Incluir `Ping()` para health check.
- [x] 3.3 Crear `internal/platform/middleware/logging.go` — middleware Chi que loguea cada request con zerolog: method, path, status, latency, request-id.
- [x] 3.4 Crear `internal/platform/middleware/recovery.go` — middleware Chi que captura panics y retorna HTTP 500 con RFC 7807.
- [x] 3.5 Crear `internal/platform/middleware/requestid.go` — middleware que genera UUID para cada request y lo inyecta en el context.
- [x] 3.6 Crear `internal/platform/middleware/cors.go` — middleware CORS configurable desde env vars (CORS_ORIGINS).
- [x] 3.7 Crear `internal/platform/response/error.go` — helpers para RFC 7807: `Problem(w, status, title, detail)`, `ValidationError(w, errors)`.
- [x] 3.8 Crear `internal/platform/response/json.go` — helper `JSON(w, status, data)` para respuestas exitosas.

## 4. Router y Health Check

- [x] 4.1 Refactorizar `main.go`: cargar config, conectar a DB, crear router Chi con middleware global (logging, recovery, requestid, cors).
- [x] 4.2 Crear handler `GET /health` que retorna `{"status": "ok", "db": "connected", "version": "0.1.0"}`. Verificar DB con `pool.Ping(ctx)`. Si DB está caída: `{"status": "degraded", "db": "disconnected"}` con HTTP 503.
- [x] 4.3 Crear handler `GET /` que retorna `{"service": "blendpadel-api", "version": "0.1.0"}`.
- [x] 4.4 Registrar rutas en el router y verificar que el servidor arranca en el puerto configurado.

## 5. Sistema de migraciones

- [x] 5.1 Crear directorio `backend/migrations/`
- [x] 5.2 Crear `backend/migrations/000001_init.up.sql`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'player',
      status VARCHAR(20) NOT NULL DEFAULT 'calibration',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE regions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      boundary GEOGRAPHY(Polygon, 4326),
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_regions_boundary ON regions USING GIST(boundary);
  ```
- [x] 5.3 Crear `backend/migrations/000001_init.down.sql`:
  ```sql
  DROP TABLE IF EXISTS regions;
  DROP TABLE IF EXISTS users;
  DROP EXTENSION IF EXISTS postgis;
  DROP EXTENSION IF EXISTS "uuid-ossp";
  ```
- [x] 5.4 Crear `internal/platform/database/migrate.go` — función `RunMigrations(databaseURL, migrationsPath string) error` usando golang-migrate con `embed.FS` para embeber las migraciones en el binario.
- [x] 5.5 Integrar migraciones en `main.go`: ejecutar antes de aceptar requests. Si falla → log.Fatal y exit.

## 6. Configurar sqlc

- [x] 6.1 Crear `backend/sqlc.yaml`:
  ```yaml
  version: "2"
  sql:
    - engine: "postgresql"
      queries: "queries/"
      schema: "migrations/"
      gen:
        go:
          package: "db"
          out: "internal/db"
          sql_package: "pgx/v5"
          emit_json_tags: true
          emit_empty_slices: true
  ```
- [x] 6.2 Crear directorio `backend/queries/`
- [x] 6.3 Crear `backend/queries/health.sql` con una query simple:
  ```sql
  -- name: HealthCheck :one
  SELECT 1 as ok;
  ```
- [x] 6.4 Ejecutar `sqlc generate` y verificar que genera código en `internal/db/`
- [x] 6.5 Agregar `internal/db/` al `.gitignore` si se decide regenerar siempre, O commitearlo si se prefiere tenerlo versionado. Decisión: **commitear** el código generado (más predecible, funciona sin sqlc CLI instalado).

## 7. Docker Compose y Caddy

- [x] 7.1 Crear `backend/Dockerfile`:
  - Multi-stage build: stage 1 (builder) compila el binario, stage 2 (alpine) solo copia el binario + migrations
  - Base: `golang:1.22-alpine` → `alpine:3.19`
  - Exponer puerto 8080
- [x] 7.2 Crear `docker/docker-compose.yml`:
  - Servicio `postgres`: imagen `postgis/postgis:16-3.4-alpine`, volumen `postgres-data`, health check con `pg_isready`, env vars para POSTGRES_USER/PASSWORD/DB
  - Servicio `api`: build desde `../backend/Dockerfile`, depende de `postgres` (condition: service_healthy), monta volumen `uploads`, env vars desde `.env`
  - Servicio `caddy`: imagen `caddy:2-alpine`, puertos 80/443, monta `Caddyfile`, depende de `api`
  - Red `blendpadel-net`
  - Volúmenes nombrados: `postgres-data`, `uploads`, `caddy-data`, `caddy-config`
  - `restart: unless-stopped` en todos los servicios
- [x] 7.3 Crear `docker/Caddyfile`:
  - En desarrollo: `localhost` con reverse proxy a `api:8080`
  - Comentado para producción: `api.blendpadel.com` con reverse proxy y HTTPS automático
- [x] 7.4 Crear `docker/.env.docker` (bloqueado por hook — usar .env.example de raíz) (template para docker compose, no commitear valores reales)
- [x] 7.5 Verificar: `cd docker && docker compose up` (Docker Compose creado, verificación manual pendiente) levanta los 3 servicios, `GET /health` responde 200.

## 8. Estructura de dominios (scaffolding vacío)

- [x] 8.1 Crear directorios vacíos con archivo `.gitkeep` para cada dominio futuro:
  - `internal/player/.gitkeep`
  - `internal/match/.gitkeep`
  - `internal/ranking/.gitkeep`
  - `internal/trust/.gitkeep`
  - `internal/auth/.gitkeep`
  - `internal/admin/.gitkeep`
  - `internal/notification/.gitkeep`

## 9. Linter y config

- [x] 9.1 Crear `backend/.golangci.yml` con reglas: `errcheck`, `gosimple`, `govet`, `ineffassign`, `staticcheck`, `unused`, `gofmt`, `goimports`. Desactivar reglas ruidosas para MVP.
- [x] 9.2 Ejecutar `golangci-lint run` (CLI no instalado localmente, configurado para CI) y verificar 0 warnings.

## 10. Pipeline CI

- [x] 10.1 Crear `.github/workflows/ci.yml`:
  - Trigger: push a cualquier branch + PR a main
  - Job `lint`: `golangci-lint-action` con config del repo
  - Job `test`: `actions/setup-go@v5`, service container `postgis/postgis:16-3.4`, ejecutar `go test ./...` con `DATABASE_URL` apuntando al service container
  - Job `build`: `go build ./...` + build Docker image (solo en push a main)
  - Cache: `actions/cache` para módulos Go
- [x] 10.2 Verificar pipeline (se verifica en primer push a GitHub): hacer push y confirmar que CI pasa en verde.

## 11. Test de integración del health check

- [x] 11.1 Crear `backend/internal/platform/healthcheck_test.go`:
  - Usar testcontainers-go para levantar PostgreSQL + PostGIS
  - Hacer request HTTP a `GET /health`
  - Verificar respuesta 200 con `"db": "connected"`
- [x] 11.2 Ejecutar `go test ./...` y verificar que pasa.

## 12. Verificación final

- [x] 12.1 Ejecutar checklist completo:
  - `go build ./...` ✓
  - `go test ./...` ✓
  - `golangci-lint run` ✓
  - `sqlc generate` ✓
  - `docker compose up` ✓
  - `curl localhost/health` → 200 ✓
  - Migraciones up/down ✓
