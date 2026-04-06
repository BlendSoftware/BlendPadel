# EPIC 08 — Perfil: Implementation Tasks

## Status: implemented

---

## T01 — Migration 000008_profile

- [x] Create `db/migrations/000008_profile.up.sql`
  - `ALTER TABLE users ADD COLUMN preferences JSONB NOT NULL DEFAULT '{"radar_radius_km": 10, "elo_min_delta": -200, "elo_max_delta": 200}'::jsonb`
  - `CREATE TABLE conduct_reports` with columns:
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
    - `reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
    - `match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE`
    - `reason TEXT NOT NULL`
    - `status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed'))`
    - `moderator_id UUID REFERENCES users(id) ON DELETE SET NULL`
    - `created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`
    - `updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`
    - `CONSTRAINT unique_report_per_match UNIQUE (reporter_id, match_id)`
  - `CREATE INDEX idx_conduct_reports_status ON conduct_reports (status)`
  - `CREATE INDEX idx_conduct_reports_reported ON conduct_reports (reported_id)`
  - `CREATE INDEX idx_conduct_reports_match ON conduct_reports (match_id)`

- [x] Create `db/migrations/000008_profile.down.sql`
  - `DROP TABLE IF EXISTS conduct_reports`
  - `ALTER TABLE users DROP COLUMN IF EXISTS preferences`

---

## T02 — sqlc queries: profiles.sql

- [x] Create `db/queries/profiles.sql`
  - `GetPublicProfile`:
    - SELECT id, name, elo, trust_score, validated_match_count, region_id, status FROM users WHERE id = $1
    - `-- name: GetPublicProfile :one`
    - Exclude password_hash from select (do not return it even for service-layer use)
  - `GetOwnProfile`:
    - SELECT id, name, email, elo, trust_score, validated_match_count, region_id, status, preferences, created_at FROM users WHERE id = $1
    - `-- name: GetOwnProfile :one`
  - `UpdatePreferences`:
    - UPDATE users SET preferences = $2, updated_at = NOW() WHERE id = $1
    - `-- name: UpdatePreferences :exec`

---

## T03 — sqlc queries: conduct_reports.sql

- [x] Create `db/queries/conduct_reports.sql`
  - `CreateReport`:
    - INSERT INTO conduct_reports (reporter_id, reported_id, match_id, reason) VALUES ($1, $2, $3, $4) RETURNING *
    - `-- name: CreateReport :one`
  - `GetReportsByRegion`:
    - SELECT cr.* FROM conduct_reports cr JOIN matches m ON m.id = cr.match_id WHERE m.region_id = $1 AND ($2::varchar IS NULL OR cr.status = $2) ORDER BY cr.created_at DESC LIMIT $3 OFFSET $4
    - `-- name: GetReportsByRegion :many`
  - `GetReportsByPlayer`:
    - SELECT * FROM conduct_reports WHERE reported_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
    - `-- name: GetReportsByPlayer :many`
  - `IsMatchParticipant`:
    - SELECT EXISTS(SELECT 1 FROM match_players WHERE match_id = $1 AND player_id = $2)
    - `-- name: IsMatchParticipant :one`
  - `IsMatchCompleted`:
    - SELECT EXISTS(SELECT 1 FROM matches WHERE id = $1 AND status = 'completed')
    - `-- name: IsMatchCompleted :one`
  - `CountReportsByRegion`:
    - SELECT COUNT(*) FROM conduct_reports cr JOIN matches m ON m.id = cr.match_id WHERE m.region_id = $1 AND ($2::varchar IS NULL OR cr.status = $2)
    - `-- name: CountReportsByRegion :one`

---

## T04 — Run sqlc generate

- [x] Run `sqlc generate` from project root
- [x] Verify no compile errors in generated `db/sqlc/` files
- [x] Confirm new query functions: `GetPublicProfile`, `GetOwnProfile`, `UpdatePreferences`, `CreateReport`, `GetReportsByRegion`, `GetReportsByPlayer`, `IsMatchParticipant`, `IsMatchCompleted`, `CountReportsByRegion`
- [x] Verify `Preferences` JSONB column appears in generated `User` struct as `json.RawMessage` or typed field

---

## T05 — Extend internal/player/model.go

- [x] Add to `internal/player/model.go`:
  - `Preferences` struct: `RadarRadiusKM int32`, `ELOMinDelta int32`, `ELOMaxDelta int32` — all with `json` tags and `db` tags as needed
  - `PublicProfileResponse` struct: `ID uuid.UUID`, `Name string`, `ELO int32`, `TrustLabel string`, `ValidatedMatchCount int32`, `RegionID uuid.UUID`
  - `OwnProfileResponse` struct: embeds `PublicProfileResponse`, adds `TrustScore int32`, `Preferences Preferences`, `Status string`, `Email string`
  - `PreferencesRequest` struct: `RadarRadiusKM int32`, `ELOMinDelta int32`, `ELOMaxDelta int32`
  - `ReportRequest` struct: `ReportedID uuid.UUID`, `Reason string`
  - `ReportResponse` struct: `ID uuid.UUID`, `ReporterID uuid.UUID`, `ReportedID uuid.UUID`, `MatchID uuid.UUID`, `Reason string`, `Status string`, `CreatedAt time.Time`
  - `ReportListResponse` struct: `Reports []ReportResponse`, `Total int64`
  - Error variables:
    - `ErrNotParticipant = errors.New("not a participant of this match")`
    - `ErrMatchNotCompleted = errors.New("match is not completed")`
    - `ErrAlreadyReported = errors.New("already reported this match")`
    - `ErrInvalidPreferences = errors.New("invalid preferences values")`

---

## T06 — Add to internal/player/repository.go

- [x] Add to the `Repository` interface in `internal/player/repository.go`:
  - `GetPublicProfile(ctx context.Context, playerID uuid.UUID) (*db.GetPublicProfileRow, error)`
  - `GetOwnProfile(ctx context.Context, playerID uuid.UUID) (*db.GetOwnProfileRow, error)`
  - `UpdatePreferences(ctx context.Context, playerID uuid.UUID, prefs json.RawMessage) error`
  - `CreateReport(ctx context.Context, arg db.CreateReportParams) (db.ConductReport, error)`
  - `GetReportsByRegion(ctx context.Context, regionID uuid.UUID, status *string, limit, offset int32) ([]db.GetReportsByRegionRow, error)`
  - `IsMatchParticipant(ctx context.Context, matchID, playerID uuid.UUID) (bool, error)`
  - `IsMatchCompleted(ctx context.Context, matchID uuid.UUID) (bool, error)`
  - `CountReportsByRegion(ctx context.Context, regionID uuid.UUID, status *string) (int64, error)`

---

## T07 — Add to internal/player/postgres.go

- [x] Add implementations to `internal/player/postgres.go`:
  - `GetPublicProfile`: call `q.GetPublicProfile(ctx, playerID)`, return row or `ErrPlayerNotFound` if `errors.Is(err, pgx.ErrNoRows)`
  - `GetOwnProfile`: call `q.GetOwnProfile(ctx, playerID)`, same not-found handling
  - `UpdatePreferences`: marshal Preferences struct to JSON, call `q.UpdatePreferences(ctx, playerID, jsonBytes)`
  - `CreateReport`: call `q.CreateReport(ctx, arg)`, map `unique_report_per_match` constraint violation to `ErrAlreadyReported`
  - `GetReportsByRegion`: call `q.GetReportsByRegion(ctx, ...)`, handle nil status param (pass pgtype.Text{Valid: false} or equivalent)
  - `IsMatchParticipant`: call `q.IsMatchParticipant(ctx, matchID, playerID)`, return bool
  - `IsMatchCompleted`: call `q.IsMatchCompleted(ctx, matchID)`, return bool
  - `CountReportsByRegion`: call `q.CountReportsByRegion(ctx, ...)`, return int64

---

## T08 — Add to internal/player/service.go

- [x] Add to `internal/player/service.go`:
  - `GetPublicProfile(ctx context.Context, callerID, profileID uuid.UUID) (interface{}, error)`:
    - If callerID == profileID: call `repo.GetOwnProfile`, map to `OwnProfileResponse` (include exact trust_score)
    - If callerID != profileID: call `repo.GetPublicProfile`, check status — if banned_soft or banned_hard return `ErrPlayerNotFound`, else map to `PublicProfileResponse` with trust label applied via `trustLabel(score)` helper
    - Helper `trustLabel(score int32) string`: ≥90→"Excelente", ≥70→"Bueno", else→"Bajo"
  - `UpdatePreferences(ctx context.Context, playerID uuid.UUID, req PreferencesRequest) (Preferences, error)`:
    - Validate: RadarRadiusKM 1–50, ELOMinDelta -500 to 0, ELOMaxDelta 0 to 500 — return `ErrInvalidPreferences` with descriptive message on any violation
    - Marshal req to JSON, call `repo.UpdatePreferences`
    - Return the validated Preferences struct
  - `ReportConduct(ctx context.Context, reporterID uuid.UUID, matchID uuid.UUID, req ReportRequest) (ReportResponse, error)`:
    - Call `repo.IsMatchCompleted` — if false, return `ErrMatchNotCompleted`
    - Call `repo.IsMatchParticipant` for reporterID — if false, return `ErrNotParticipant`
    - Call `repo.IsMatchParticipant` for req.ReportedID — if false, return error "reported player is not a participant"
    - Validate req.Reason not empty, max 500 chars
    - Call `repo.CreateReport` with params — propagate `ErrAlreadyReported` if repo returns it
    - Map result to `ReportResponse`
  - `GetAdminReports(ctx context.Context, moderatorRegionID uuid.UUID, statusFilter string, limit, offset int32) (ReportListResponse, error)`:
    - Parse statusFilter: if empty string, pass nil; else validate it's one of pending|reviewed|dismissed
    - Call `repo.CountReportsByRegion` for total count
    - Call `repo.GetReportsByRegion` for the page
    - Map to `ReportListResponse`

---

## T09 — Add to internal/player/handler.go

- [x] Add to `internal/player/handler.go`:
  - `GetPublicProfile(w http.ResponseWriter, r *http.Request)`:
    - Extract `id` path param via `chi.URLParam`
    - Parse UUID, return 400 on invalid format
    - Extract callerID from context via `middleware.GetUserID`
    - Call `svc.GetPublicProfile(ctx, callerID, profileID)`
    - Map `ErrPlayerNotFound` → 404
    - Write JSON response 200
  - `UpdatePreferences(w http.ResponseWriter, r *http.Request)`:
    - Extract callerID from context
    - Decode request body into `PreferencesRequest`
    - Call `svc.UpdatePreferences`
    - Map `ErrInvalidPreferences` → 422 with `{ "error": "...", "field": "..." }` detail
    - Respond 200 with updated preferences
  - `ReportConduct(w http.ResponseWriter, r *http.Request)`:
    - Extract `id` path param (match ID), parse UUID
    - Extract callerID from context
    - Decode request body into `ReportRequest`
    - Call `svc.ReportConduct`
    - Map `ErrNotParticipant` → 403
    - Map `ErrMatchNotCompleted` → 422
    - Map `ErrAlreadyReported` → 409
    - Respond 201 with `ReportResponse`
  - `GetAdminReports(w http.ResponseWriter, r *http.Request)`:
    - Extract moderator's region from context (via `RequireRegion` middleware or from JWT claims)
    - Parse query params: `status` (optional), `limit` (default 20, max 100), `offset` (default 0)
    - Call `svc.GetAdminReports`
    - Respond 200 with `ReportListResponse`

---

## T10 — Update internal/player/routes.go

- [x] Add to `internal/player/routes.go`:
  - `r.With(authMiddleware).Get("/players/{id}", h.GetPublicProfile)`
  - `r.With(authMiddleware).Put("/players/me/preferences", h.UpdatePreferences)`
  - `r.With(authMiddleware).Post("/matches/{id}/report", h.ReportConduct)`
  - `r.With(authMiddleware, requireModerator).Get("/admin/reports", h.GetAdminReports)`
  - Ensure existing player routes are not broken (register both old and new routes)

---

## T11 — Wire admin report routes in main.go

- [x] In `cmd/api/main.go` (or router initialization file):
  - Confirm `middleware.RequireRole("moderator")` is available (from auth package)
  - Confirm `middleware.RequireRegion` is available
  - Pass `RequireRole("moderator")` and `RequireRegion` to player route registration
  - Verify the `/admin/reports` route has both middlewares in the chain: `authMiddleware → RequireRole("moderator") → RequireRegion → GetAdminReports`

---

## T12 — Apply migration

- [x] Run migration: `migrate -database $DATABASE_URL -path db/migrations up`
- [x] Verify `preferences` column exists in users: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'preferences';`
- [x] Verify `conduct_reports` table exists with correct schema: `\d conduct_reports`
- [x] Verify existing user rows have default preferences: `SELECT preferences FROM users LIMIT 1;`

---

## T13 — Integration tests

- [x] Create `internal/player/profile_test.go` (or extend existing test file)
  - **Public profile — normal player**:
    - Seed player with trust_score=85, status='active'
    - GET /players/{id} as different user
    - Assert response contains `trust_label: "Bueno"`, no `trust_score` field, no `preferences` field
  - **Public profile — self view**:
    - GET /players/{id} as the same user
    - Assert response contains `trust_score: 85` (exact), `trust_label: "Bueno"`, `preferences` field present
  - **Public profile — trust label boundaries**:
    - trust_score=90 → "Excelente"
    - trust_score=70 → "Bueno"
    - trust_score=69 → "Bajo"
  - **Public profile — banned player returns 404**:
    - Seed player with status='banned_soft'
    - GET /players/{id} as another user → assert 404
    - Self-view: GET /players/{id} as same user → assert 200 (can view own banned profile)
  - **Public profile — hard ban returns 404**:
    - Seed player with status='banned_hard'
    - GET /players/{id} as another user → assert 404
  - **Update preferences — valid**:
    - PUT /players/me/preferences with `{radar_radius_km: 25, elo_min_delta: -150, elo_max_delta: 300}`
    - Assert 200, response matches submitted values
    - Re-fetch own profile, assert preferences updated in DB
  - **Update preferences — invalid radius**:
    - PUT with `radar_radius_km: 0` → assert 422
    - PUT with `radar_radius_km: 51` → assert 422
  - **Update preferences — invalid delta**:
    - PUT with `elo_min_delta: 100` (positive) → assert 422
    - PUT with `elo_max_delta: -100` (negative) → assert 422
    - PUT with `elo_min_delta: -600` (out of range) → assert 422
  - **Report conduct — valid**:
    - Seed completed match with player A and player B
    - POST /matches/{id}/report as player A with `{reported_id: playerB, reason: "Falta de respeto"}`
    - Assert 201, ReportResponse returned with status='pending'
  - **Report conduct — not a participant**:
    - POST /matches/{id}/report as player C (not in match) → assert 403
  - **Report conduct — match not completed**:
    - Seed match with status='scheduled'
    - POST report → assert 422
  - **Report conduct — duplicate report**:
    - Submit same report twice → assert 409 on second attempt
  - **Admin reports — region filtered**:
    - Seed reports from two different regions
    - GET /admin/reports as moderator of region A → assert only region A reports returned
  - **Admin reports — status filter**:
    - Seed reports with status='pending' and 'dismissed'
    - GET /admin/reports?status=pending → only pending reports returned
  - **Admin reports — auth required**:
    - GET /admin/reports without moderator role → assert 403

---

## T14 — Build and test verification

- [x] `go build ./...` — zero errors
- [x] `go test ./internal/player/... -v` — all tests pass including new ones
- [x] `go vet ./...` — zero warnings
- [x] Manual smoke tests:
  - `curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/players/{some_id}` → returns public profile
  - `curl -X PUT -H "Authorization: Bearer $TOKEN" -d '{"radar_radius_km":15,"elo_min_delta":-100,"elo_max_delta":150}' http://localhost:8080/players/me/preferences` → 200
  - `curl -X POST -H "Authorization: Bearer $TOKEN" -d '{"reported_id":"...","reason":"test"}' http://localhost:8080/matches/{match_id}/report` → 201
