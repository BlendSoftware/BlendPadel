# EPIC 00 — Infraestructura y Setup

> **Sprint**: 0
> **Prioridad**: Alta (bloqueante para todo el proyecto)
> **Dependencias**: Ninguna
> **Historias**: US-001, US-002, US-003, US-004, US-005

---

## Objetivo

Levantar toda la base técnica del proyecto: Docker Compose con los servicios core, PostgreSQL con PostGIS, estructura del proyecto Go con Chi y sqlc, pipeline CI y sistema de migraciones. Al terminar esta EPIC, el equipo tiene un backend Go funcional que compila, pasa tests, tiene health check y puede desplegar en el VPS.

## Contexto

BlendPadel es un monorepo con 3 apps (backend Go, mobile React Native, admin React). Esta EPIC se enfoca exclusivamente en el backend y la infraestructura Docker. El frontend se toca en EPICs posteriores.

## Historias de Usuario

### US-001: Setup Docker Compose con servicios base
- Docker Compose con 3 servicios: `api` (Go), `postgres` (16-alpine + PostGIS), `caddy` (2-alpine)
- Volúmenes persistentes para PostgreSQL y uploads
- Health check en Go que verifica conexión a DB
- `restart: unless-stopped` en todos los servicios

### US-002: Configurar PostgreSQL con extensión PostGIS
- Extensión PostGIS habilitada en migration inicial
- Tipo `GEOGRAPHY(Point, 4326)` para coordenadas
- Índice GIST en columnas de ubicación
- Verificar con `SELECT PostGIS_Version()`

### US-003: Estructura del proyecto Go con Chi y sqlc
- Estructura: `cmd/server/`, `internal/{player,match,ranking,trust,auth,admin,notification,platform}/`
- Chi como router con middleware base: logging, recovery, request-id
- sqlc configurado para generar código desde queries SQL
- `go.mod` inicializado con dependencias base

### US-004: Pipeline CI básico
- GitHub Actions: lint (golangci-lint), test, build
- Service container PostgreSQL para tests de integración
- Cache de módulos Go
- Build de imagen Docker en push a main

### US-005: Sistema de migraciones con golang-migrate
- golang-migrate embebido en el binario
- Archivos en `migrations/NNNN_descripcion.{up,down}.sql`
- Primera migración: PostGIS + tablas `users`, `regions`
- Rollback funcional para cada migración

## Enfoque Técnico

### Docker Compose
```yaml
# Servicios: api, postgres, caddy
# Red interna: blendpadel-net
# Volúmenes: postgres-data, uploads
```

### Estructura de Carpetas (Backend)
```
backend/
├── cmd/server/main.go          # Entrypoint
├── internal/
│   ├── platform/
│   │   ├── config/config.go    # Env vars parsing
│   │   ├── database/db.go      # Connection pool
│   │   ├── middleware/          # Logging, recovery, request-id, CORS
│   │   └── response/error.go   # RFC 7807 helpers
│   ├── player/                 # (vacío, se implementa en EPIC 02)
│   ├── match/                  # (vacío, se implementa en EPIC 04)
│   ├── ranking/                # (vacío, se implementa en EPIC 03)
│   ├── trust/                  # (vacío, se implementa en EPIC 03)
│   ├── auth/                   # (vacío, se implementa en EPIC 01)
│   ├── admin/                  # (vacío, se implementa en EPIC 09)
│   └── notification/           # (vacío, se implementa en EPIC 10)
├── migrations/
│   ├── 0001_init.up.sql        # PostGIS + users + regions
│   └── 0001_init.down.sql
├── queries/                    # sqlc queries (vacío por ahora)
├── sqlc.yaml
├── go.mod
├── go.sum
├── Dockerfile
└── .golangci.yml
```

### Migración Inicial (0001_init)
```sql
-- PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla users (base, se extiende en EPICs posteriores)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'player', -- player, moderator, superadmin
    status VARCHAR(20) NOT NULL DEFAULT 'calibration', -- calibration, active, banned_soft, banned_hard
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla regions
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

## Testing

- Health check endpoint: test de integración con Testcontainers
- Migraciones: verificar up/down sin errores
- sqlc: verificar que genera código sin errores

## Definition of Done

- [ ] `docker compose up` levanta todos los servicios sin errores
- [ ] `GET /health` retorna 200 con estado de DB
- [ ] `go build ./...` compila sin errores
- [ ] `go test ./...` pasa (al menos el health check)
- [ ] `golangci-lint run` sin warnings
- [ ] `sqlc generate` genera código sin errores
- [ ] Migraciones up/down funcionan
- [ ] CI verde en GitHub Actions
