# Proposal: Epic 09 — Admin Panel / Tribunal

## Intent

Provide superadmin operators and moderators with a set of HTTP endpoints to manage the platform:
view operational KPIs, administer moderator accounts, enforce bans, recalibrate player ELO scores,
and maintain a full audit trail of every admin action.

This epic covers **backend API only** — no React frontend is in scope.

---

## Scope

### US-043 — KPIs Dashboard

**Endpoint:** `GET /admin/kpis`  
**Role:** `superadmin`

Returns a snapshot of operational metrics computed via aggregate SQL queries. The result is
cached in-memory for 5 minutes (sync.Mutex + timestamp) to avoid hammering the DB on every
request.

Metrics returned:
- `total_players` — total users with role `player`
- `active_players` — players with status `active`
- `banned_players` — players with status `banned_soft` or `banned_hard`
- `total_matches` — total rows in `matches`
- `completed_matches` — matches with status `completed`
- `pending_disputes` — disputes with status `pending`
- `avg_elo` — average ELO across all active players
- `total_moderators` — users with role `moderator`

---

### US-044 — Moderator CRUD

**Endpoints:**
- `GET    /admin/moderators` — list all moderators
- `POST   /admin/moderators` — create or promote user to moderator
- `PUT    /admin/moderators/{id}` — update moderator (e.g. reassign region)
- `DELETE /admin/moderators/{id}` — demote or deactivate moderator

**Role:** `superadmin`

Creating a moderator either creates a new user with role `moderator` and an assigned `region_id`,
or upgrades an existing player by changing their role to `moderator`. Every operation is logged
in `admin_audit_log`.

---

### US-045 — Ban / Unban Players

**Endpoints:**
- `POST /admin/players/{id}/ban`
- `POST /admin/players/{id}/unban`

**Role:** `superadmin`

Two severity levels are supported via a `type` field in the request body:

- **Soft ban** (`banned_soft`): player status is set to `banned_soft`. The player is invisible
  in rankings and radar but retains their account. Tokens are **not** revoked.
- **Hard ban** (`banned_hard`): player status is set to `banned_hard`. Login is blocked and
  all existing refresh tokens are revoked immediately via `auth.Repository.RevokeAllUserTokens`.

Unban restores status to `active`.

Ban reason is stored in `admin_audit_log.details`.

---

### US-046 — ELO Recalibration

**Endpoint:** `POST /admin/players/{id}/elo-adjust`  
**Role:** `superadmin`

Allows manual ELO adjustment for edge cases (data corrections, special events). The operation:

1. Reads current ELO from `users`.
2. Computes new ELO = current + delta (delta may be negative).
3. Applies a floor of 0.
4. Updates `users.elo`.
5. Inserts a row in `elo_history` with `type = 'manual_adjustment'` and `match_id = NULL`
   (nil UUID, since no match is associated).
6. Logs the action in `admin_audit_log` with the old/new ELO in `details`.

---

### US-047 — Admin Audit Log

**Endpoint:** `GET /admin/audit-log`  
**Role:** `superadmin`

Returns a paginated list of all admin actions, ordered by `created_at DESC`.

Supports query parameters:
- `limit` (default 50, max 200)
- `offset` (default 0)
- `admin_id` (optional UUID filter)

The `admin_audit_log` table is append-only; no updates or deletes are performed on it.

---

## Out of Scope

- React admin frontend (separate epic)
- Dispute resolution endpoints (already exist in `match` package)
- Email/notification on ban (separate notification epic)

---

## Risks

- Hard ban token revocation is synchronous and proportional to number of active tokens — acceptable for now.
- KPI cache is per-process (single instance); this is fine for the current deployment model.
- ELO manual adjustment bypasses the FSM and could cause inconsistencies if misused — mitigated by audit log and superadmin-only access.
