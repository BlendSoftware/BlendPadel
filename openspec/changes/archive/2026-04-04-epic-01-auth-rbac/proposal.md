# Proposal: EPIC 01 — Autenticación y RBAC

## Why

Todo endpoint protegido de BlendPadel depende de autenticación. Sin auth no hay registro, no hay login, no hay control de quién carga un resultado, quién modera una disputa o quién banea a un jugador. Es el segundo pilar después de la infraestructura.

El JWT es propio (sin Auth0 ni Firebase Auth) porque:
- El backend es Go puro en VPS propio — no dependemos de servicios externos
- Necesitamos control total del RBAC con 3 niveles (SuperAdmin, Moderador region-scoped, Jugador)
- Los TTL están optimizados para mobile en cancha con mala señal (1h access, 30d refresh)

## What Changes

### Registro de jugador (US-006)
- `POST /auth/register` con email, password, nombre
- Password hasheado con bcrypt cost 10
- Trust Score inicial 80, estado `calibration`
- No retorna tokens — fuerza flujo de login separado

### Login y JWT (US-007)
- `POST /auth/login` retorna access_token (JWT HS256, 1h) + refresh_token (opaco, 30d)
- Claims del JWT: `sub` (user_id), `role`, `region_id` (solo moderadores), `exp`
- Refresh token almacenado como hash SHA-256 en DB (nunca en texto plano)

### Refresh token rotation (US-008)
- `POST /auth/refresh` emite nuevo par, invalida el anterior
- Token family invalidation: si se detecta reuso de un refresh token ya rotado → revocar TODA la familia (logout forzado por posible robo)
- `POST /auth/logout` revoca el refresh token actual

### Rate limiting login (US-009)
- 5 intentos fallidos / 15 min por IP → HTTP 429 con header `Retry-After`
- In-memory con sync.Mutex + map + goroutine de limpieza periódica
- Login exitoso resetea el contador

### Middleware RBAC (US-010)
- `RequireRole(roles ...string)` — middleware Chi que verifica rol del JWT
- `RequireRegion()` — verifica que el Moderador accede solo a recursos de su región
- Helpers: `IsAdmin(ctx)`, `IsModerator(ctx)`, `GetRegionID(ctx)`, `GetUserID(ctx)`

### Cambio de contraseña (US-011)
- `PUT /auth/password` con current_password y new_password
- Al cambiar: revoca TODOS los refresh tokens del usuario (sesión única)

## Capabilities

### New
- Sistema de autenticación JWT propio con refresh rotation
- Token family invalidation para detección de robo
- Rate limiting in-memory para login
- Middleware RBAC con 3 niveles de acceso
- Tabla `refresh_tokens` con family tracking
- Migración 000002_auth

### Modified
- Tabla `users`: ya existe (EPIC 00), no se modifica en esta EPIC

## Impact

- **Scope**: Backend Go exclusivamente. Dominio `internal/auth/`.
- **Risk**: Medio. Auth es security-critical — errores acá comprometen todo el sistema. Mitigamos con tests exhaustivos.
- **Bloqueante**: EPIC 02 (Onboarding), EPIC 09 (Admin) y EPIC 10 (Push) dependen de auth.
- **Skill aplicado**: `jwt-auth-rbac` — token rotation, fail-closed, RBAC strategy pattern adaptado a Go.
