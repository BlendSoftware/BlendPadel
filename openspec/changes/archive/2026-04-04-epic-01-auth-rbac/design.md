# Design: EPIC 01 — Autenticación y RBAC

## Context

EPIC 00 completada. Backend Go con Chi compilando, PostgreSQL con PostGIS corriendo en Docker, migraciones funcionando, health check activo. El dominio `internal/auth/` está vacío (scaffolding).

Stack auth decidido en bootstrap: JWT propio con `golang-jwt/jwt/v5`, HS256, bcrypt cost 10, refresh token rotation con family invalidation, rate limiting in-memory.

Skill `jwt-auth-rbac` aplicado: token rotation pattern, fail-closed principle, RBAC con strategy adaptado a Go.

## Goals

- Registro, login, refresh y logout funcionales
- JWT con claims correctos para RBAC
- Refresh token rotation con detección de reuso
- Rate limiting funcional en login
- Middleware RBAC que protege endpoints por rol y región
- Cambio de contraseña con revocación de sesiones

## Non-Goals

- OAuth / login social (futuro)
- Reset de contraseña por email (futuro, necesita EPIC 10 — notificaciones)
- Frontend auth flow (se implementa en EPICs de mobile/admin)
- MFA / 2FA (futuro)

## Decisions

### D1: HS256 sobre RS256
**Decisión**: Usar HS256 (clave simétrica) para firmar JWT.
**Razón**: Un solo backend, una sola clave. RS256 tiene sentido cuando múltiples servicios validan tokens sin compartir la clave privada. Con un monolito Go, HS256 es más simple y performante.
**Trade-off**: Si en el futuro se separan microservicios, migrar a RS256. Por ahora, YAGNI.

### D2: Refresh token opaco (no JWT)
**Decisión**: El refresh token es un string random de 32 bytes (base64), NO un JWT.
**Razón**: El refresh token se valida siempre contra DB (para detectar revocación y reuso). No necesita ser autocontenido. Un string opaco es más simple y no lleva claims que puedan leakearse.
**Trade-off**: Requiere lookup a DB en cada refresh. Aceptable porque el refresh ocurre cada 1h, no en cada request.

### D3: Token family para detección de reuso
**Decisión**: Cada cadena de refresh tokens comparte un `family_id` (UUID). Al rotar, el nuevo token hereda el family_id. Si se reutiliza un token ya rotado, se revoca toda la familia.
**Razón**: Patrón estándar del skill `jwt-auth-rbac`. Detecta robo de tokens: si un atacante usa un refresh token que el usuario legítimo ya rotó, el sistema detecta el reuso y fuerza logout de ambos.
**Trade-off**: Complejidad adicional en la tabla `refresh_tokens`. Vale la pena por la seguridad.

### D4: Rate limiter in-memory con cleanup goroutine
**Decisión**: Rate limiter con `sync.Mutex` + `map[string][]time.Time` + goroutine que limpia entries expiradas cada minuto.
**Razón**: Sin Redis en el MVP. Un rate limiter in-memory es suficiente para un solo proceso Go. La goroutine de limpieza previene memory leaks.
**Trade-off**: No funciona con múltiples instancias. Si se escala horizontalmente, migrar a Redis. Para MVP single-instance, perfecto.

### D5: Password validation en el service, no en el handler
**Decisión**: La validación de complejidad de password (min 8, 1 mayúscula, 1 número) se hace en el service layer, no en el handler.
**Razón**: El handler solo parsea el request. La regla de negocio AU-01 vive en el service. Si mañana cambian los requisitos (ej: agregar caracteres especiales), se modifica un solo lugar.

### D6: RBAC con middleware Chi, no con strategy pattern
**Decisión**: RBAC implementado como middleware Chi (`RequireRole`, `RequireRegion`) en vez del strategy pattern del skill.
**Razón**: El skill propone el strategy pattern para un sistema con muchos roles y permisos granulares (restaurantes). BlendPadel tiene 3 roles con permisos claros por ruta. Middleware directo es más simple y idiomático en Go/Chi.
**Trade-off**: Si los permisos se vuelven granulares en el futuro, refactorizar a strategy. Por ahora, middleware es suficiente.

### D7: Bcrypt cost 10 (no 12)
**Decisión**: bcrypt cost 10 como se decidió en bootstrap.
**Razón**: El skill recomienda 12, pero el usuario definió 10 en la entrevista. Cost 10 es ~65ms por hash, cost 12 es ~260ms. Para mobile en cancha con señal débil, la latencia extra no vale en un MVP.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| JWT secret débil → tokens forjados | Generar secret de 256 bits mínimo. Documentar en .env.example. |
| Rate limiter in-memory no persiste entre reinicios | Aceptable: un reinicio resetea el rate limit. No es un vector de ataque real. |
| Token family invalidation falla en edge cases | Tests exhaustivos para: rotación normal, reuso simple, reuso doble, revocación masiva. |
| bcrypt cost 10 insuficiente en hardware futuro | Monitorear. Migrar a cost 12 o argon2id cuando el MVP escale. |

## Migration Plan

### Migración 000002_auth.up.sql
```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    family_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

## Open Questions

Ninguna. Todas las decisiones cerradas entre bootstrap y esta EPIC.
