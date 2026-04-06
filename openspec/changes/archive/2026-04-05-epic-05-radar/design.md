# Design: EPIC 05 — Radar

## Architecture Overview

Radar is a pure read domain. It has no writes, no state mutations, no side effects. Its sole responsibility is to project filtered views of the existing `matches` table to authenticated players. This makes it safe to add aggressive caching in a future pass.

```
Handler (Chi route)
  └── RadarService
        └── RadarRepository (interface)
              └── PostgresRadarRepo (sqlc-generated queries)
                    └── matches table (PostGIS)
```

---

## D1 — Radar as Read-Only Domain

`internal/radar/` contains no write operations. The service layer exposes only `GetMatches` and `GetAlerts`. There is no radar-specific state stored in the database.

This means:
- No migrations needed for EPIC 05
- The domain can be deployed independently
- Tests do not need to clean up radar state (only match fixtures)

The handler returns `response.JSON` for success and `response.Problem` (RFC 7807) for errors, consistent with all other domains.

---

## D2 — PostGIS ST_DWithin for Radius Filtering

The `matches` table has a `location GEOGRAPHY(POINT, 4326)` column with an existing GIST index. Radius filtering uses:

```sql
ST_DWithin(m.location, ST_MakePoint($lng, $lat)::geography, $radius_meters)
```

Note: `ST_DWithin` with `GEOGRAPHY` type takes radius in **meters**, not kilometers. The handler converts `radius_km` to meters before passing to the repository.

The GIST index on `location` makes this query O(log n) for typical city-scale datasets. No new indexes are required for the radius filter alone.

A composite index on `(status, scheduled_at)` will improve the status + time window filter. This index should be added as a non-migration advisory in the sqlc query file comments, or as an `idx_matches_status_scheduled_at` index created in the existing schema migration.

---

## D3 — Trust Visibility Filter as WHERE Clause

Trust filtering uses the `trust.ThresholdVisible` constant, which represents the minimum trust tier required for a match to be visible to a given viewer. The filter is applied as a WHERE clause in SQL — not in Go application code — to prevent leaking row existence.

```sql
WHERE m.captain_trust_tier >= $viewer_trust_threshold
```

The exact column name and constant value must be verified against the trust package during implementation. The principle is: if a match is not visible to the viewer's trust tier, the row is never returned from the database — not filtered in Go after the fact.

The viewer's trust tier is loaded from the `players` table using their `user_id` at the start of each request. It is passed as a query parameter to sqlc.

---

## D4 — ELO Filter with ±200 Default

ELO filtering compares the match's `avg_elo` against a range:

```sql
WHERE m.avg_elo BETWEEN $elo_min AND $elo_max
```

Default values when the caller does not supply `elo_min`/`elo_max`:
- `elo_min = player.current_elo - 200`
- `elo_max = player.current_elo + 200`

The player's current ELO is fetched from the `players` table using their `user_id` at the start of the request (same DB call that fetches trust tier, to avoid N+1).

Callers may override with explicit query params but the handler must clamp:
- `elo_min >= 0`
- `elo_max <= 3000` (or system max)
- `elo_max > elo_min`

---

## D5 — Alerts Endpoint: Hard-Coded Thresholds

`GET /radar/alerts` uses hard-coded thresholds that are not configurable by the caller:
- Time window: `scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'`
- Radius: 5000 meters (5 km)
- No ELO filter (urgency overrides matching)

These thresholds live as named constants in `internal/radar/service.go`:

```go
const (
    AlertRadiusMeters = 5000
    AlertTimeWindowMins = 60
)
```

---

## D6 — Pagination

`GET /radar/matches` uses cursor pagination:
- Cursor encodes `(scheduled_at, id)` as a base64 URL-safe string
- Default page size: 20
- Max page size: 50

`GET /radar/alerts` is not paginated — the hard constraints (1h, 5km) naturally bound the result set to a small number.

---

## New Files

| File | Purpose |
|------|---------|
| `queries/radar.sql` | sqlc queries: GetRadarMatches, GetRadarAlerts |
| `internal/radar/model.go` | RadarMatch DTO, AlertMatch DTO, pagination cursor |
| `internal/radar/repository.go` | Repository interface |
| `internal/radar/postgres.go` | PostgresRadarRepo implementing the interface |
| `internal/radar/service.go` | RadarService: GetMatches, GetAlerts |
| `internal/radar/handler.go` | HTTP handlers for both endpoints |
| `internal/radar/routes.go` | Route registration function |

---

## Migration

None. EPIC 05 uses only existing tables.

---

## sqlc Query Signatures (sketch)

```sql
-- name: GetRadarMatches :many
SELECT
    m.id,
    m.captain_id,
    p.display_name AS captain_name,
    ST_Y(m.location::geometry) AS lat,
    ST_X(m.location::geometry) AS lng,
    ST_Distance(m.location, ST_MakePoint(@lng, @lat)::geography) AS distance_meters,
    m.avg_elo,
    m.scheduled_at,
    m.capacity,
    m.joined_count,
    (m.capacity - m.joined_count) AS players_needed
FROM matches m
JOIN players p ON p.id = m.captain_id
JOIN players viewer ON viewer.user_id = @viewer_user_id
WHERE m.status = 'open'
  AND m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
  AND ST_DWithin(m.location, ST_MakePoint(@lng, @lat)::geography, @radius_meters)
  AND m.avg_elo BETWEEN @elo_min AND @elo_max
  AND m.captain_trust_tier >= viewer.trust_tier  -- trust.ThresholdVisible logic
  AND (m.scheduled_at, m.id) > (@cursor_scheduled_at, @cursor_id)
ORDER BY m.scheduled_at ASC, m.id ASC
LIMIT @page_size;

-- name: GetRadarAlerts :many
SELECT ...
FROM matches m
JOIN players p ON p.id = m.captain_id
JOIN players viewer ON viewer.user_id = @viewer_user_id
WHERE m.status = 'open'
  AND m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
  AND ST_DWithin(m.location, ST_MakePoint(@lng, @lat)::geography, 5000)
  AND m.captain_trust_tier >= viewer.trust_tier
ORDER BY m.scheduled_at ASC;
```

Exact column names to be verified against the sqlc schema during implementation.
