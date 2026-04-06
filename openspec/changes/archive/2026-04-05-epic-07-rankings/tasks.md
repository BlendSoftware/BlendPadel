# EPIC 07 — Rankings: Implementation Tasks

## Status: implemented

---

## T01 — Migration 000007_regions_seed

- [x] Create `db/migrations/000007_regions_seed.up.sql`
  - INSERT Gran Mendoza with approximate WKT POLYGON boundary (departments: Capital, Godoy Cruz, Las Heras, Guaymallén, Maipú)
  - INSERT Zona Este with approximate WKT POLYGON boundary (departments: San Martín, Rivadavia, Junín, Santa Rosa)
  - INSERT Valle de Uco with approximate WKT POLYGON boundary (departments: Tunuyán, Tupungato, San Carlos)
  - INSERT Sur with approximate WKT POLYGON boundary (departments: San Rafael, Malargüe, General Alvear)
  - Use `ST_GeomFromText('POLYGON((<lng lat>, ...))', 4326)` format consistent with EPIC 00 PostGIS setup
  - CREATE INDEX IF NOT EXISTS `idx_users_region_elo` ON `users (region_id, status, elo DESC)`

- [x] Create `db/migrations/000007_regions_seed.down.sql`
  - DELETE FROM regions WHERE name IN ('Gran Mendoza', 'Zona Este', 'Valle de Uco', 'Sur')
  - DROP INDEX IF EXISTS idx_users_region_elo

---

## T02 — sqlc queries: rankings.sql

- [x] Create `db/queries/rankings.sql`
  - `GetRankingByRegion`: SELECT id, name, elo, validated_match_count + RANK() OVER (ORDER BY elo DESC) WHERE region_id=$1 AND status='active' ORDER BY elo DESC LIMIT $2 OFFSET $3
  - `GetPlayerRank`: subquery returning the rank of a specific player within their region (use CTE or inline RANK())
  - `GetAllRegions`: SELECT id, name FROM regions ORDER BY name
  - `CreateRegion`: INSERT INTO regions (name, boundary) VALUES ($1, ST_GeomFromText($2, 4326)) RETURNING id, name

---

## T03 — sqlc queries: elo_history_extended.sql

- [x] Create `db/queries/elo_history_extended.sql`
  - `GetELOHistoryWithOpponents`:
    - SELECT eh.id, eh.match_id, eh.elo_before, eh.elo_after, (eh.elo_after - eh.elo_before) AS delta, eh.created_at, u.id AS opponent_id, u.name AS opponent_name
    - FROM elo_history eh
    - JOIN match_players mp ON mp.match_id = eh.match_id AND mp.player_id != $1
    - JOIN users u ON u.id = mp.player_id
    - WHERE eh.player_id = $1 AND ($2::timestamptz IS NULL OR eh.created_at < $2)
    - ORDER BY eh.created_at DESC, eh.id DESC LIMIT $3
    - Note: cursor is a timestamptz (not int) because elo_history.id is UUID, not sequential int

---

## T04 — Run sqlc generate

- [x] Run `sqlc generate` from project root
- [x] Verify no compile errors in generated `db/sqlc/` files
- [x] Confirm new query functions appear: `GetRankingByRegion`, `GetPlayerRank`, `GetAllRegions`, `CreateRegion`, `GetELOHistoryWithOpponents`

---

## T05 — internal/leaderboard/model.go

- [x] Create `internal/leaderboard/model.go`
  - Package declaration: `package leaderboard`
  - `RankingEntry` struct: Rank int64, PlayerID uuid.UUID, Name string, ELO int32, ValidatedMatchCount int32 — all with JSON tags
  - `RegionResponse` struct: ID uuid.UUID, Name string
  - `ProjectionResult` struct: CurrentELO int32, ProjectedELO int32, Delta int32, OpponentELO int32, ExpectedScore float64
  - `ELOHistoryEntry` struct: ID uuid.UUID, MatchID uuid.UUID, ELOBefore int32, ELOAfter int32, Delta int32, OpponentName string, OpponentID uuid.UUID, CreatedAt time.Time
  - `ELOHistoryPage` struct: Entries []ELOHistoryEntry, NextCursor *int64 (Unix nanoseconds of last entry's CreatedAt)
  - `RankingPage` struct: RegionID uuid.UUID, RegionName string, Entries []RankingEntry, Total int64

---

## T06 — internal/leaderboard/repository.go

- [x] Create `internal/leaderboard/repository.go`
  - Interface `Repository` with methods:
    - `GetRankingByRegion(ctx context.Context, regionID uuid.UUID, limit, offset int32) ([]RankingEntry, error)`
    - `GetPlayerRank(ctx context.Context, playerID uuid.UUID) (int64, error)`
    - `GetAllRegions(ctx context.Context) ([]RegionResponse, error)`
    - `CreateRegion(ctx context.Context, name string, boundaryWKT string) (RegionResponse, error)`
    - `GetELOHistoryWithOpponents(ctx context.Context, playerID uuid.UUID, cursor *int64, limit int32) (ELOHistoryPage, error)`

---

## T07 — internal/leaderboard/postgres.go

- [x] Create `internal/leaderboard/postgres.go`
  - Struct `postgresRepo` with `queries *db.Queries` field
  - Constructor `NewPostgresRepo(q *db.Queries) Repository`
  - Implement `GetRankingByRegion`: call `q.GetRankingByRegion(...)`, map rows to `[]RankingEntry`
  - Implement `GetPlayerRank`: call `q.GetPlayerRank(...)`, return rank int64
  - Implement `GetAllRegions`: call `q.GetAllRegions(...)`, map to `[]RegionResponse`
  - Implement `CreateRegion`: call `q.CreateRegion(...)`, handle PostGIS WKT param, map to `RegionResponse`
  - Implement `GetELOHistoryWithOpponents`: call `q.GetELOHistoryWithOpponents(...)`, handle nil cursor (pass NULL timestamptz), map rows to `ELOHistoryPage` including NextCursor logic (if len(rows) == limit, set NextCursor = &lastCreatedAt.UnixNano())

---

## T08 — internal/leaderboard/service.go

- [x] Create `internal/leaderboard/service.go`
  - Struct `Service` with `repo Repository` and `playerRepo playerRepository` (interface for fetching player ELO)
  - Constructor `NewService(repo Repository, playerRepo playerRepository) *Service`
  - Implement `GetRanking(ctx, callerID uuid.UUID, regionID *uuid.UUID, limit, offset int32) (RankingPage, error)`
  - Implement `GetPlayerRank(ctx, playerID uuid.UUID) (int64, error)`: delegate to repo
  - Implement `CreateRegion(ctx, name, boundaryWKT string) (RegionResponse, error)`: delegate to repo
  - Implement `GetRegions(ctx) ([]RegionResponse, error)`: delegate to repo
  - Implement `ProjectELO(ctx, callerID, opponentID uuid.UUID, result string) (ProjectionResult, error)`:
    - Uses `ranking.CalcExpected` and direct K-factor + score computation (M=1.0)
    - Returns ErrUnknownResult for invalid result values
  - Implement `GetELOHistory(ctx, playerID uuid.UUID, cursor *int64, limit int32) (ELOHistoryPage, error)`:
    - Validate limit (1–50, default 20)
    - Delegate to repo.GetELOHistoryWithOpponents

---

## T09 — internal/leaderboard/handler.go

- [x] Create `internal/leaderboard/handler.go`
  - Struct `Handler` with `svc *Service`
  - Constructor `NewHandler(svc *Service) *Handler`
  - `GetRanking(w http.ResponseWriter, r *http.Request)`: falls back to JWT region claim if region_id not in query
  - `CreateRegion(w http.ResponseWriter, r *http.Request)`: decode body, respond 201
  - `GetRegions(w http.ResponseWriter, r *http.Request)`: returns `{ "regions": [...] }`
  - `ProjectELO(w http.ResponseWriter, r *http.Request)`: ErrUnknownResult → 422
  - `GetELOHistory(w http.ResponseWriter, r *http.Request)`: cursor as int64 Unix nanoseconds

---

## T10 — internal/leaderboard/routes.go

- [x] Create `internal/leaderboard/routes.go`
  - Function `RegisterRoutes(r chi.Router, h *Handler, authMiddleware, requireSuperAdmin func(http.Handler) http.Handler)`
  - Route registrations:
    ```
    r.Get("/regions", h.GetRegions)                         -- public
    r.With(authMiddleware).Get("/rankings", h.GetRanking)
    r.With(authMiddleware).Get("/matches/projection", h.ProjectELO)
    r.With(authMiddleware).Get("/players/me/elo-history", h.GetELOHistory)
    r.With(authMiddleware, requireSuperAdmin).Post("/admin/regions", h.CreateRegion)
    ```

---

## T11 — Wire in main.go

- [x] Import `internal/leaderboard` package in `cmd/server/main.go`
- [x] Instantiate `leaderboard.NewPostgresRepo(queries)`
- [x] Instantiate `leaderboard.NewService(repo, rankingRepo)` — reuses existing rankingRepo instance as playerRepo
- [x] Instantiate `leaderboard.NewHandler(svc)`
- [x] Call `leaderboard.RegisterRoutes(r, leaderboardHandler, authMw, auth.RequireRole("superadmin"))`

---

## T12 — Apply migration

- [x] Run migration — applied via embedded FS (app auto-migrates on startup)
- [x] Verify 4 regions exist in DB: Gran Mendoza, Sur, Valle de Uco, Zona Este ✓
- [x] Verify index exists: idx_users_region_elo ✓

---

## T13 — Integration tests

- [x] Create `internal/leaderboard/integration_test.go`
  - Test `GetRanking`: 3 active players, verified rank order (highest ELO = rank 1) ✓
  - Test `GetRanking` with region filter: players in different regions excluded ✓
  - Test `GetRanking` excludes non-active players ✓
  - Test `ProjectELO` — win scenario: underdog gains ELO, expected < 0.5 ✓
  - Test `ProjectELO` — lose scenario: ELO goes down ✓
  - Test `ProjectELO` — invalid result string: ErrUnknownResult ✓
  - Test `GetELOHistory` — cursor pagination: NextCursor set when results==limit, nil when fewer ✓
  - Test `GetELOHistory` — opponent name appears in result ✓
  - Test `GetRegions` — returns seeded Mendoza regions ✓
  - Test `CreateRegion` — new region appears in GetRegions ✓
  - Test `GetPlayerRank` — highest ELO returns rank 1 ✓

---

## T14 — Build and test verification

- [x] `go build ./internal/leaderboard/...` — zero errors ✓
- [x] `go test ./internal/leaderboard/... -v` — all 11 tests pass ✓
- [x] `go vet ./internal/leaderboard/...` — zero warnings ✓
- Note: `go build ./...` shows a pre-existing error in `internal/matchmaking/postgres.go` (type mismatch unrelated to EPIC 07)
