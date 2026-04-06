# Guía de Desarrollo — BlendPadel

> Manual operativo para trabajar con OPSX y Claude Code en este proyecto.
> Equipo: Juani (Orquestador) + Claude (Desarrollador Full Stack)

## 1. Configuración Inicial

### Prerrequisitos

```bash
# Go
go version  # debe ser 1.22+

# Node
node --version  # debe ser 20+
pnpm --version

# Docker
docker --version
docker compose version

# Herramientas Go
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Expo
npx expo --version
```

### Setup del entorno

```bash
# 1. Clonar y configurar
cp .env.example .env
# Editar .env con valores locales

# 2. Levantar DB local (si no usás Docker)
# Asegurate de tener PostgreSQL con PostGIS
createdb blendpadel
psql blendpadel -c "CREATE EXTENSION postgis;"

# 3. Correr migraciones
migrate -path backend/migrations -database "$DATABASE_URL" up

# 4. Generar código sqlc
cd backend && sqlc generate
```

## 2. Flujo de Trabajo Diario

El ciclo completo para implementar cualquier funcionalidad:

### Paso 1 — Planificar

```
/opsx:propose
Planificar: [descripción de lo que querés hacer].
Referencia: [contexto o historia de usuario].
```

Claude genera: proposal → design → tasks → specs.

### Paso 2 — Implementar

```
/opsx:apply
Implementar los tasks pendientes del cambio [nombre].
```

Claude implementa task por task, marcando cada uno como completado.

### Paso 3 — Verificar

```
/opsx:verify
Verificar que la implementación del cambio [nombre] cumple con los specs.
```

### Paso 4 — Subir

```bash
# Branch por feature
git checkout -b feature/epic-{NN}/{descripcion-corta}

# Commits con Conventional Commits
git add -A
git commit -m "feat(ranking): add ELO calculation engine"

# Push y PR
git push -u origin feature/epic-{NN}/{descripcion-corta}
# Crear PR a main
```

### Paso 5 — Cerrar

```
/opsx:archive
Archivar el cambio [nombre] después del merge.
```

## 3. Prompts Útiles

### Explorar antes de implementar

```
/opsx:explore
Investigar cómo implementar [tema]. Contexto: [lo que sabés].
```

### Proponer un cambio rápido

```
/opsx:ff [nombre-del-cambio]
```
Genera todos los artifacts (proposal → design → tasks → specs) de una sola vez.

### Verificar estado actual

```
¿En qué estado están los cambios OPSX activos?
```

## 4. Reglas que SIEMPRE se respetan

### Antes de escribir código

- [ ] ¿Existe un cambio OPSX planificado para esto?
- [ ] ¿Leí el spec/design antes de implementar?
- [ ] ¿El dominio donde voy a trabajar está claro? (player, match, ranking, trust, auth, admin)

### Durante el desarrollo

- [ ] ¿Estoy escribiendo tests ANTES del código para ELO, Trust Score y validación cruzada?
- [ ] ¿Los tests de integración usan Testcontainers (Postgres real)?
- [ ] ¿Las queries sqlc listan columnas explícitamente (no SELECT *)?
- [ ] ¿Los errores se wrappean con contexto? (`fmt.Errorf("operation: %w", err)`)
- [ ] ¿El handler NO tiene lógica de negocio? (solo parsea request → llama service → devuelve response)

### Para subir código

- [ ] `go vet ./...` sin errores
- [ ] `golangci-lint run` sin warnings
- [ ] `go test ./...` pasa
- [ ] Commit message sigue Conventional Commits
- [ ] Branch nombrada como `feature/epic-{NN}/{descripcion}`

### Al hacer pull de main

- [ ] Correr migraciones: `migrate -path backend/migrations -database "$DATABASE_URL" up`
- [ ] Regenerar sqlc: `cd backend && sqlc generate`
- [ ] Reinstalar deps si cambió go.mod: `go mod download`

## 5. Orden de Ejecución — Primeros Pasos

Lo primero que hay que hacer, HOY:

### Paso 1: Infraestructura base

```
/opsx:propose
Planificar EPIC 00 — Infraestructura. Configurar: Docker Compose con Caddy + PostgreSQL + PostGIS,
estructura de carpetas del backend Go con Chi, módulo go.mod, Dockerfile,
primera migración (tabla players con PostGIS), health check endpoint.
```

### Paso 2: Auth completo

```
/opsx:propose
Planificar EPIC 01 — Auth. Registro con email/password, login con JWT (1h access, 30d refresh),
refresh token rotation, middleware RBAC (SuperAdmin, Moderador, Jugador),
rate limiting en login (5 intentos/15min in-memory).
```

### Paso 3: Core Domain — ELO + Trust

```
/opsx:propose
Planificar EPIC 02 — Motor ELO y Trust Score. Fórmula ELO con K-factor adaptativo
(K=60 primeros 5 partidos, K=20 después), margen de victoria, probabilidad esperada.
Trust Score con penalización por cancelación tardía (<2h) y reportes de conducta.
TDD estricto para este dominio.
```

### Paso 4: Match + Validación Cruzada

```
/opsx:propose
Planificar EPIC 03 — Partidos y Validación Cruzada. Crear partido, cargar resultado (Capitán A),
push notification a Capitán B, ventana de 6 horas para objetar,
auto-validación si no hay objeción, congelamiento de puntaje en caso de disputa sistemática.
```
