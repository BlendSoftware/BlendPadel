# Verify Report: EPIC 01 — Autenticación y RBAC

## Status: PASSED

## Checklist vs Definition of Done

| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| Registro crea usuario con bcrypt y Trust Score 80 | PASS | POST /auth/register → 201, trust_score: 80, status: calibration |
| Login retorna JWT válido con claims correctos | PASS | POST /auth/login → 200 con access_token (HS256) y refresh_token |
| Refresh rotation funciona, family invalidation detecta reuso | PASS | TestIntegration_Refresh_TokenReuse_Returns401_AndRevokesFamiy PASS |
| Rate limiter bloquea después de 5 intentos | PASS | TestIntegration_RateLimit_Returns429OnSixthAttempt PASS |
| RBAC middleware bloquea acceso no autorizado | PASS | TestMiddleware_RequireRole_Forbidden / TestMiddleware_RequireRole_Allowed PASS |
| Cambio de password revoca tokens | PASS | TestIntegration_ChangePassword_RevokesTokens PASS |
| Tests de integración pasan con Testcontainers | PASS | 10 integration tests PASS (postgis/postgis:15-3.3) |

## Test Results

### Unit Tests (16 total)
- JWT: 5 tests (generate, validate, expired, bad signature, claims)
- RateLimiter: 5 tests (allow, block, window expiry, reset, cleanup)
- Password validation: 4+ tests via table-driven
- Middleware: 3 tests (no token, valid token, role check)

### Integration Tests (10 total)
- Register success → 201
- Register duplicate email → 409
- Register weak password → 422
- Login success → 200 + tokens
- Login bad credentials → 401
- Refresh success → new tokens
- Refresh token reuse → 401 + family revoked
- Logout → token revoked
- Change password → tokens revoked
- Rate limit → 429 on 6th attempt

### Build
- `go build ./...` ✓
- `go test ./...` ✓ (all pass)
- `sqlc generate` ✓

### Manual Verification (Docker)
- POST /auth/register → 201 ✓
- POST /auth/login → 200 + tokens ✓
- POST /auth/refresh → 200 + new tokens ✓
- PUT /auth/password → 200 + old tokens revoked ✓
- Duplicate email → 409 ✓
- Weak password → 422 with field errors ✓
- Rate limiting activates correctly ✓

## Files Created (15)

| File | Purpose |
|------|---------|
| `internal/auth/model.go` | DTOs: RegisterRequest, LoginRequest, LoginResponse, Claims |
| `internal/auth/errors.go` | 8 domain errors |
| `internal/auth/jwt.go` | JWTManager: HS256 generate/validate |
| `internal/auth/jwt_test.go` | 5 unit tests |
| `internal/auth/ratelimiter.go` | In-memory sliding window limiter |
| `internal/auth/ratelimiter_test.go` | 5 unit tests |
| `internal/auth/repository.go` | Interface (10 methods) |
| `internal/auth/postgres.go` | sqlc-backed implementation |
| `internal/auth/service.go` | Register/Login/Refresh/Logout/ChangePassword |
| `internal/auth/service_test.go` | Password validation tests |
| `internal/auth/middleware.go` | AuthMiddleware, RequireRole, RequireRegion, helpers |
| `internal/auth/middleware_test.go` | 3 middleware tests |
| `internal/auth/handler.go` | 5 HTTP handlers with RFC 7807 |
| `internal/auth/routes.go` | Chi route registration |
| `internal/auth/integration_test.go` | 10 integration tests |

## Migrations
- `000002_auth.up.sql` — ALTER users ADD name/trust_score + CREATE refresh_tokens
- `000002_auth.down.sql` — rollback

## Notes
- Rate limiter middleware applies to both register AND login endpoints (by design)
- Token family invalidation uses `GetRefreshTokenByHashAny` (no filter) for reuse detection
- main.go falls back gracefully with insecure JWT secret when env var is missing (warns in log)
