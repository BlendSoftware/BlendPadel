# Design: EPIC 00 — Infraestructura y Setup

## Context

Proyecto greenfield. Stack definido: Go 1.22+ con Chi, PostgreSQL 16 + PostGIS, sqlc, golang-migrate. Infraestructura on-premise con Docker Compose y Caddy. Monorepo con 3 apps (backend, mobile, admin) pero esta EPIC solo toca el backend.

El equipo es 1 persona (Juani, orquestador) + Claude (desarrollador). La arquitectura debe ser hiper-modular: archivos cortos, dominios aislados, interfaces claras.

## Goals

- Backend Go compilando y respondiendo en `GET /health`
- PostgreSQL con PostGIS corriendo en Docker
- Migraciones automáticas al iniciar el servidor
- sqlc generando código desde queries SQL
- CI validando lint, tests y build en cada push
- Docker Compose listo para desarrollo local y producción

## Non-Goals

- Implementar lógica de negocio (se hace en EPICs posteriores)
- Configurar frontend (mobile ni admin)
- Configurar HTTPS en producción (Caddy lo hace, pero el certificado real necesita dominio)
- Optimizar performance (es setup inicial)

## Decisions

### D1: Chi sobre stdlib puro
**Decisión**: Usar Chi como router HTTP.
**Razón**: Chi es un wrapper minimalista sobre `net/http` de Go. No agrega magia, no tiene dependencias pesadas. Soporta middleware chainable, parámetros de ruta, y groups. La alternativa (stdlib puro con `http.NewServeMux` de Go 1.22) es viable pero Chi ahorra boilerplate en middleware y routing sin sacrificar control.
**Trade-off**: Una dependencia extra, pero es estable, mantenida, y ampliamente usada.

### D2: zerolog para logging estructurado
**Decisión**: Usar zerolog como logger.
**Razón**: JSON structured logging desde el día 1. Zero-allocation, performance extrema. Se integra con Chi via `chi/middleware`. La alternativa (slog de stdlib) es más nueva y tiene menos ecosystem.
**Trade-off**: Dependencia externa vs slog nativo. zerolog es más maduro para JSON logging.

### D3: Migraciones embebidas en el binario
**Decisión**: golang-migrate con archivos SQL embebidos via `embed.FS`.
**Razón**: El servidor ejecuta migraciones automáticamente al iniciar. No necesita CLI externo en producción. Los archivos SQL son versionados en el repo.
**Trade-off**: Si una migración falla, el servidor no arranca. Esto es intencional: mejor fallar rápido que correr con schema inconsistente.

### D4: Estructura domain-driven con platform/
**Decisión**: Dominios en `internal/{nombre}/` + cross-cutting en `internal/platform/`.
**Razón**: Cada dominio (player, match, ranking, trust, auth, admin, notification) es una carpeta aislada con handler, service, repository y model. `platform/` contiene lo transversal: config, database, middleware, response helpers.
**Trade-off**: En esta EPIC los dominios están vacíos (solo se crean los directorios). Se llenan en EPICs posteriores.

### D5: RFC 7807 Problem Details para errores
**Decisión**: Todos los errores HTTP retornan JSON con formato RFC 7807.
**Razón**: Estándar de la industria. Estructura predecible para el frontend: `type`, `title`, `status`, `detail`, `instance`.
**Trade-off**: Un poco más de boilerplate que un `{"error": "message"}` simple, pero escala mejor.

### D6: Caddy como reverse proxy
**Decisión**: Caddy en Docker Compose como reverse proxy con HTTPS automático.
**Razón**: Caddy genera certificados Let's Encrypt automáticamente en 3 líneas de config. En desarrollo hace reverse proxy sin SSL. No necesita renovación manual de certificados.
**Trade-off**: Un container extra. Pero en producción es obligatorio tener un reverse proxy, y Caddy es el más simple.

### D7: PostgreSQL 16 con PostGIS via postgis/postgis image
**Decisión**: Usar la imagen `postgis/postgis:16-3.4-alpine` en vez de `postgres:16-alpine` + instalación manual.
**Razón**: La imagen oficial de PostGIS viene con la extensión precompilada. Solo hay que hacer `CREATE EXTENSION postgis` en la migración.
**Trade-off**: Imagen más pesada (~200MB vs ~80MB), pero evita errores de compilación de PostGIS.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Migraciones fallan al iniciar → servidor no arranca | Intencional. Verificar con `migrate down` antes de deploy. CI ejecuta migraciones en tests. |
| sqlc no soporta tipos PostGIS nativamente | Usar pgx/v5 como driver. sqlc genera `interface{}` para tipos desconocidos, castear manualmente. |
| Caddy consume recursos en VPS chico | Caddy es muy liviano (~20MB RAM). No es un problema real. |

## Migration Plan

No aplica (greenfield).

## Open Questions

Ninguna. Stack y decisiones cerradas en la entrevista de bootstrap.
