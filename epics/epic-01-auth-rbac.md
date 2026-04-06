# EPIC 01 — Autenticación y RBAC

> **Sprint**: 1
> **Prioridad**: Alta
> **Dependencias**: EPIC 00
> **Historias**: US-006, US-007, US-008, US-009, US-010, US-011

---

## Objetivo

Implementar el sistema completo de autenticación con JWT propio y control de acceso basado en roles (RBAC). Al terminar esta EPIC, los usuarios pueden registrarse, loguearse, renovar tokens, y el sistema controla el acceso según el rol (Jugador, Moderador, SuperAdmin).

## Contexto

Auth es el segundo pilar del proyecto. Todo endpoint protegido depende de esta EPIC. El JWT es propio (no Auth0 ni Firebase Auth), con refresh token rotation para seguridad y 1h/30d de TTL para UX mobile.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| AU-01 | Registro: email único, password min 8 chars, 1 mayúscula, 1 número |
| AU-02 | Access token 1h, refresh token 30d con rotation |
| AU-03 | Rate limiting: 5 intentos/15min por IP en login |
| AU-04 | RBAC: SuperAdmin > Moderador (region-scoped) > Jugador |
| AU-05 | Token family invalidation ante reuso de refresh token |

## Historias de Usuario

### US-006: Registro de jugador
- `POST /auth/register` — email, password, nombre
- bcrypt cost 10, Trust Score inicial 80, estado `calibration`
- No retornar tokens (forzar login)

### US-007: Login y emisión de JWT
- `POST /auth/login` — retorna access_token (1h) + refresh_token (30d)
- HS256, claims: sub (user_id), role, region_id (moderadores), exp
- Refresh token almacenado como hash SHA-256 en DB

### US-008: Renovación de tokens con refresh rotation
- `POST /auth/refresh` — emite nuevo par de tokens, invalida anterior
- Token family invalidation: si se detecta reuso → revocar toda la familia
- `POST /auth/logout` — revoca refresh token

### US-009: Rate limiting en login
- 5 intentos fallidos / 15 min por IP → HTTP 429
- In-memory con sync.Mutex + map + goroutine de limpieza
- Header `X-RateLimit-Remaining` en respuestas

### US-010: Middleware RBAC
- `RequireRole(roles ...string)` — middleware Chi
- `RequireRegion()` — verifica region_id del Moderador
- Helpers: `IsAdmin(ctx)`, `IsModerator(ctx)`, `GetRegionID(ctx)`

### US-011: Cambio de contraseña
- `PUT /auth/password` — requiere current_password
- Al cambiar: revocar todos los refresh tokens del usuario

## Enfoque Técnico

### Tablas (migración)
```sql
-- Refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(64) NOT NULL, -- SHA-256
    family_id UUID NOT NULL, -- Para token family invalidation
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
```

### Estructura del dominio auth/
```
internal/auth/
├── handler.go      # Handlers: Register, Login, Refresh, Logout, ChangePassword
├── service.go      # Lógica: crear usuario, verificar credentials, emitir tokens
├── jwt.go          # Generación y validación de JWT (HS256)
├── middleware.go    # AuthMiddleware, RequireRole, RequireRegion
├── repository.go   # Interface
├── postgres.go     # Implementación: users, refresh_tokens
└── model.go        # DTOs: RegisterRequest, LoginResponse, etc.
```

### Rate Limiter
```go
// In-memory rate limiter con ventana deslizante
type RateLimiter struct {
    mu       sync.Mutex
    attempts map[string][]time.Time // IP → timestamps
    limit    int                     // 5
    window   time.Duration           // 15 min
}
```

## Testing

- **TDD**: NO (no es core domain)
- **Tests de integración**: Testcontainers para registro, login, refresh, RBAC
- **Tests unitarios**: rate limiter, JWT generation/validation

## Definition of Done

- [ ] Registro crea usuario con bcrypt y Trust Score 80
- [ ] Login retorna JWT válido con claims correctos
- [ ] Refresh rotation funciona, family invalidation detecta reuso
- [ ] Rate limiter bloquea después de 5 intentos
- [ ] RBAC middleware bloquea acceso no autorizado
- [ ] Cambio de password revoca tokens
- [ ] Tests de integración pasan con Testcontainers
