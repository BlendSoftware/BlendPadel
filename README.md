# BlendPadel

Motor de Reputación y Ranking del Pádel Informal en Mendoza. Sistema ELO adaptado, Trust Score, matchmaking geolocalizado y validación cruzada de resultados.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22+ / Chi router / sqlc |
| Mobile | React Native + Expo + TypeScript + NativeWind |
| Admin Panel | React + Vite + TailwindCSS |
| Database | PostgreSQL 16 + PostGIS |
| Auth | JWT propio (golang-jwt) |
| Push | Firebase Cloud Messaging |
| Infra | Docker Compose + Caddy + VPS propio |

## Prerrequisitos

- Go 1.22+
- Node.js 20+ / pnpm
- Docker + Docker Compose
- PostgreSQL 16 con PostGIS (o usar el container)
- Expo CLI (`npx expo`)
- golang-migrate CLI
- sqlc CLI

## Setup

### Backend

```bash
cd backend
cp ../.env.example ../.env  # editar con valores locales
go mod download
go run cmd/server/main.go
```

### Mobile

```bash
cd mobile
pnpm install
npx expo start
```

### Admin

```bash
cd admin
pnpm install
pnpm dev
```

### Docker (producción)

```bash
cd docker
docker compose up -d
```

## Variables de Entorno

Copiar `.env.example` a `.env` y completar con valores locales. Ver comentarios en el archivo para cada variable.

## Estructura del Proyecto

```
BlendPadel/
├── backend/          # API Go (Chi + sqlc)
│   ├── cmd/server/   # Entrypoint
│   ├── internal/     # Dominios: player, match, ranking, trust, auth, admin, notification
│   ├── migrations/   # SQL migrations (golang-migrate)
│   └── queries/      # sqlc SQL queries
├── mobile/           # React Native + Expo
│   └── src/features/ # radar, matchmaking, rankings, profile, auth
├── admin/            # React + Vite + Tailwind (dashboard admin)
│   └── src/features/ # dashboard, disputes, players, moderation
├── docker/           # Docker Compose + Caddyfile
└── docs/             # Documentación
```

## Dominios del Backend

| Dominio | Responsabilidad |
|---------|----------------|
| `player` | Registro, perfil, onboarding anti-humo |
| `match` | Partidos, validación cruzada de resultados |
| `ranking` | Cálculo ELO, leaderboards hiper-locales |
| `trust` | Trust Score, penalizaciones, congelamiento |
| `auth` | JWT, login, refresh token rotation, RBAC |
| `admin` | Panel admin, baneos, auditoría, recalibraciones |
| `notification` | Push notifications via FCM |
| `platform` | Config, DB, middleware, response helpers, storage |

## Roles (RBAC)

| Rol | Permisos |
|-----|----------|
| SuperAdmin | Acceso total: métricas, KPIs, baneos, crear moderadores |
| Moderador | Region-scoped: auditar partidos y disputas de su zona |
| Jugador | Usuario estándar: jugar, ver rankings, gestionar perfil |

Ver `CLAUDE.md` para convenciones completas de desarrollo.
