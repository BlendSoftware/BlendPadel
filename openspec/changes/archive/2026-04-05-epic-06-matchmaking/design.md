# Design: EPIC 06 — Matchmaking

## Architecture Overview

Matchmaking is a write domain that coordinates flare lifecycle and triggers match creation. It integrates with the existing `match` domain as a consumer.

```
Handler (Chi route)
  └── MatchmakingService
        ├── FlareRepository (interface)
        │     └── PostgresFlareRepo (sqlc-generated queries)
        │           └── matchmaking_flares table (PostGIS)
        └── match.Service (dependency — CreateMatch)

FlareExpirer (goroutine)
  └── MatchmakingService.ExpireFlares (ticker every 5 min)
```

---

## D1 — New Table: matchmaking_flares

The `matchmaking_flares` table captures a player's intent to play. It uses a `GEOGRAPHY(POINT, 4326)` column for PostGIS proximity queries, consistent with the `matches.location` column.

```sql
CREATE TABLE matchmaking_flares (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    location    GEOGRAPHY(POINT, 4326) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    elo_min      INT NOT NULL DEFAULT 0,
    elo_max      INT NOT NULL DEFAULT 3000,
    min_players  INT NOT NULL DEFAULT 2,
    max_players  INT NOT NULL DEFAULT 4,
    status       TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'matched', 'cancelled', 'expired')),
    match_id     UUID REFERENCES matches(id),   -- populated when status = 'matched'
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flares_player_id ON matchmaking_flares(player_id);
CREATE INDEX idx_flares_status_expires ON matchmaking_flares(status, expires_at);
CREATE GIST INDEX idx_flares_location ON matchmaking_flares USING GIST(location);
```

The `match_id` back-reference allows the mobile app to navigate from a matched flare directly to the created match.

---

## D2 — One Active Flare Per Player

Enforced in the service layer with a pre-check before insert:

```go
existing, err := s.repo.GetActiveFlareByPlayer(ctx, playerID)
if err == nil && existing != nil {
    return nil, ErrActiveFlareExists
}
```

`ErrActiveFlareExists` is returned as HTTP 409 Conflict with a `response.Problem` body. The error message includes the existing flare ID so the client can offer to cancel and repost.

A unique partial index provides a database-level safety net:

```sql
CREATE UNIQUE INDEX idx_flares_one_active_per_player
    ON matchmaking_flares(player_id)
    WHERE status = 'active';
```

---

## D3 — Auto-Expiration Goroutine

A `FlareExpirer` runs in a goroutine started from `main.go`. It uses a `time.Ticker` with a 5-minute interval:

```go
type FlareExpirer struct {
    service *MatchmakingService
    ticker  *time.Ticker
    done    chan struct{}
}

func (e *FlareExpirer) Start(ctx context.Context) {
    for {
        select {
        case <-e.ticker.C:
            _ = e.service.ExpireFlares(ctx)
        case <-ctx.Done():
            e.ticker.Stop()
            return
        }
    }
}
```

`ExpireFlares` runs a single UPDATE:

```sql
UPDATE matchmaking_flares
SET status = 'expired', updated_at = NOW()
WHERE status = 'active'
  AND expires_at < NOW();
```

This pattern mirrors the existing auto-sealer used in the matches domain. The goroutine respects context cancellation for clean shutdown.

---

## D4 — RespondToFlare Creates Match via Transaction

The `RespondToFlare` operation is the most critical path. It must be atomic:

1. `SELECT ... FOR UPDATE` on the flare row to prevent concurrent responses
2. Check flare status is still `active`
3. Check caller is not already a respondent
4. Insert respondent into `flare_respondents` join table (or increment counter — TBD by task 2)
5. If `respondent_count >= flare.min_players`:
   a. Call `match.Service.CreateMatch` within the same `pgx` transaction
   b. `UPDATE matchmaking_flares SET status = 'matched', match_id = $created_match_id`
6. Commit

If `CreateMatch` fails, the entire transaction rolls back. The flare stays `active`. The caller receives a 500 with a retryable error.

The `match.Service.CreateMatch` method must accept an existing `pgx.Tx` to participate in the transaction. If it currently does not, the task list includes adding a `CreateMatchTx(ctx, tx, req)` variant.

**Respondents join table (created in same migration):**

```sql
CREATE TABLE flare_respondents (
    flare_id  UUID NOT NULL REFERENCES matchmaking_flares(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (flare_id, player_id)
);
```

---

## D5 — Cursor Pagination for Flare List

`GET /matchmaking/flares` uses cursor pagination on `(created_at DESC, id)`:

```sql
WHERE (created_at, id) < (@cursor_created_at, @cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT @page_size
```

Default page size: 20. Max: 50. Cursor is base64-encoded `created_at||id` — same pattern as Radar.

---

## D6 — Trust and ELO Filtering on Flare List

Same approach as Radar (D3, D4 in epic-05-radar/design.md):
- Trust: JOIN on viewer's trust tier, WHERE flare creator's tier is visible
- ELO: `f.elo_min <= viewer.current_elo AND f.elo_max >= viewer.current_elo` (flare wants players in viewer's ELO range)

---

## New Files

| File | Purpose |
|------|---------|
| `migrations/000006_matchmaking.up.sql` | Create matchmaking_flares + flare_respondents + indexes |
| `migrations/000006_matchmaking.down.sql` | Drop flare_respondents, matchmaking_flares |
| `queries/flares.sql` | sqlc queries for all flare operations |
| `internal/matchmaking/model.go` | CreateFlareRequest, FlareResponse, RespondRequest, pagination cursor |
| `internal/matchmaking/repository.go` | FlareRepository interface |
| `internal/matchmaking/postgres.go` | PostgresFlareRepo |
| `internal/matchmaking/service.go` | MatchmakingService |
| `internal/matchmaking/expirer.go` | FlareExpirer goroutine |
| `internal/matchmaking/handler.go` | HTTP handlers for 4 endpoints |
| `internal/matchmaking/routes.go` | Route registration |

---

## sqlc Query Signatures (sketch)

```sql
-- name: CreateFlare :one
INSERT INTO matchmaking_flares (player_id, location, scheduled_at, elo_min, elo_max, min_players, max_players)
VALUES (@player_id, ST_MakePoint(@lng, @lat)::geography, @scheduled_at, @elo_min, @elo_max, @min_players, @max_players)
RETURNING *;

-- name: GetActiveFlareByPlayer :one
SELECT * FROM matchmaking_flares
WHERE player_id = @player_id AND status = 'active'
LIMIT 1;

-- name: GetActiveFlares :many
-- (PostGIS + ELO + Trust + cursor pagination — see D5/D6)

-- name: GetFlareByID :one
SELECT * FROM matchmaking_flares WHERE id = @id;

-- name: UpdateFlareStatus :one
UPDATE matchmaking_flares
SET status = @status, match_id = @match_id, updated_at = NOW()
WHERE id = @id
RETURNING *;

-- name: ExpireOldFlares :execrows
UPDATE matchmaking_flares
SET status = 'expired', updated_at = NOW()
WHERE status = 'active' AND expires_at < NOW();

-- name: AddFlareRespondent :exec
INSERT INTO flare_respondents (flare_id, player_id) VALUES (@flare_id, @player_id);

-- name: CountFlareRespondents :one
SELECT COUNT(*) FROM flare_respondents WHERE flare_id = @flare_id;

-- name: GetFlareRespondents :many
SELECT player_id FROM flare_respondents WHERE flare_id = @flare_id;
```

---

## Migration

File: `migrations/000006_matchmaking.up.sql`

Creates:
- `matchmaking_flares` table
- `flare_respondents` join table
- GIST index on `matchmaking_flares.location`
- Partial unique index for one-active-flare-per-player
- Status + expiry composite index
