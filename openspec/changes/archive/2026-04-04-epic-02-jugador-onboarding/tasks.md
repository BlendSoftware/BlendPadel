# Tasks: EPIC 02 — Jugador y Onboarding

> Cada task es atómico (5-30 min). Ejecutar en orden.
> El algoritmo de onboarding merece tests unitarios exhaustivos (tabla de casos).

---

## 1. Migración y sqlc para player

- [x] 1.1 Crear `backend/migrations/000003_player.up.sql`:
  ```sql
  ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326),
      ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id),
      ADD COLUMN IF NOT EXISTS elo INTEGER NOT NULL DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS validated_match_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS elo_frozen BOOLEAN NOT NULL DEFAULT FALSE;

  CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location);
  CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo DESC);
  CREATE INDEX IF NOT EXISTS idx_users_region ON users(region_id);

  CREATE TABLE onboarding_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id),
      responses JSONB NOT NULL,
      calculated_elo INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- [x] 1.2 Crear `backend/migrations/000003_player.down.sql`
- [x] 1.3 Crear queries sqlc: `queries/players.sql`
  - `GetPlayerProfile` — SELECT con todos los campos de player (excluir password_hash)
  - `UpdatePlayerProfile` — UPDATE last_name, location WHERE id = $1
  - `UpdatePlayerELO` — UPDATE elo WHERE id = $1
  - `UpdatePlayerAvatar` — UPDATE avatar_url WHERE id = $1
  - `SetOnboardingCompleted` — UPDATE onboarding_completed = true, elo = $2 WHERE id = $1
  - `GetPlayersByRegion` — SELECT WHERE region_id = $1 AND status = 'active' ORDER BY elo DESC
- [x] 1.4 Crear queries sqlc: `queries/onboarding.sql`
  - `CreateOnboardingResponse` — INSERT (user_id, responses JSONB, calculated_elo)
  - `GetOnboardingResponse` — SELECT WHERE user_id = $1
- [x] 1.5 Ejecutar `sqlc generate` y verificar código generado
- [x] 1.6 Aplicar migración al Docker postgres y verificar

## 2. Modelos y DTOs del dominio player

- [x] 2.1 Crear `internal/player/model.go`:
  - `OnboardingRequest` — struct con 5 campos: Frequency, Tournaments, PaddleType, SelfAssessment, YearsPlaying
  - `OnboardingResponse` — ELO asignado, estado
  - `UpdateProfileRequest` — LastName, Latitude, Longitude
  - `ProfileResponse` — todo el perfil público (sin password_hash, sin coordenadas exactas para otros)
  - Constantes para opciones del cuestionario (enums como string constants)

## 3. Algoritmo de onboarding (testeable)

- [x] 3.1 Crear `internal/player/onboarding.go`:
  - `CalculateInitialELO(req OnboardingRequest) int` — función pura
  - Tabla de deltas por respuesta (como map o switch)
  - Inconsistency check: si autoevaluación >= avanzado pero frecuencia <= 1-2/sem → cap a +50
  - Clamp final: max(800, min(resultado, 1400))
- [x] 3.2 Crear `internal/player/onboarding_test.go` — TESTS EXHAUSTIVOS:
  - Test tabla: principiante total (nunca juega, sin torneos, paleta iniciación, principiante) → 800
  - Test tabla: competitivo total (3+/sem, federado, avanzada, competitivo) → 1400
  - Test tabla: intermedio balanced → ~1000
  - Test inconsistencia: autoevaluación "competitivo" + frecuencia "rara vez" → ELO conservador
  - Test clamp: resultado calculado > 1400 → capped a 1400
  - Test clamp: resultado calculado < 800 → capped a 800
  - Test: al menos 8 combinaciones diferentes con resultado esperado

## 4. Repository y Postgres

- [x] 4.1 Crear `internal/player/repository.go` — interface:
  - `GetProfile(ctx, userID uuid.UUID) (*PlayerProfile, error)`
  - `UpdateProfile(ctx, userID uuid.UUID, lastName string, lat, lng float64) error`
  - `UpdateAvatar(ctx, userID uuid.UUID, avatarURL string) error`
  - `CompleteOnboarding(ctx, userID uuid.UUID, elo int) error`
  - `SaveOnboardingResponses(ctx, userID uuid.UUID, responses json.RawMessage, calculatedELO int) error`
  - `GetOnboardingResponses(ctx, userID uuid.UUID) (*OnboardingResponseRecord, error)`
- [x] 4.2 Crear `internal/player/postgres.go` — implementación con sqlc queries

## 5. Service layer

- [x] 5.1 Crear `internal/player/service.go`:
  - `type Service struct` con repo
  - `CompleteOnboarding(ctx, userID uuid.UUID, req OnboardingRequest) (*OnboardingResponse, error)`:
    - Verificar que onboarding no esté ya completado
    - Calcular ELO con CalculateInitialELO
    - Guardar respuestas en onboarding_responses
    - Actualizar user: onboarding_completed = true, elo = calculado
    - Retornar ELO asignado
  - `UpdateProfile(ctx, userID uuid.UUID, req UpdateProfileRequest) error`:
    - Validar bounds Mendoza: lat [-35.5, -32.0], lng [-70.5, -67.5]
    - Actualizar en DB
  - `GetProfile(ctx, userID uuid.UUID) (*ProfileResponse, error)`:
    - Fetch de DB, calcular calibration_matches_remaining
  - `UploadAvatar(ctx, userID uuid.UUID, file multipart.File, header *multipart.FileHeader) (string, error)`:
    - Validar MIME con magic bytes (primeros 512 bytes + http.DetectContentType)
    - Validar tamaño <= 5MB
    - Generar nombre: `{userID}_{timestamp}.{ext}`
    - Guardar en uploadDir/avatars/
    - Si avatar previo existe, eliminarlo
    - Actualizar avatar_url en DB
    - Retornar URL pública

## 6. Handlers HTTP

- [x] 6.1 Crear `internal/player/handler.go`:
  - `CompleteOnboarding(w, r)` — POST /onboarding/questionnaire, requiere auth
  - `UpdateProfile(w, r)` — PUT /players/me, requiere auth
  - `GetProfile(w, r)` — GET /players/me, requiere auth
  - `UploadAvatar(w, r)` — POST /players/me/avatar, requiere auth, multipart
  - Errores mapeados a RFC 7807
- [x] 6.2 Crear `internal/player/routes.go`:
  ```
  POST /onboarding/questionnaire  (autenticado)
  GET  /players/me                (autenticado)
  PUT  /players/me                (autenticado)
  POST /players/me/avatar         (autenticado)
  ```

## 7. File serving para avatares

- [x] 7.1 Configurar Go static file server en main.go:
  - `r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir))))`
  - Crear directorio `uploads/avatars/` si no existe al iniciar
- [x] 7.2 Verificar que Caddy pasa requests de `/uploads/` al backend

## 8. Integración con main.go

- [x] 8.1 Registrar rutas de player en `cmd/server/main.go`:
  - Crear repo, service, handler
  - Montar rutas con auth middleware
  - Montar file server para uploads

## 9. Tests de integración

- [x] 9.1 Crear `internal/player/integration_test.go` con Testcontainers:
  - Test: onboarding completo → ELO asignado correctamente, onboarding_completed = true
  - Test: onboarding ya completado → error 409
  - Test: update profile con coordenadas válidas (Mendoza) → 200
  - Test: update profile con coordenadas fuera de Mendoza → 422
  - Test: get profile → retorna todo con calibration_matches_remaining
  - Test: upload avatar JPG válido → 200 + URL retornada
  - Test: upload archivo no imagen → 415
  - Test: upload archivo > 5MB → 413
- [x] 9.2 Ejecutar `go test ./internal/player/... -v` — todo pasa

## 10. Verificación final

- [x] 10.1 `go build ./...` compila
- [x] 10.2 `go test ./...` pasa (auth + player)
- [x] 10.3 `sqlc generate` sin errores
- [x] 10.4 Docker compose rebuild + test manual:
  - Registrar usuario → login → completar onboarding → ver ELO asignado
  - Actualizar perfil con coordenadas de Rivadavia (-33.35, -68.33) → OK
  - Subir avatar → ver URL en perfil → acceder imagen via /uploads/
