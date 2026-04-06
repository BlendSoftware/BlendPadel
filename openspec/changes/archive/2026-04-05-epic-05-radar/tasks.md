# Tasks: EPIC 05 — Radar

## Pre-conditions
- EPICs 00–04 complete (matches table with `location GEOGRAPHY`, `avg_elo`, `status`, `captain_id` exists)
- GIST index on `matches.location` exists
- `trust.ThresholdVisible` constant defined in trust package
- `AuthMiddleware`, `GetUserID` available from auth package
- `response.JSON`, `response.Problem` available from response package

---

## Task 1 — sqlc Queries: queries/radar.sql

- [x] Create `queries/radar.sql`
- [x] Write `GetRadarMatches` query:
  - JOIN `users ca ON ca.id = m.captain_a_id` for captain display name
  - JOIN `users viewer ON viewer.id = $viewer_user_id` to get viewer's trust score
  - WHERE `m.status = 'pending_result'`
  - WHERE `m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '48 hours'`
  - WHERE `ST_DWithin(m.location, ST_MakePoint($lng, $lat)::geography, $radius_meters)` — note: radius in meters
  - WHERE `m.avg_elo BETWEEN $elo_min AND $elo_max`
  - WHERE `(ca.trust_score >= 70 OR viewer.trust_score < 70)` (trust visibility)
  - Cursor: `AND ($cursor_time IS NULL OR (m.scheduled_at, m.id) > ($cursor_time, $cursor_id))` with null handling
  - SELECT includes: `m.id`, `m.captain_a_id AS captain_id`, `ca.name AS captain_name`, `ST_Y(m.location::geometry) AS lat`, `ST_X(m.location::geometry) AS lng`, `ST_Distance(...) AS distance_meters`, `m.avg_elo`, `m.scheduled_at`, `COUNT(mp.player_id) AS joined_count`
  - ORDER BY `m.scheduled_at ASC, m.id ASC`
  - LIMIT `$page_size`
  - Annotation: `-- name: GetRadarMatches :many`
- [x] Write `GetRadarAlerts` query:
  - Same JOINs as above
  - WHERE `m.status = 'pending_result'`
  - WHERE `m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'` (hard-coded)
  - WHERE `ST_DWithin(m.location, ST_MakePoint($lng, $lat)::geography, 5000)` (hard-coded 5 km)
  - WHERE `(ca.trust_score >= 70 OR viewer.trust_score < 70)`
  - No ELO filter
  - No cursor (full result set)
  - ORDER BY `m.scheduled_at ASC`
  - Annotation: `-- name: GetRadarAlerts :many`
- [x] Verify column names match actual schema by reading `migrations/` or existing sqlc schema file

## Task 2 — Run sqlc generate

- [x] Run `sqlc generate` from project root (or wherever `sqlc.yaml` is located)
- [x] Confirm generated files appear in `internal/db/radar.sql.go`
- [x] Fix any type mismatches from new queries (geography types, computed columns)

## Task 3 — Create internal/radar/model.go

- [x] Define `RadarMatch` struct
- [x] Define `RadarMatchesResponse` with `Items []RadarMatch` and `NextCursor *string`
- [x] Define `RadarAlertsResponse` with `Items []RadarMatch`
- [x] Define `RadarCursor` struct (ScheduledAt + ID) with `Encode() string` and `DecodeCursor(s string) (*RadarCursor, error)` helpers
- [x] Define `GetMatchesParams` for service input (ViewerUserID, Lat, Lng, RadiusKm, ELOMin, ELOMax, Cursor, PageSize)
- [x] Define `GetAlertsParams` for service input (ViewerUserID, Lat, Lng)

## Task 4 — Create internal/radar/repository.go

- [x] Define `Repository` interface
- [x] Define `GetMatchesDBParams` and `GetAlertsDBParams` structs

## Task 5 — Create internal/radar/postgres.go

- [x] Define `postgresRadarRepo` struct holding `*db.Queries` (sqlc generated)
- [x] Implement `GetMatches`
- [x] Implement `GetAlerts`
- [x] Constructor: `NewPostgresRadarRepo(q *db.Queries) Repository`

## Task 6 — Create internal/radar/service.go

- [x] Define `Service` struct with `repo Repository`
- [x] Implement `GetMatches(ctx context.Context, params GetMatchesParams) (*RadarMatchesResponse, error)`
- [x] Implement `GetAlerts(ctx context.Context, params GetAlertsParams) (*RadarAlertsResponse, error)`
- [x] Define constants (MaxRadiusKm, DefaultRadiusKm, DefaultELOSpread, DefaultPageSize, MaxPageSize, AlertRadiusMeters)
- [x] Constructor: `NewService(repo Repository) *Service`

## Task 7 — Create internal/radar/handler.go

- [x] Define `Handler` struct with `svc *Service`
- [x] Implement `GetMatches(w http.ResponseWriter, r *http.Request)`
- [x] Implement `GetAlerts(w http.ResponseWriter, r *http.Request)`
- [x] Constructor: `NewHandler(svc *Service) *Handler`

## Task 8 — Create internal/radar/routes.go

- [x] Define `RegisterRoutes(r chi.Router, h *Handler)` function

## Task 9 — Wire in main.go

- [x] Instantiate `PostgresRadarRepo` with sqlc queries
- [x] Instantiate `RadarService` with repo
- [x] Instantiate `RadarHandler` with service
- [x] Register routes under authenticated router group (with `authMw`)

## Task 10 — Integration Tests with Testcontainers

- [x] Create `internal/radar/integration_test.go`
- [x] Use Testcontainers with PostGIS image (`postgis/postgis:16-3.4-alpine`)
- [x] Run migrations against test container
- [x] Test `GetMatches`: 5 matches seeded, 2 returned (radius + ELO + trust filters verified)
- [x] Test pagination cursor (page 1 of 3, page 2 of 2, no overlap)
- [x] Test `GetAlerts`: 3 matches seeded, 1 returned (time + radius hard-coded thresholds)
- [x] Test trust filter: high-trust viewer sees 1, low-trust viewer sees 2
- [x] All tests pass with `go test ./internal/radar/... -tags integration`

## Task 11 — Build + Test Verification

- [x] `go build ./...` — compiles with zero errors
- [x] `go vet ./...` — passes with zero warnings
- [x] `go test ./internal/radar/... -tags integration` — all 4 integration tests pass
