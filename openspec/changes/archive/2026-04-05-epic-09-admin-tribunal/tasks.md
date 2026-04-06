# Tasks: Epic 09 — Admin Panel / Tribunal

## Task Checklist

### T1 — Migration 000009_admin
- [x] Create `migrations/000009_admin.up.sql` with `admin_audit_log` table and indexes
- [x] Create `migrations/000009_admin.down.sql` to drop the table
- [x] Apply migration to Docker postgres (`psql blendpadel/password/blendpadel`)
- [x] Verify migration runs cleanly via `database.RunMigrations`

### T2 — sqlc Queries
- [x] Create `queries/admin.sql` with the following named queries:
  - `GetKPIs` — aggregate SELECT for all KPI counters
  - `ListModerators` — SELECT users WHERE role = 'moderator' ORDER BY created_at
  - `CreateModerator` — INSERT into users with role='moderator', region_id, password_hash
  - `UpdateModerator` — UPDATE users SET region_id=$2 WHERE id=$1 AND role='moderator'
  - `DeleteModerator` — UPDATE users SET role='player', region_id=NULL WHERE id=$1
  - `BanPlayer` — UPDATE users SET status=$2 WHERE id=$1
  - `UnbanPlayer` — UPDATE users SET status='active' WHERE id=$1
  - `GetUserELO` — SELECT elo FROM users WHERE id=$1
  - `UpdateUserELO` — UPDATE users SET elo=$2 WHERE id=$1
  - `InsertAuditLog` — INSERT INTO admin_audit_log(admin_id, action, target_user_id, details)
  - `ListAuditLog` — paginated SELECT with optional admin_id filter
  - `CountAuditLog` — count for pagination
- [x] Run `sqlc generate` and verify no errors
- [x] Confirm generated types in `internal/db/admin.sql.go`

### T3 — internal/admin/model.go
- [x] Define `KPIResponse` struct (all KPI counters as int64/float64)
- [x] Define `ModeratorRequest` (create/update body)
- [x] Define `ModeratorResponse` (list item)
- [x] Define `BanRequest` with `type` field (`soft` | `hard`) and `reason`
- [x] Define `ELOAdjustRequest` with `delta int` and `reason string`
- [x] Define `AuditLogEntry` with all `admin_audit_log` fields
- [x] Define `AuditLogListResponse` with pagination envelope
- [x] Define sentinel errors: `ErrPlayerNotFound`, `ErrModeratorNotFound`, `ErrInvalidBanType`

### T4 — internal/admin/repository.go
- [x] Define `Repository` interface with methods:
  - `GetKPIs(ctx) (*KPIResponse, error)`
  - `ListModerators(ctx) ([]ModeratorResponse, error)`
  - `CreateModerator(ctx, req ModeratorRequest) (*ModeratorResponse, error)`
  - `UpdateModerator(ctx, id uuid.UUID, req ModeratorRequest) (*ModeratorResponse, error)`
  - `DeleteModerator(ctx, id uuid.UUID) error`
  - `BanPlayer(ctx, playerID uuid.UUID, status string) error`
  - `UnbanPlayer(ctx, playerID uuid.UUID) error`
  - `GetUserELO(ctx, playerID uuid.UUID) (int, error)`
  - `UpdateUserELO(ctx, playerID uuid.UUID, newELO int) error`
  - `InsertAuditLog(ctx, adminID uuid.UUID, action string, targetID *uuid.UUID, details any) error`
  - `ListAuditLog(ctx, adminID *uuid.UUID, limit, offset int32) ([]AuditLogEntry, error)`
  - `CountAuditLog(ctx, adminID *uuid.UUID) (int64, error)`

### T5 — internal/admin/postgres.go
- [x] Implement `PostgresRepo` backed by `*db.Queries`
- [x] `GetKPIs`: call generated `GetKPIs` query, map to `KPIResponse`
- [x] `ListModerators`: call `ListModerators` query, map rows to `[]ModeratorResponse`
- [x] `CreateModerator`: call `CreateModerator` query with hashed password, return response
- [x] `UpdateModerator`: call `UpdateModerator` query, return updated row
- [x] `DeleteModerator`: call `DeleteModerator` query; return `ErrModeratorNotFound` on no-op
- [x] `BanPlayer` / `UnbanPlayer`: call corresponding queries
- [x] `GetUserELO` / `UpdateUserELO`: map to/from int32 for pgx
- [x] `InsertAuditLog`: marshal details to JSONB, call insert query
- [x] `ListAuditLog` / `CountAuditLog`: handle optional admin_id filter

### T6 — internal/admin/service.go (KPI cache + business logic)
- [x] Define `kpiCache` struct with `sync.Mutex`, `*KPIResponse`, `time.Time`
- [x] `Service` holds `repo Repository`, `authRepo auth.Repository`, `cache kpiCache`
- [x] `GetKPIs`: lock, check TTL (5 min), fetch if stale, update cache, return
- [x] `ListModerators` / `CreateModerator` / `UpdateModerator` / `DeleteModerator`:
  delegate to repo, call `InsertAuditLog` after each mutation
- [x] `BanPlayer`:
  - Validate `type` field (`soft` → `banned_soft`, `hard` → `banned_hard`)
  - Call `repo.BanPlayer` with computed status
  - If hard ban: call `authRepo.RevokeAllUserTokens(ctx, playerID)`
  - Call `InsertAuditLog` with ban details
- [x] `UnbanPlayer`: call `repo.UnbanPlayer`, log audit
- [x] `AdjustELO`:
  - Call `repo.GetUserELO` to get current ELO
  - Compute `newELO = max(0, currentELO + delta)`
  - Call `repo.UpdateUserELO`
  - Call `InsertELOHistory` with `type='manual_adjustment'`
  - Call `InsertAuditLog`
- [x] `GetAuditLog`: delegate to repo with pagination params

### T7 — internal/admin/handler.go
- [x] `GetKPIs`: no body, call svc.GetKPIs, return 200 JSON
- [x] `ListModerators`: call svc.ListModerators, return 200 JSON array
- [x] `CreateModerator`: decode body, call svc.CreateModerator, return 201 JSON
- [x] `UpdateModerator`: parse `{id}`, decode body, call svc.UpdateModerator, return 200 JSON
- [x] `DeleteModerator`: parse `{id}`, call svc.DeleteModerator, return 204
- [x] `BanPlayer`: parse `{id}`, decode `BanRequest`, call svc.BanPlayer, return 200
- [x] `UnbanPlayer`: parse `{id}`, call svc.UnbanPlayer, return 200
- [x] `AdjustELO`: parse `{id}`, decode `ELOAdjustRequest`, call svc.AdjustELO, return 200
- [x] `GetAuditLog`: parse `limit`/`offset`/`admin_id` query params, call svc.GetAuditLog, return 200
- [x] Map sentinel errors to HTTP codes: `ErrPlayerNotFound` → 404, `ErrModeratorNotFound` → 404,
  `ErrInvalidBanType` → 400

### T8 — internal/admin/routes.go
- [x] Define `RegisterRoutes(r chi.Router, h *Handler, authMw func(http.Handler) http.Handler)`
- [x] All routes under `/admin` group with `authMw` + `RequireRole("superadmin")`:
  ```
  GET    /admin/kpis
  GET    /admin/moderators
  POST   /admin/moderators
  PUT    /admin/moderators/{id}
  DELETE /admin/moderators/{id}
  POST   /admin/players/{id}/ban
  POST   /admin/players/{id}/unban
  POST   /admin/players/{id}/elo-adjust
  GET    /admin/audit-log
  ```
- [x] Note: `/admin/disputes` and `/admin/disputes/{id}/resolve` remain in `match` package

### T9 — Wire in cmd/server/main.go
- [x] Import `github.com/juani/blendpadel/backend/internal/admin`
- [x] After `authRepo` and `queries` are available:
  ```go
  adminRepo := admin.NewPostgresRepo(queries)
  adminSvc  := admin.NewService(adminRepo, authRepo)
  adminH    := admin.NewHandler(adminSvc)
  admin.RegisterRoutes(r, adminH, authMw)
  ```
- [x] Add log line: `log.Info().Msg("admin routes registered")`

### T10 — internal/admin/integration_test.go
- [x] Setup test DB via testcontainers (same pattern as leaderboard tests)
- [x] `TestGetKPIs_ReturnsMetrics`: seed 3 active players, 1 banned, 1 moderator; call GetKPIs; assert counts
- [x] `TestKPICache_ServedFromCache`: call GetKPIs twice in < 5 min; assert DB query called once
- [x] `TestBanPlayer_SoftBan`: seed player, ban soft, verify status='banned_soft', tokens NOT revoked
- [x] `TestBanPlayer_HardBan`: seed player + token, ban hard, verify status='banned_hard' AND token revoked
- [x] `TestUnbanPlayer`: seed banned player, unban, verify status='active'
- [x] `TestAdjustELO_PositiveDelta`: adjust +100, verify elo updated and elo_history row inserted
- [x] `TestAdjustELO_NegativeDeltaFloor`: adjust -99999, verify elo floored to 0
- [x] `TestModeratorCRUD`: create, list, update region, delete; verify role changes
- [x] `TestAuditLog_RecordsActions`: perform ban + ELO adjust; query audit log; assert 2 entries

### T11 — Build and Test Verification
- [x] Run `go build ./internal/...` — no errors (cmd/server has pre-existing epic-10 compile errors unrelated to this epic)
- [x] Run `go test ./internal/admin/...` — 9/9 tests pass
- [x] Mark all tasks above as [x] in this file
