# Design: Epic 09 — Admin Panel / Tribunal

## Architecture Overview

A new `internal/admin` package follows the same layered pattern used by every other domain in
this codebase: `model → repository (interface) → postgres (implementation) → service → handler → routes`.

The package is self-contained. It receives the `auth.Repository` (for token revocation) and
`*db.Queries` (for its own SQL) as constructor arguments. No circular imports.

---

## Design Decisions

### D1 — KPI Cache (in-memory, 5-minute TTL)

KPIs are computed by a single aggregate SQL query. The result is cached in-process using a
`sync.Mutex`-protected struct that stores:

```go
type kpiCache struct {
    mu        sync.Mutex
    data      *KPIResponse
    fetchedAt time.Time
}
```

On each `GET /admin/kpis` request, the service acquires the lock, checks
`time.Since(fetchedAt) < 5*time.Minute`, and returns the cached value if still fresh.
Otherwise it re-executes the aggregate query, updates `data` and `fetchedAt`, then releases
the lock.

**Rationale:** Single-binary deployment makes a shared in-memory cache correct and sufficient.
No Redis dependency needed for this epic.

---

### D2 — Admin Audit Log Table (append-only)

New table `admin_audit_log`:

```sql
CREATE TABLE admin_audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id       UUID NOT NULL REFERENCES users(id),
    action         TEXT NOT NULL,
    target_user_id UUID REFERENCES users(id),
    details        JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `action` is a free-form string such as `"ban_player"`, `"unban_player"`, `"elo_adjust"`,
  `"create_moderator"`, `"update_moderator"`, `"delete_moderator"`.
- `details` stores action-specific data (e.g. `{"ban_type":"hard","reason":"cheating"}`).
- No `UPDATE` or `DELETE` is ever issued on this table from application code.
- Index on `(admin_id)` and `(created_at DESC)` for pagination queries.

---

### D3 — Soft Ban vs Hard Ban

| Aspect | Soft Ban (`banned_soft`) | Hard Ban (`banned_hard`) |
|--------|--------------------------|--------------------------|
| Status | `banned_soft` | `banned_hard` |
| Visible in rankings | No | No |
| Visible in radar | No | No |
| Can log in | Yes (token still valid) | No (tokens revoked) |
| Token revocation | None | `auth.RevokeAllUserTokens` |
| Reversible | Yes, via unban | Yes, via unban |

`unban` sets status back to `active` regardless of previous ban type.

The leaderboard and radar packages already filter by status — `banned_soft` and `banned_hard`
are simply not `active`, so they are automatically excluded from those queries once status is set.

---

### D4 — ELO Recalibration

Manual ELO adjustments go through the same `elo_history` table with a distinct `type`:

```
type = 'manual_adjustment'
match_id = nil UUID (00000000-0000-0000-0000-000000000000)
```

The `ranking` package's `InsertELOHistory` already accepts a `match_id` parameter. The admin
service calls it directly rather than going through the ranking service, since there is no
match FSM involved.

ELO floor is `max(0, currentELO + delta)`. No ceiling is enforced.

---

### D5 — Moderator Creation / Promotion

Two paths:

1. **New user:** Create a user with `role = 'moderator'`, `status = 'active'`, and set
   `region_id` from the request. No password is set at creation — a password-reset flow is
   out of scope; the initial password is included in the request for now.

2. **Promote existing player:** Caller provides an existing `user_id` and a `region_id`. The
   service updates `role = 'moderator'` and `region_id` on the existing user.

The `POST /admin/moderators` request body includes an optional `user_id` field to distinguish
the two paths.

Demotion (`DELETE /admin/moderators/{id}`) sets `role = 'player'` and clears `region_id`.

---

### D6 — Audit Logging for All Admin Actions

Every mutating endpoint in the admin package calls `repo.InsertAuditLog` as the last step
inside the same database call (not a transaction for simplicity — audit log failure does not
roll back the action). If strict atomicity is required in the future, both writes can be
wrapped in a single `pgx` transaction.

---

### Migration

**File:** `000009_admin.up.sql` / `000009_admin.down.sql`

Up migration creates `admin_audit_log` with indexes.
Down migration drops `admin_audit_log`.

---

### sqlc Queries

New query file: `queries/admin.sql`

Queries:
- `GetKPIs` — single aggregate SELECT
- `ListModerators` — SELECT users WHERE role = 'moderator'
- `CreateModerator` — INSERT user with role moderator
- `UpdateModerator` — UPDATE region_id (and optionally other fields) by id
- `DeleteModerator` — UPDATE role='player', region_id=NULL by id
- `BanPlayer` — UPDATE users SET status=$2 WHERE id=$1
- `UnbanPlayer` — UPDATE users SET status='active' WHERE id=$1
- `GetUserELO` — SELECT elo FROM users WHERE id=$1
- `UpdateUserELO` — UPDATE users SET elo=$2 WHERE id=$1
- `InsertAuditLog` — INSERT INTO admin_audit_log
- `ListAuditLog` — SELECT ... ORDER BY created_at DESC LIMIT $1 OFFSET $2
- `CountAuditLog` — SELECT count(*) FROM admin_audit_log

---

### Package Structure

```
internal/admin/
├── model.go            # Domain types: KPIResponse, BanRequest, ELOAdjustRequest,
│                       #   ModeratorRequest, ModeratorResponse, AuditLogEntry
├── repository.go       # Repository interface
├── postgres.go         # PostgresRepo implementing Repository
├── service.go          # Service with KPI cache + business logic
├── handler.go          # HTTP handlers
├── routes.go           # Route registration with RequireRole middleware
└── integration_test.go # Tests using testcontainers
```

---

### Wire-up in main.go

```go
adminRepo  := admin.NewPostgresRepo(queries)
adminSvc   := admin.NewService(adminRepo, authRepo)
adminH     := admin.NewHandler(adminSvc)
admin.RegisterRoutes(r, adminH, authMw)
```

`authRepo` is already constructed earlier in `main.go` for the auth package.
