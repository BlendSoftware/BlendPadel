# Tasks: EPIC 01 — Autenticación y RBAC

> Cada task es atómico (5-30 min). Ejecutar en orden.
> Skills aplicados: jwt-auth-rbac (token rotation, RBAC), go-testing (testify + testcontainers)

---

## 1. Migración y sqlc para auth

- [x] 1.1 Crear `backend/migrations/000002_auth.up.sql`:
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
- [x] 1.2 Crear `backend/migrations/000002_auth.down.sql`:
  ```sql
  DROP TABLE IF EXISTS refresh_tokens;
  ```
- [x] 1.3 Crear queries sqlc para users: `queries/users.sql`
  - `CreateUser` (INSERT email, password_hash, role, status, trust_score → RETURNING *)
  - `GetUserByEmail` (SELECT * WHERE email = $1)
  - `GetUserByID` (SELECT * WHERE id = $1)
  - `UpdateUserPassword` (UPDATE password_hash WHERE id = $1)
- [x] 1.4 Crear queries sqlc para refresh tokens: `queries/refresh_tokens.sql`
  - `CreateRefreshToken` (INSERT user_id, token_hash, family_id, expires_at)
  - `GetRefreshTokenByHash` (SELECT * WHERE token_hash = $1 AND revoked = false AND expires_at > NOW())
  - `RevokeRefreshToken` (UPDATE SET revoked = true WHERE id = $1)
  - `RevokeTokenFamily` (UPDATE SET revoked = true WHERE family_id = $1)
  - `RevokeAllUserTokens` (UPDATE SET revoked = true WHERE user_id = $1)
- [x] 1.5 Ejecutar `sqlc generate` y verificar código generado
- [x] 1.6 Verificar migración: aplicar up, verificar tabla, aplicar down, verificar rollback

## 2. Modelos y DTOs del dominio auth

- [x] 2.1 Crear `internal/auth/model.go`:
  - `RegisterRequest` (Email, Password, Name string)
  - `LoginRequest` (Email, Password string)
  - `LoginResponse` (AccessToken, RefreshToken string, ExpiresIn int64)
  - `RefreshRequest` (RefreshToken string)
  - `ChangePasswordRequest` (CurrentPassword, NewPassword string)
  - `Claims` struct que embebe `jwt.RegisteredClaims` + Role, RegionID
- [x] 2.2 Crear `internal/auth/errors.go`:
  - Errores de dominio: `ErrInvalidCredentials`, `ErrEmailTaken`, `ErrTokenExpired`, `ErrTokenReused`, `ErrWeakPassword`, `ErrForbidden`, `ErrRegionMismatch`

## 3. JWT — generación y validación

- [x] 3.1 Crear `internal/auth/jwt.go`:
  - `type JWTManager struct` con secretKey y accessTTL
  - `NewJWTManager(secretKey string, accessTTL time.Duration) *JWTManager`
  - `GenerateAccessToken(userID uuid.UUID, role string, regionID *uuid.UUID) (string, error)` — HS256 con claims sub, role, region_id, exp
  - `ValidateToken(tokenString string) (*Claims, error)` — parsea y valida
- [x] 3.2 Crear `internal/auth/jwt_test.go`:
  - Test: generar token → validar → claims correctos
  - Test: token expirado → error
  - Test: token con firma inválida → error
  - Test: claims contienen role y region_id correctos

## 4. Rate limiter in-memory

- [x] 4.1 Crear `internal/auth/ratelimiter.go`:
  - `type RateLimiter struct` con sync.Mutex, map[string][]time.Time, limit (5), window (15min)
  - `NewRateLimiter(limit int, window time.Duration) *RateLimiter`
  - `Allow(ip string) (allowed bool, remaining int, retryAfter time.Duration)`
  - `Reset(ip string)` — llamado en login exitoso
  - Goroutine de cleanup cada 1 minuto que elimina entries con timestamps > window
- [x] 4.2 Crear `internal/auth/ratelimiter_test.go`:
  - Test: primeros 5 intentos → permitidos, remaining decrementa
  - Test: sexto intento → bloqueado, retryAfter > 0
  - Test: después de window → permitido de nuevo
  - Test: Reset limpia el contador de la IP
  - Test: cleanup goroutine no leakea (cerrar con context)

## 5. Service layer — registro

- [x] 5.1 Crear `internal/auth/repository.go` — interface:
  - `CreateUser(ctx, email, passwordHash, name string) (*db.User, error)`
  - `GetUserByEmail(ctx, email string) (*db.User, error)`
  - `GetUserByID(ctx, userID uuid.UUID) (*db.User, error)`
  - `UpdatePassword(ctx, userID uuid.UUID, newHash string) error`
  - `CreateRefreshToken(ctx, userID uuid.UUID, tokenHash string, familyID uuid.UUID, expiresAt time.Time) error`
  - `GetRefreshToken(ctx, tokenHash string) (*db.RefreshToken, error)`
  - `RevokeToken(ctx, tokenID uuid.UUID) error`
  - `RevokeTokenFamily(ctx, familyID uuid.UUID) error`
  - `RevokeAllUserTokens(ctx, userID uuid.UUID) error`
- [x] 5.2 Crear `internal/auth/postgres.go` — implementación con sqlc queries
- [x] 5.3 Crear `internal/auth/service.go`:
  - `type Service struct` con repo, jwtManager, rateLimiter
  - `Register(ctx, req RegisterRequest) (*db.User, error)`:
    - Validar password (min 8, 1 upper, 1 digit)
    - Verificar email no existe
    - Hash con bcrypt cost 10
    - Crear user con Trust Score 80, status calibration
- [x] 5.4 Test unitario para validación de password (tabla de casos)

## 6. Service layer — login y tokens

- [x] 6.1 Implementar `Login(ctx, req LoginRequest, ip string) (*LoginResponse, error)`:
  - Check rate limit → si bloqueado, retornar error con retryAfter
  - Buscar user por email
  - Comparar password con bcrypt
  - Si falla → no resetear rate limit, retornar ErrInvalidCredentials
  - Si OK → resetear rate limit, generar access token + refresh token
  - Refresh token: generar 32 bytes random, hashear SHA-256, guardar en DB con family_id nuevo
  - Retornar LoginResponse con tokens
- [x] 6.2 Implementar `Refresh(ctx, req RefreshRequest) (*LoginResponse, error)`:
  - Hashear el refresh token recibido con SHA-256
  - Buscar en DB por hash
  - Si no existe o revocado → ErrTokenExpired
  - Si revocado Y el family tiene tokens activos → TOKEN REUSE DETECTED → revocar toda la familia
  - Revocar el token actual
  - Generar nuevo par (access + refresh) con el MISMO family_id
  - Retornar LoginResponse
- [x] 6.3 Implementar `Logout(ctx, refreshToken string) error`:
  - Hashear, buscar en DB, revocar
- [x] 6.4 Implementar `ChangePassword(ctx, userID uuid.UUID, req ChangePasswordRequest) error`:
  - Buscar user, verificar current password con bcrypt
  - Validar new password
  - Hash new password, update en DB
  - Revocar todos los refresh tokens del usuario

## 7. Middleware — auth y RBAC

- [x] 7.1 Crear `internal/auth/middleware.go`:
  - `AuthMiddleware(jwtManager *JWTManager) func(http.Handler) http.Handler`:
    - Extraer `Authorization: Bearer {token}`
    - Validar con jwtManager
    - Inyectar claims en context
  - `RequireRole(roles ...string) func(http.Handler) http.Handler`:
    - Extraer claims del context
    - Verificar que role está en la lista permitida
    - Si no → 403 Problem Detail
  - `RequireRegion() func(http.Handler) http.Handler`:
    - Si role == moderator, verificar que region_id del recurso coincide con region_id del JWT
    - SuperAdmin bypasea esta verificación
  - Helpers: `GetUserID(ctx)`, `GetRole(ctx)`, `IsAdmin(ctx)`, `IsModerator(ctx)`, `GetRegionID(ctx)`
- [x] 7.2 Test unitario para middleware:
  - Test: request sin token → 401
  - Test: request con token válido → claims en context
  - Test: request con token expirado → 401
  - Test: RequireRole("superadmin") con jugador → 403
  - Test: RequireRole("player","moderator") con moderador → OK

## 8. Handlers HTTP

- [x] 8.1 Crear `internal/auth/handler.go`:
  - `type Handler struct` con service
  - `Register(w, r)` — parsea JSON, llama service.Register, retorna 201
  - `Login(w, r)` — parsea JSON, extrae IP de r.RemoteAddr, llama service.Login, retorna 200
  - `Refresh(w, r)` — parsea JSON, llama service.Refresh, retorna 200
  - `Logout(w, r)` — parsea JSON, llama service.Logout, retorna 200
  - `ChangePassword(w, r)` — extrae userID de context, parsea JSON, llama service.ChangePassword, retorna 200
  - Todos los errores mapeados a RFC 7807 con status codes correctos
- [x] 8.2 Crear `internal/auth/routes.go`:
  - `RegisterRoutes(r chi.Router, h *Handler, authMw func(http.Handler) http.Handler, rateLimitMw func(http.Handler) http.Handler)`:
    ```
    POST /auth/register          (público + rate limit)
    POST /auth/login             (público + rate limit)
    POST /auth/refresh           (público)
    POST /auth/logout            (autenticado)
    PUT  /auth/password          (autenticado)
    ```

## 9. Integración con main.go

- [x] 9.1 Registrar rutas de auth en `cmd/server/main.go`:
  - Crear repo, jwtManager, rateLimiter, service, handler
  - Montar rutas en el router
  - Aplicar rate limit middleware a register y login
- [x] 9.2 Crear middleware wrapper para rate limiting en handler:
  - `RateLimitMiddleware(limiter *RateLimiter) func(http.Handler) http.Handler`
  - Setear headers: `X-RateLimit-Remaining`, `Retry-After`
  - Si bloqueado → 429 Problem Detail

## 10. Tests de integración

- [x] 10.1 Crear `internal/auth/integration_test.go` con Testcontainers:
  - Setup: levantar PostgreSQL, aplicar migraciones, crear handler con dependencias reales
  - Test: registro exitoso → 201, user creado en DB con trust_score 80
  - Test: registro con email duplicado → 409
  - Test: registro con password débil → 422
  - Test: login exitoso → 200, tokens válidos
  - Test: login con credentials inválidas → 401 (mensaje genérico)
  - Test: refresh exitoso → nuevo par de tokens, viejo revocado
  - Test: refresh con token reusado → 401, toda la familia revocada
  - Test: logout → token revocado
  - Test: cambio password → tokens revocados
  - Test: rate limiting → 6to intento → 429
- [x] 10.2 Verificar: `go test ./internal/auth/... -v` pasa todos los tests

## 11. Verificación final

- [x] 11.1 `go build ./...` compila
- [x] 11.2 `go test ./...` pasa
- [x] 11.3 `sqlc generate` sin errores
- [x] 11.4 Docker compose rebuild + test manual:
  - `curl POST /auth/register` → 201
  - `curl POST /auth/login` → 200 con tokens
  - `curl GET /health` con Bearer token → claims inyectados
