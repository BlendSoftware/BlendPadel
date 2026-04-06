# Proposal: EPIC 00 — Infraestructura y Setup

## Why

BlendPadel es un proyecto greenfield. No hay código, no hay infraestructura, no hay base de datos. Cada EPIC posterior (Auth, ELO, Partidos, Radar, etc.) depende de que exista una base técnica funcional: un backend Go que compile, una base de datos PostgreSQL con PostGIS, un sistema de migraciones, un pipeline CI, y una infraestructura Docker lista para desplegar en el VPS propio.

Sin esta EPIC, no se puede escribir ni una sola línea de código de negocio.

## What Changes

### Infraestructura Docker (US-001)
- Docker Compose con 3 servicios: `api` (Go binary), `postgres` (16-alpine + PostGIS), `caddy` (2-alpine reverse proxy)
- Red interna `blendpadel-net` para comunicación entre servicios
- Volúmenes persistentes: `postgres-data` para la DB, `uploads` para avatares
- Caddyfile con reverse proxy a la API y HTTPS automático via Let's Encrypt
- Restart policy `unless-stopped` en todos los servicios

### Base de Datos con PostGIS (US-002)
- PostgreSQL 16 con extensión PostGIS habilitada en la migración inicial
- Soporte para tipos `GEOGRAPHY(Point, 4326)` y `GEOGRAPHY(Polygon, 4326)`
- Índice GIST preparado para queries geoespaciales
- Tablas base: `users` (con role y status) y `regions` (con boundary geográfico)

### Proyecto Go con Chi y sqlc (US-003)
- Estructura domain-driven: `cmd/server/`, `internal/{dominios}/`, `internal/platform/`
- Chi como router HTTP con middleware base: logging (zerolog), recovery, request-id, CORS
- sqlc configurado para generar código Go type-safe desde queries SQL puras
- Health check endpoint `GET /health` que verifica conexión a DB
- RFC 7807 (Problem Details) como formato estándar de errores

### Pipeline CI (US-004)
- GitHub Actions: lint (golangci-lint), test (con Postgres service container), build
- Cache de módulos Go para acelerar pipeline
- Build de imagen Docker en push a main

### Sistema de Migraciones (US-005)
- golang-migrate integrado al binario del servidor
- Archivos en `backend/migrations/NNNN_descripcion.{up,down}.sql`
- Migración inicial: PostGIS extension + tablas `users` y `regions`
- Rollback funcional para cada migración

## Capabilities

### New
- Infraestructura Docker completa lista para desarrollo y producción
- Backend Go funcional con health check
- Base de datos PostgreSQL con soporte geoespacial
- Generación de código type-safe con sqlc
- Pipeline CI automatizado
- Sistema de migraciones versionado

### Modified
- Ninguna (proyecto greenfield)

## Impact

- **Scope**: Exclusivamente backend e infraestructura. No se toca frontend (mobile ni admin).
- **Risk**: Bajo. Es setup estándar, sin lógica de negocio compleja.
- **Bloqueante**: Esta EPIC es prerrequisito de TODO lo demás. EPIC 01 (Auth) no puede arrancar sin esto.
