# EPIC 08 — Perfil: Technical Design

## Architecture Overview

Extend the existing `internal/player/` package. No new domain created. Add new model types, repository methods, service methods, handlers, and routes within the established structure.

New table: `conduct_reports` (migration 000008).
New column: `users.preferences` JSONB (migration 000008).

```
internal/player/
├── model.go         — extend with PublicProfileResponse, PreferencesRequest, ReportRequest, ReportResponse
├── repository.go    — extend interface with new methods
├── postgres.go      — implement new methods
├── service.go       — add GetPublicProfile, UpdatePreferences, ReportConduct, GetAdminReports
├── handler.go       — add 4 new handlers
└── routes.go        — add 4 new routes
```

---

## Decision Log

### D1: Trust Score public display as category label

**Decision**: Map trust score to a string label before sending to any caller other than the profile owner.

**Mapping**:
```go
func trustLabel(score int32) string {
    switch {
    case score >= 90:
        return "Excelente"
    case score >= 70:
        return "Bueno"
    default:
        return "Bajo"
    }
}
```

**Self vs. public distinction**: The handler checks if `callerID == profileID`. If true, include the raw `trust_score` field. If false, include only `trust_label` and omit the numeric value entirely from the JSON response (use a separate response type or conditional field omission).

**Implementation**: Two distinct response structs — `PublicProfileResponse` (trust_label string, no trust_score) and `OwnProfileResponse` (embeds PublicProfileResponse, adds trust_score int32 and preferences). The handler selects which to serialize based on the ID comparison.

---

### D2: Soft-banned and hard-banned players return 404 on public profile

**Decision**: `status IN ('banned_soft', 'banned_hard')` → HTTP 404, not 403.

**Rationale**: 403 confirms the resource exists. 404 treats the player as non-existent from the public's perspective, preventing enumeration of banned accounts.

**Implementation**: The service layer's `GetPublicProfile` checks status after fetching from DB. If banned, return a `ErrPlayerNotFound` domain error (same error as when the player ID doesn't exist at all). The handler maps `ErrPlayerNotFound` → 404.

**Self-view exception**: When `callerID == profileID`, the player can always view their own profile regardless of status. This allows a banned player to see their own status. The service conditionally applies the ban check based on whether it's a self-view.

---

### D3: Conduct reports restricted to match participants

**Decision**: Before inserting a conduct report, verify the reporting player appears in `match_players` for the given match ID.

**Query**: `SELECT 1 FROM match_players WHERE match_id = $1 AND player_id = $2`

**Error case**: If the caller is not a participant, return HTTP 403 with `"not a participant of this match"`.

**Additional validations**:
- Match must exist and be in status `completed` — you can't report a match that hasn't been played
- A player can only submit one report per match (unique constraint on `(reporter_id, match_id)` in `conduct_reports`)
- The reported player must also be a participant of the same match

---

### D4: Preferences as JSONB with validated defaults

**Decision**: Store preferences as JSONB in `users.preferences` with the following schema and defaults:

```json
{
  "radar_radius_km": 10,
  "elo_min_delta": -200,
  "elo_max_delta": 200
}
```

**Column definition** (migration 000008):
```sql
ALTER TABLE users
ADD COLUMN preferences JSONB NOT NULL DEFAULT '{"radar_radius_km": 10, "elo_min_delta": -200, "elo_max_delta": 200}'::jsonb;
```

**Validation rules** (service layer, not DB):
- `radar_radius_km`: integer, 1–50 inclusive
- `elo_min_delta`: integer, -500 to 0 inclusive
- `elo_max_delta`: integer, 0 to 500 inclusive
- `elo_min_delta` must be ≤ `elo_max_delta` (trivially enforced by ranges but explicit check)

**Update strategy**: Full replacement (PUT semantics). Client sends the full preferences object; service validates and overwrites. Partial updates (PATCH) deferred.

**sqlc approach**: Use `json.RawMessage` or a dedicated `Preferences` Go struct with json tags. Prefer a typed Go struct marshaled to/from JSONB to avoid runtime JSON errors.

---

### D5: Admin reports endpoint filtered by moderator's region

**Decision**: Moderators can only see reports from matches played in their assigned region. This uses `RequireRegion` middleware to inject the region into the request context, and the repository filters accordingly.

**Query**: Join `conduct_reports` → `matches` → filter by `matches.region_id = moderator_region_id`.

**Pagination**: OFFSET-based for admin report list (predictable, low traffic, moderators don't paginate live feeds).

**Status filter**: Optional query param `status` (pending|reviewed|dismissed) to filter the queue.

**Response**: Array of `ReportResponse` with reporter, reported player, match ID, reason, status, and created_at.

---

## Migration Plan

### 000008_profile.up.sql

```sql
-- Add preferences column to users
ALTER TABLE users
ADD COLUMN preferences JSONB NOT NULL DEFAULT '{"radar_radius_km": 10, "elo_min_delta": -200, "elo_max_delta": 200}'::jsonb;

-- Create conduct_reports table
CREATE TABLE conduct_reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    reason        TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    moderator_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_report_per_match UNIQUE (reporter_id, match_id)
);

CREATE INDEX idx_conduct_reports_status ON conduct_reports (status);
CREATE INDEX idx_conduct_reports_reported ON conduct_reports (reported_id);
```

### 000008_profile.down.sql

```sql
DROP TABLE IF EXISTS conduct_reports;
ALTER TABLE users DROP COLUMN IF EXISTS preferences;
```

---

## Package Extension Design

### model.go additions

```go
type Preferences struct {
    RadarRadiusKM int32 `json:"radar_radius_km"`
    ELOMinDelta   int32 `json:"elo_min_delta"`
    ELOMaxDelta   int32 `json:"elo_max_delta"`
}

type PublicProfileResponse struct {
    ID                  uuid.UUID `json:"id"`
    Name                string    `json:"name"`
    ELO                 int32     `json:"elo"`
    TrustLabel          string    `json:"trust_label"`
    ValidatedMatchCount int32     `json:"validated_match_count"`
    RegionID            uuid.UUID `json:"region_id"`
}

type OwnProfileResponse struct {
    PublicProfileResponse
    TrustScore  int32       `json:"trust_score"`
    Preferences Preferences `json:"preferences"`
    Status      string      `json:"status"`
}

type PreferencesRequest struct {
    RadarRadiusKM int32 `json:"radar_radius_km"`
    ELOMinDelta   int32 `json:"elo_min_delta"`
    ELOMaxDelta   int32 `json:"elo_max_delta"`
}

type ReportRequest struct {
    ReportedID uuid.UUID `json:"reported_id"`
    Reason     string    `json:"reason"`
}

type ReportResponse struct {
    ID          uuid.UUID `json:"id"`
    ReporterID  uuid.UUID `json:"reporter_id"`
    ReportedID  uuid.UUID `json:"reported_id"`
    MatchID     uuid.UUID `json:"match_id"`
    Reason      string    `json:"reason"`
    Status      string    `json:"status"`
    CreatedAt   time.Time `json:"created_at"`
}
```

### repository.go additions (interface)

```go
GetPublicProfile(ctx context.Context, playerID uuid.UUID) (*db.GetPublicProfileRow, error)
GetOwnProfile(ctx context.Context, playerID uuid.UUID) (*db.GetOwnProfileRow, error)
UpdatePreferences(ctx context.Context, playerID uuid.UUID, prefs Preferences) error
CreateReport(ctx context.Context, arg db.CreateReportParams) (ReportResponse, error)
GetReportsByRegion(ctx context.Context, regionID uuid.UUID, status string, limit, offset int32) ([]ReportResponse, error)
IsMatchParticipant(ctx context.Context, matchID, playerID uuid.UUID) (bool, error)
IsMatchCompleted(ctx context.Context, matchID uuid.UUID) (bool, error)
```

### service.go additions

- `GetPublicProfile(ctx, callerID, profileID)` — fetches profile, applies ban check (skip if self), maps trust label
- `UpdatePreferences(ctx, playerID, req PreferencesRequest)` — validates ranges, delegates to repo
- `ReportConduct(ctx, reporterID, matchID, req ReportRequest)` — validates participant + match completed + reported player is participant, delegates to repo
- `GetAdminReports(ctx, moderatorRegionID, statusFilter, limit, offset)` — delegates to repo

---

## sqlc Queries

### queries/profiles.sql

- `GetPublicProfile` — SELECT from users excluding password_hash, including trust_score (service applies label mapping)
- `GetOwnProfile` — SELECT from users including preferences JSONB
- `UpdatePreferences` — UPDATE users SET preferences = $2 WHERE id = $1

### queries/conduct_reports.sql

- `CreateReport` — INSERT INTO conduct_reports
- `GetReportsByRegion` — JOIN with matches, filter by region_id, status, paginated
- `GetReportsByPlayer` — filter by reported_id
- `IsMatchParticipant` — EXISTS query on match_players
- `IsMatchCompleted` — check matches.status = 'completed'

---

## HTTP Contract

### GET /players/{id}
- Caller owns the ID → returns `OwnProfileResponse` (includes trust_score, preferences, status)
- Caller is different player → returns `PublicProfileResponse` (trust_label only, no trust_score)
- Player banned → 404
- Player not found → 404

### PUT /players/me/preferences
Body: `PreferencesRequest`
Response: updated `Preferences` object
Errors: 422 with validation details if out of range

### POST /matches/{id}/report
Body: `ReportRequest`
Response: `ReportResponse`
Errors: 403 if not participant, 409 if already reported, 422 if match not completed

### GET /admin/reports
Query params: `status` (pending|reviewed|dismissed, optional), `limit` (default 20), `offset` (default 0)
Auth: `RequireRole("moderator")` + `RequireRegion`
Response: `{ "reports": [...], "total": 15 }`

---

## Error Domain

Extend the existing error types in the player package:

```go
var (
    ErrPlayerNotFound    = errors.New("player not found")     // already exists
    ErrNotParticipant    = errors.New("not a participant of this match")
    ErrMatchNotCompleted = errors.New("match is not completed")
    ErrAlreadyReported   = errors.New("already reported this match")
    ErrInvalidPreferences = errors.New("invalid preferences values")
)
```

Handler maps:
- `ErrPlayerNotFound` → 404
- `ErrNotParticipant` → 403
- `ErrMatchNotCompleted` → 422
- `ErrAlreadyReported` → 409
- `ErrInvalidPreferences` → 422
