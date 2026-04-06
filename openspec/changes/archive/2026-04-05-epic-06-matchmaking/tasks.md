# Tasks: EPIC 06 — Matchmaking

## Pre-conditions
- EPIC 05 complete
- `match.Service.CreateMatch` exists and is injectable
- `trust.ThresholdVisible` constant defined in trust package
- `AuthMiddleware`, `GetUserID`, `RequireRole` available from auth package
- `response.JSON`, `response.Problem` available from response package
- Migration tooling follows `migrate` format: `000006_matchmaking.up.sql` / `000006_matchmaking.down.sql`

---

## Task 1 — Migration 000006_matchmaking

- [x] Create `migrations/000006_matchmaking.up.sql`:
  ```sql
  CREATE TABLE matchmaking_flares (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      location     GEOGRAPHY(POINT, 4326) NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      elo_min      INT NOT NULL DEFAULT 0,
      elo_max      INT NOT NULL DEFAULT 3000,
      min_players  INT NOT NULL DEFAULT 2,
      max_players  INT NOT NULL DEFAULT 4,
      status       TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'matched', 'cancelled', 'expired')),
      match_id     UUID REFERENCES matches(id),
      expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE flare_respondents (
      flare_id  UUID NOT NULL REFERENCES matchmaking_flares(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (flare_id, player_id)
  );

  CREATE INDEX idx_flares_player_id ON matchmaking_flares(player_id);
  CREATE INDEX idx_flares_status_expires ON matchmaking_flares(status, expires_at);
  CREATE INDEX idx_flares_location ON matchmaking_flares USING GIST(location);
  CREATE UNIQUE INDEX idx_flares_one_active_per_player
      ON matchmaking_flares(player_id)
      WHERE status = 'active';
  ```
- [x] Create `migrations/000006_matchmaking.down.sql`:
  ```sql
  DROP TABLE IF EXISTS flare_respondents;
  DROP TABLE IF EXISTS matchmaking_flares;
  ```
- [x] Run migration against local dev DB to verify it applies cleanly
- [x] Run `down` migration and re-run `up` to verify idempotency

## Task 2 — sqlc Queries: queries/flares.sql

- [x] Create `queries/flares.sql`
- [x] Write `CreateFlare` query:
  ```sql
  -- name: CreateFlare :one
  INSERT INTO matchmaking_flares (player_id, location, scheduled_at, elo_min, elo_max, min_players, max_players)
  VALUES (@player_id, ST_MakePoint(@lng, @lat)::geography, @scheduled_at, @elo_min, @elo_max, @min_players, @max_players)
  RETURNING *;
  ```
- [x] Write `GetActiveFlareByPlayer` query:
  ```sql
  -- name: GetActiveFlareByPlayer :one
  SELECT * FROM matchmaking_flares
  WHERE player_id = @player_id AND status = 'active'
  LIMIT 1;
  ```
- [x] Write `GetActiveFlares` query (proximity + ELO + Trust + cursor):
  ```sql
  -- name: GetActiveFlares :many
  SELECT
      f.*,
      p.display_name AS creator_name,
      ST_Y(f.location::geometry) AS lat,
      ST_X(f.location::geometry) AS lng,
      ST_Distance(f.location, ST_MakePoint(@lng, @lat)::geography) AS distance_meters
  FROM matchmaking_flares f
  JOIN players p ON p.id = f.player_id
  JOIN players viewer ON viewer.user_id = @viewer_user_id
  WHERE f.status = 'active'
    AND f.expires_at > NOW()
    AND ST_DWithin(f.location, ST_MakePoint(@lng, @lat)::geography, @radius_meters)
    AND f.elo_min <= viewer.current_elo
    AND f.elo_max >= viewer.current_elo
    AND p.trust_tier >= viewer.trust_tier  -- trust visibility check
    AND (f.created_at, f.id) < (@cursor_created_at, @cursor_id)
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT @page_size;
  ```
  Note: handle NULL cursor for first page (use a far-future sentinel or conditional in Go)
- [x] Write `GetFlareByID` query:
  ```sql
  -- name: GetFlareByID :one
  SELECT * FROM matchmaking_flares WHERE id = @id;
  ```
- [x] Write `GetFlareByIDForUpdate` query (SELECT FOR UPDATE for respond transaction):
  ```sql
  -- name: GetFlareByIDForUpdate :one
  SELECT * FROM matchmaking_flares WHERE id = @id FOR UPDATE;
  ```
- [x] Write `UpdateFlareStatus` query:
  ```sql
  -- name: UpdateFlareStatus :one
  UPDATE matchmaking_flares
  SET status = @status, match_id = @match_id, updated_at = NOW()
  WHERE id = @id
  RETURNING *;
  ```
- [x] Write `CancelFlare` query (only if owned by player, safety check in SQL):
  ```sql
  -- name: CancelFlare :one
  UPDATE matchmaking_flares
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = @id AND player_id = @player_id AND status = 'active'
  RETURNING *;
  ```
  Returns NULL if not found or not owned → service returns 404.
- [x] Write `ExpireOldFlares` query:
  ```sql
  -- name: ExpireOldFlares :execrows
  UPDATE matchmaking_flares
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND expires_at < NOW();
  ```
- [x] Write `AddFlareRespondent` query:
  ```sql
  -- name: AddFlareRespondent :exec
  INSERT INTO flare_respondents (flare_id, player_id) VALUES (@flare_id, @player_id)
  ON CONFLICT DO NOTHING;
  ```
- [x] Write `CountFlareRespondents` query:
  ```sql
  -- name: CountFlareRespondents :one
  SELECT COUNT(*)::INT FROM flare_respondents WHERE flare_id = @flare_id;
  ```
- [x] Write `GetFlareRespondents` query:
  ```sql
  -- name: GetFlareRespondents :many
  SELECT player_id FROM flare_respondents WHERE flare_id = @flare_id;
  ```

## Task 3 — Run sqlc generate

- [x] Run `sqlc generate` from project root
- [x] Confirm all generated types compile (geography types, computed columns, pgtype usage)
- [x] Fix any type mapping issues in `sqlc.yaml` for the new `GEOGRAPHY` and computed columns

## Task 4 — Create internal/matchmaking/model.go

- [x] Define `CreateFlareRequest` struct with JSON tags and validation rules:
  ```go
  type CreateFlareRequest struct {
      Lat         float64   `json:"lat"`          // required, -90 to 90
      Lng         float64   `json:"lng"`          // required, -180 to 180
      ScheduledAt time.Time `json:"scheduled_at"` // required, must be in the future
      ELOMin      int32     `json:"elo_min"`       // optional, default 0
      ELOMax      int32     `json:"elo_max"`       // optional, default 3000
      MinPlayers  int32     `json:"min_players"`   // optional, default 2, min 2, max 4
      MaxPlayers  int32     `json:"max_players"`   // optional, default 4, min 2, max 4
  }
  ```
- [x] Define `FlareResponse` struct (public view of a flare):
  ```go
  type FlareResponse struct {
      ID             uuid.UUID  `json:"id"`
      CreatorName    string     `json:"creator_name"`
      Lat            float64    `json:"lat"`
      Lng            float64    `json:"lng"`
      DistanceMeters float64    `json:"distance_meters,omitempty"`
      ScheduledAt    time.Time  `json:"scheduled_at"`
      ELOMin         int32      `json:"elo_min"`
      ELOMax         int32      `json:"elo_max"`
      MinPlayers     int32      `json:"min_players"`
      MaxPlayers     int32      `json:"max_players"`
      RespondentCount int32     `json:"respondent_count"`
      Status         string     `json:"status"`
      ExpiresAt      time.Time  `json:"expires_at"`
      MatchID        *uuid.UUID `json:"match_id,omitempty"`
      CreatedAt      time.Time  `json:"created_at"`
  }
  ```
- [x] Define `RespondRequest` struct (empty body is valid — no fields required)
- [x] Define `FlaresListResponse` with `Items []FlareResponse` and `NextCursor *string`
- [x] Define `FlareCursor` struct with `Encode()` and `DecodeFlareCursor(s string)` helpers
- [x] Define sentinel errors: `ErrActiveFlareExists`, `ErrFlareNotFound`, `ErrAlreadyRespondent`, `ErrFlareNotActive`, `ErrFlareFull`, `ErrNotFlareOwner`

## Task 5 — Create internal/matchmaking/repository.go

- [x] Define `Repository` interface:
  ```go
  type Repository interface {
      CreateFlare(ctx context.Context, playerID uuid.UUID, req CreateFlareRequest) (*FlareRow, error)
      GetActiveFlareByPlayer(ctx context.Context, playerID uuid.UUID) (*FlareRow, error)
      GetActiveFlares(ctx context.Context, params GetActiveFlaresParams) ([]FlareListRow, error)
      GetFlareByID(ctx context.Context, id uuid.UUID) (*FlareRow, error)
      GetFlareByIDForUpdate(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*FlareRow, error)
      UpdateFlareStatus(ctx context.Context, tx pgx.Tx, id uuid.UUID, status string, matchID *uuid.UUID) (*FlareRow, error)
      CancelFlare(ctx context.Context, id, playerID uuid.UUID) (*FlareRow, error)
      ExpireOldFlares(ctx context.Context) (int64, error)
      AddRespondent(ctx context.Context, tx pgx.Tx, flareID, playerID uuid.UUID) error
      CountRespondents(ctx context.Context, tx pgx.Tx, flareID uuid.UUID) (int32, error)
      GetRespondents(ctx context.Context, flareID uuid.UUID) ([]uuid.UUID, error)
  }
  ```
- [x] Define `FlareRow`, `FlareListRow`, `GetActiveFlaresParams` internal types

## Task 6 — Create internal/matchmaking/postgres.go

- [x] Define `PostgresFlareRepo` struct holding `*db.Queries` and `*pgxpool.Pool` (pool needed for transactions)
- [x] Implement all `Repository` interface methods
- [x] For transactional methods (`GetFlareByIDForUpdate`, `UpdateFlareStatus`, `AddRespondent`, `CountRespondents`): accept `pgx.Tx` and use `db.New(tx)` to get a transaction-scoped `*db.Queries`
- [x] Constructor: `NewPostgresFlareRepo(pool *pgxpool.Pool, q *db.Queries) *PostgresFlareRepo`

## Task 7 — Create internal/matchmaking/service.go

- [x] Define `Service` struct:
  ```go
  type Service struct {
      repo      Repository
      matchSvc  MatchCreator  // interface wrapping match.Service.CreateMatchTx
      pool      *pgxpool.Pool
  }
  ```
- [x] Define `MatchCreator` interface (so matchmaking doesn't import match package directly — use interface inversion):
  ```go
  type MatchCreator interface {
      CreateMatchTx(ctx context.Context, tx pgx.Tx, req CreateMatchRequest) (*MatchResult, error)
  }
  ```
- [x] Implement `CreateFlare(ctx, playerID, req CreateFlareRequest) (*FlareResponse, error)`:
  - Validate `req`: Lat/Lng bounds, ScheduledAt in future, MinPlayers ≥ 2, MaxPlayers ≥ MinPlayers, ELOMax > ELOMin
  - Call `repo.GetActiveFlareByPlayer` → if found, return `ErrActiveFlareExists`
  - Call `repo.CreateFlare`
  - Map to `FlareResponse` and return
- [x] Implement `GetFlares(ctx, viewerUserID, params GetFlaresParams) (*FlaresListResponse, error)`:
  - Validate radius ≤ 50 km, clamp page size to 20/50
  - Convert km to meters
  - Decode cursor if present; use sentinel (far-past time + zero UUID) for first page
  - Call `repo.GetActiveFlares`
  - Build next cursor if results == pageSize
  - Return `FlaresListResponse`
- [x] Implement `RespondToFlare(ctx, flareID, responderPlayerID uuid.UUID) (*FlareResponse, error)`:
  - Begin transaction via `pool.Begin(ctx)`
  - `repo.GetFlareByIDForUpdate(ctx, tx, flareID)` — 404 if nil
  - Check `flare.Status == "active"` — else `ErrFlareNotActive`
  - `repo.AddRespondent(ctx, tx, flareID, responderPlayerID)` — unique constraint catches duplicate
  - `count = repo.CountRespondents(ctx, tx, flareID)`
  - If `count >= flare.MinPlayers`:
    - Fetch all respondent player IDs: `repo.GetRespondents(ctx, flareID)` (inside tx)
    - Build `CreateMatchRequest{...}` from flare data + respondents
    - `matchResult = matchSvc.CreateMatchTx(ctx, tx, req)`
    - `repo.UpdateFlareStatus(ctx, tx, flareID, "matched", &matchResult.MatchID)`
  - Commit transaction
  - Return updated flare as `FlareResponse`
- [x] Implement `CancelFlare(ctx, flareID, playerID uuid.UUID) error`:
  - Call `repo.CancelFlare(ctx, flareID, playerID)`
  - If nil returned → `ErrFlareNotFound` (either not found or wrong owner)
- [x] Implement `ExpireFlares(ctx context.Context) (int64, error)`:
  - Call `repo.ExpireOldFlares(ctx)`
  - Return count of expired rows (for logging)
- [x] Constructor: `NewService(repo Repository, matchSvc MatchCreator, pool *pgxpool.Pool) *Service`

## Task 8 — Create internal/matchmaking/expirer.go

- [x] Define `FlareExpirer` struct:
  ```go
  type FlareExpirer struct {
      svc    *Service
      ticker *time.Ticker
      done   chan struct{}
  }
  ```
- [x] Implement `NewFlareExpirer(svc *Service, interval time.Duration) *FlareExpirer`
- [x] Implement `Start(ctx context.Context)`:
  ```go
  func (e *FlareExpirer) Start(ctx context.Context) {
      for {
          select {
          case <-e.ticker.C:
              count, err := e.svc.ExpireFlares(ctx)
              if err != nil {
                  log.Printf("[FlareExpirer] error: %v", err)
              } else if count > 0 {
                  log.Printf("[FlareExpirer] expired %d flares", count)
              }
          case <-ctx.Done():
              e.ticker.Stop()
              return
          }
      }
  }
  ```
- [x] Implement `Stop()` for graceful shutdown (closes `done` channel and stops ticker)
- [x] Default interval: 5 minutes (configurable via constructor)

## Task 9 — Create internal/matchmaking/handler.go

- [x] Define `Handler` struct with `svc *Service`
- [x] Implement `CreateFlare(w http.ResponseWriter, r *http.Request)`:
  - Extract `playerID` via `auth.GetUserID` — 401 if missing
  - Decode JSON body into `CreateFlareRequest` — 400 on decode error
  - Call `svc.CreateFlare`
  - Map sentinel errors: `ErrActiveFlareExists` → 409 with existing flare ID in problem detail
  - Return `response.JSON(w, 201, flareResponse)` on success
- [x] Implement `ListFlares(w http.ResponseWriter, r *http.Request)`:
  - Extract `userID`
  - Parse query params: `lat`, `lng` (required), `radius_km` (optional, default 10), `cursor` (optional), `page_size` (optional)
  - Call `svc.GetFlares`
  - Return `response.JSON(w, 200, listResponse)`
- [x] Implement `RespondToFlare(w http.ResponseWriter, r *http.Request)`:
  - Extract `playerID`
  - Extract `id` from URL via `chi.URLParam(r, "id")` — 400 if not valid UUID
  - Parse `uuid.Parse(id)` — 400 if invalid
  - Call `svc.RespondToFlare`
  - Map errors: `ErrFlareNotFound` → 404, `ErrFlareNotActive` → 409, `ErrAlreadyRespondent` → 409
  - Return `response.JSON(w, 200, flareResponse)` on success
- [x] Implement `CancelFlare(w http.ResponseWriter, r *http.Request)`:
  - Extract `playerID`
  - Extract `id` from URL
  - Call `svc.CancelFlare`
  - Map `ErrFlareNotFound` → 404, `ErrNotFlareOwner` → 403
  - Return `response.JSON(w, 204, nil)` on success
- [x] Constructor: `NewHandler(svc *Service) *Handler`

## Task 10 — Create internal/matchmaking/routes.go

- [x] Define `RegisterRoutes(r chi.Router, h *Handler)` function:
  ```go
  func RegisterRoutes(r chi.Router, h *Handler) {
      r.Post("/matchmaking/flares", h.CreateFlare)
      r.Get("/matchmaking/flares", h.ListFlares)
      r.Post("/matchmaking/flares/{id}/respond", h.RespondToFlare)
      r.Delete("/matchmaking/flares/{id}", h.CancelFlare)
  }
  ```

## Task 11 — Wire in main.go

- [x] Instantiate `PostgresFlareRepo` with pool and sqlc queries
- [x] Instantiate `MatchmakingService` with repo, match service adapter, and pool
- [x] Instantiate `MatchmakingHandler`
- [x] Register routes under authenticated router group:
  ```go
  r.Group(func(r chi.Router) {
      r.Use(auth.AuthMiddleware)
      matchmaking.RegisterRoutes(r, matchmakingHandler)
  })
  ```
- [x] Instantiate `FlareExpirer` with 5-minute interval
- [x] Start expirer in goroutine, passing the root context (for graceful shutdown):
  ```go
  expirer := matchmaking.NewFlareExpirer(matchmakingSvc, 5*time.Minute)
  go expirer.Start(rootCtx)
  ```
- [x] Verify the expirer goroutine stops cleanly when `rootCtx` is cancelled (SIGTERM handling)

## Task 12 — Integration Tests

- [x] Create `internal/matchmaking/integration_test.go`
- [x] Use Testcontainers with PostGIS image (`postgis/postgis:15-3.3`)
- [x] Run all migrations (including 000006) against test container
- [x] Test `CreateFlare`:
  - Happy path: creates flare, returns 201 with populated FlareResponse
  - Duplicate active flare: returns ErrActiveFlareExists
  - Invalid ScheduledAt (past): returns validation error
  - Lat/Lng out of bounds: returns validation error
- [x] Test `GetFlares`:
  - Seed 4 flares: 2 within radius + ELO match, 1 outside radius, 1 outside ELO range
  - Assert only 2 returned
  - Assert distance_meters populated
  - Assert cursor pagination works
- [x] Test `RespondToFlare` — happy path without match creation:
  - 1 respondent, min_players = 3 → flare stays `active`
- [x] Test `RespondToFlare` — triggers match creation:
  - 2 respondents, min_players = 2 → flare transitions to `matched`, match_id populated
  - Verify match was created in matches table
- [x] Test `RespondToFlare` — concurrency:
  - Two goroutines respond simultaneously → only one triggers CreateMatch
  - SELECT FOR UPDATE prevents double-create
- [x] Test `CancelFlare`:
  - Owner cancels → 204, status = 'cancelled'
  - Non-owner cancels → 403 / ErrNotFlareOwner
  - Already cancelled flare → 404
- [x] Test `ExpireFlares`:
  - Seed 2 active flares with expires_at in the past, 1 with future expiry
  - Run ExpireFlares
  - Assert 2 rows updated to 'expired', 1 unchanged
- [x] All tests must pass with `go test ./internal/matchmaking/... -tags integration`

## Task 13 — Build + Test Verification

- [x] `go build ./...` — zero errors
- [x] `go vet ./...` — zero warnings
- [x] `go test ./internal/matchmaking/...` — unit tests pass
- [x] `go test ./internal/matchmaking/... -tags integration` — integration tests pass
- [x] `go test ./internal/radar/... -tags integration` — confirm radar tests still pass (no regressions)
- [x] Manual smoke test against local Docker Compose:
  - POST /matchmaking/flares → 201
  - GET /matchmaking/flares?lat=X&lng=Y → 200 with list
  - POST /matchmaking/flares/{id}/respond → 200
  - DELETE /matchmaking/flares/{id} → 204
