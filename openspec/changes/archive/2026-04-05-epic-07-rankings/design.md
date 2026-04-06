# EPIC 07 — Rankings: Technical Design

## Architecture Overview

New domain package `internal/leaderboard/` following the same layered pattern as existing domains:

```
internal/leaderboard/
├── model.go         — domain types (RankingEntry, RegionResponse, ProjectionResult, ELOHistoryEntry)
├── repository.go    — interface definition
├── postgres.go      — sqlc-backed implementation
├── service.go       — business logic (projection, history, region CRUD)
├── handler.go       — HTTP handlers (5 endpoints)
└── routes.go        — route registration
```

No new tables. Migration 000007 is data-only (region seed inserts).

---

## Decision Log

### D1: Rankings computed on-the-fly with RANK() OVER window function

**Decision**: Use a single query with `RANK() OVER (PARTITION BY region_id ORDER BY elo DESC)` at query time. No materialized view, no caching layer.

**Rationale**: The player base per region at MVP scale (hundreds, not hundreds of thousands) makes a sequential scan with a composite index negligible. A materialized view introduces refresh complexity, stale data windows, and operational burden that isn't justified yet.

**Query shape**:
```sql
SELECT
    u.id,
    u.name,
    u.elo,
    u.validated_match_count,
    RANK() OVER (ORDER BY u.elo DESC) AS rank
FROM users u
WHERE u.region_id = $1
  AND u.status = 'active'
ORDER BY u.elo DESC
LIMIT $2 OFFSET $3;
```

**Index required**: `CREATE INDEX IF NOT EXISTS idx_users_region_elo ON users (region_id, status, elo DESC);` — add to migration 000007 or as a standalone migration. Since this is a seed-only migration, add it there.

**Future path**: If rankings become a performance bottleneck (> 10k active players per region), promote to a materialized view refreshed on ELO update events via a Postgres trigger or a background job.

---

### D2: Regions seeded via migration data

**Decision**: Seed the four Mendoza regions in `000007_regions_seed.up.sql` using `INSERT INTO regions` with approximate PostGIS polygon boundaries.

**Polygon encoding**: GeoJSON-style WKT passed to `ST_GeomFromText(wkt, 4326)`. SRID 4326 (WGS84) consistent with PostGIS setup from EPIC 00.

**Four zones**:

| ID | Name | Approximate coverage |
|----|------|---------------------|
| 1 (or next seq) | Gran Mendoza | Capital, Godoy Cruz, Las Heras, Guaymallén, Maipú |
| 2 | Zona Este | San Martín, Rivadavia, Junín, Santa Rosa |
| 3 | Valle de Uco | Tunuyán, Tupungato, San Carlos |
| 4 | Sur | San Rafael, Malargüe, General Alvear |

**Down migration**: `DELETE FROM regions WHERE name IN ('Gran Mendoza', 'Zona Este', 'Valle de Uco', 'Sur');` — safe because the regions table FK from users will cascade or error, making accidental down-migration visible immediately.

**Constraint**: Polygon boundaries are approximate (hand-drawn bounding boxes from department coordinates). Exact shapes are not needed for MVP — region assignment happens at registration, not by spatial containment of the player's GPS coordinates.

---

### D3: ELO projection is read-only — pure function, no DB write

**Decision**: The `/matches/projection` endpoint accepts query params `opponent_id` (or `opponent_elo`) and `result` (win/lose/draw), looks up the calling player's current ELO and the opponent's ELO from the DB, then runs the pure functions from the `ranking` package. No writes.

**Function chain**:
```go
expected := ranking.CalcExpected(playerELO, opponentELO)
// For win: actualScore = 1.0, for loss: 0.0, for draw: 0.5
projected := ranking.CalcNewELO(playerELO, kFactor, actualScore, expected)
// margin multiplier M=1.0 (match not played yet, no margin known)
delta := int(math.Round(projected)) - playerELO
```

**K-factor**: Use same K-factor logic as the match service (likely dynamic based on `validated_match_count`). Service layer reads the player's match count to determine K.

**Response**:
```json
{
  "current_elo": 1423,
  "projected_elo": 1447,
  "delta": 24,
  "opponent_elo": 1480,
  "expected_score": 0.38
}
```

---

### D4: ELO history served from elo_history with cursor pagination and opponent names

**Decision**: Use cursor-based pagination (last seen `id`) on the `elo_history` table. Join with `matches` and `match_players` to surface opponent names.

**Why cursor over OFFSET**: New ELO history entries are inserted frequently. OFFSET-based pagination drifts as new rows are prepended in reverse-chronological order. Cursor pagination anchors to a stable row ID.

**Query shape**:
```sql
SELECT
    eh.id,
    eh.match_id,
    eh.elo_before,
    eh.elo_after,
    eh.delta,
    eh.created_at,
    u.name AS opponent_name,
    u.id AS opponent_id
FROM elo_history eh
JOIN match_players mp ON mp.match_id = eh.match_id AND mp.player_id != eh.player_id
JOIN users u ON u.id = mp.player_id
WHERE eh.player_id = $1
  AND ($2::int IS NULL OR eh.id < $2)
ORDER BY eh.id DESC
LIMIT $3;
```

**Cursor**: Client sends `?cursor=<last_id>&limit=20`. Response includes `next_cursor` (null if no more results).

**Note**: This query assumes 1v1 matches. For 2v2, the JOIN on `match_players` returns multiple opponents — aggregate or take the first opponent alphabetically for display. Document this assumption.

---

### D5: Region creation restricted to superadmin

**Decision**: `POST /admin/regions` requires `RequireRole("superadmin")` middleware. Regular moderators and players cannot create regions.

**Rationale**: Region boundaries define how the entire ranking system is segmented. Incorrect regions would pollute all rankings. Superadmin-only is the right gate for MVP.

**Route registration**:
```go
r.With(middleware.RequireRole("superadmin")).Post("/admin/regions", h.CreateRegion)
```

---

## Package Design

### model.go

```go
type RankingEntry struct {
    Rank               int64   `json:"rank"`
    PlayerID           uuid.UUID `json:"player_id"`
    Name               string  `json:"name"`
    ELO                int32   `json:"elo"`
    ValidatedMatchCount int32  `json:"validated_match_count"`
}

type RegionResponse struct {
    ID   uuid.UUID `json:"id"`
    Name string    `json:"name"`
}

type ProjectionResult struct {
    CurrentELO    int32   `json:"current_elo"`
    ProjectedELO  int32   `json:"projected_elo"`
    Delta         int32   `json:"delta"`
    OpponentELO   int32   `json:"opponent_elo"`
    ExpectedScore float64 `json:"expected_score"`
}

type ELOHistoryEntry struct {
    ID           int64     `json:"id"`
    MatchID      uuid.UUID `json:"match_id"`
    ELOBefore    int32     `json:"elo_before"`
    ELOAfter     int32     `json:"elo_after"`
    Delta        int32     `json:"delta"`
    OpponentName string    `json:"opponent_name"`
    OpponentID   uuid.UUID `json:"opponent_id"`
    CreatedAt    time.Time `json:"created_at"`
}

type ELOHistoryPage struct {
    Entries    []ELOHistoryEntry `json:"entries"`
    NextCursor *int64            `json:"next_cursor"`
}
```

### repository.go (interface)

```go
type Repository interface {
    GetRankingByRegion(ctx context.Context, regionID uuid.UUID, limit, offset int32) ([]RankingEntry, error)
    GetPlayerRank(ctx context.Context, playerID uuid.UUID) (int64, error)
    GetAllRegions(ctx context.Context) ([]RegionResponse, error)
    CreateRegion(ctx context.Context, name string, boundary string) (RegionResponse, error)
    GetELOHistoryWithOpponents(ctx context.Context, playerID uuid.UUID, cursor *int64, limit int32) (ELOHistoryPage, error)
}
```

### service.go responsibilities

- `GetRanking(ctx, regionID, limit, offset)` — delegates to repo
- `GetPlayerRank(ctx, playerID)` — delegates to repo
- `CreateRegion(ctx, name, boundary)` — delegates to repo
- `GetRegions(ctx)` — delegates to repo
- `ProjectELO(ctx, callerID, opponentID, result string)` — queries both player ELOs, applies CalcExpected + CalcNewELO with M=1.0
- `GetELOHistory(ctx, playerID, cursor, limit)` — delegates to repo

---

## Migration Plan

### 000007_regions_seed.up.sql
- `INSERT INTO regions` for 4 Mendoza zones with WKT polygon boundaries
- `CREATE INDEX IF NOT EXISTS idx_users_region_elo ON users (region_id, status, elo DESC)`

### 000007_regions_seed.down.sql
- `DELETE FROM regions WHERE name IN (...)`
- `DROP INDEX IF EXISTS idx_users_region_elo`

---

## sqlc Queries

### queries/rankings.sql
- `GetRankingByRegion` — RANK() OVER, status filter, LIMIT/OFFSET
- `GetPlayerRank` — subquery returning player's rank within their region
- `GetAllRegions` — simple SELECT
- `CreateRegion` — INSERT with PostGIS geometry

### queries/elo_history_extended.sql
- `GetELOHistoryWithOpponents` — cursor paginated, JOIN for opponent names

---

## HTTP Contract

### GET /rankings
Query params: `region_id` (optional, defaults to caller's region), `limit` (default 50, max 100), `offset` (default 0)

Response: `{ "region_id": "...", "region_name": "...", "entries": [...], "total": 42 }`

### POST /admin/regions
Body: `{ "name": "string", "boundary_wkt": "POLYGON((...))"}` (boundary_wkt optional for MVP — can be null)

### GET /regions
Response: `{ "regions": [{ "id": "...", "name": "..." }] }`

### GET /matches/projection
Query params: `opponent_id` (UUID), `result` (win|lose|draw)

### GET /players/me/elo-history
Query params: `cursor` (int, optional), `limit` (default 20, max 50)
