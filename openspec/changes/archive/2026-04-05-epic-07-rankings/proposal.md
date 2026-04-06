# EPIC 07 — Rankings (Tab 3): Proposal

## Intent

Rankings are the ego arena. The competitive hook that keeps players coming back every day isn't the next match — it's the number next to their name, the gap to the player above them, and the projection of what beating a higher-ranked opponent would do to their ELO.

Tab 3 is purely read-heavy and reputation-driven. Players need to see themselves in a hyper-local context (their region of Mendoza, not a national ranking no one cares about), understand the delta they'd gain from a pending match, and trace their ELO trajectory over time. This tab has no write operations except the admin seeding of regions.

## Problem

Without rankings:
- Players have ELO and trust scores stored in the database with no way to surface them meaningfully
- The regions table is empty — there's no geographic segmentation yet
- Players can't project the outcome of a match before accepting it
- ELO history exists in `elo_history` but is not queryable with opponent context

## Solution

Five endpoints that together compose the full Rankings tab experience:

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/rankings` | JWT (any) | Ranked player list filtered by caller's region |
| POST | `/admin/regions` | JWT + superadmin | Create a new region |
| GET | `/regions` | JWT (any) | List all regions |
| GET | `/matches/projection` | JWT (any) | Project ELO gain/loss for a hypothetical match result |
| GET | `/players/me/elo-history` | JWT (any) | Paginated ELO history with opponent names |

### Region Seeding

Four Mendoza zones seeded in migration `000007_regions_seed`:
- **Gran Mendoza** — city center and surrounding departments (Godoy Cruz, Las Heras, Guaymallén, Maipú)
- **Zona Este** — San Martín, Rivadavia, Junín, Santa Rosa
- **Valle de Uco** — Tunuyán, Tupungato, San Carlos
- **Sur** — San Rafael, Malargüe, General Alvear

Each region has an approximate PostGIS polygon boundary expressed in WGS84.

### ELO Projection

The projection endpoint reuses the existing pure functions in the `ranking` package:
- `CalcExpected(playerELO, opponentELO) float64` — expected score
- `CalcNewELO(currentELO, kFactor, actualScore, expectedScore) float64` — new ELO

Projection uses `M=1.0` (margin multiplier neutral) since the match hasn't been played yet. No database writes, no state changes — pure computation.

## Scope

### In scope
- Rankings list with RANK() window function, filtered by region, status='active' only
- Personal rank lookup
- Region CRUD (list public, create superadmin-only)
- ELO projection (read-only, pure function)
- ELO history with opponent names (cursor pagination)
- New `internal/leaderboard/` domain package
- Migration 000007 for region seed data only (no schema changes needed)

### Out of scope
- Materialized views or caching (deferred to post-MVP)
- Cross-region rankings or national leaderboard
- Match-level ELO history breakdown (partial score, margin)
- Push notifications for rank changes

## Technical Approach

Rankings computed on-the-fly using `RANK() OVER (PARTITION BY region_id ORDER BY elo DESC)`. No materialized view for MVP — the player base per region will be small enough that a sequential scan with an index on `(region_id, elo DESC)` is sufficient.

ELO history uses cursor pagination (last seen `id`) instead of OFFSET to avoid pagination drift as new records are inserted.

## Dependencies

- EPICs 00-04 complete (regions table, users.elo, elo_history table, ranking package, auth middleware)
- `ranking` package with `CalcExpected`, `CalcNewELO` already tested
- PostGIS extension available (used in EPIC 00)

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| RANK() query slow at scale | Low (MVP) | Add composite index `(region_id, status, elo DESC)` |
| Polygon boundaries imprecise | Low | Approximate boundaries sufficient for MVP; exact shapes can be updated later |
| Projection endpoint misused as game-theory optimizer | Medium | Stateless by design — no harm in abuse |

## Stories

- **US-036**: As a player, I want to see the ranking of my region so I know where I stand
- **US-037**: As a player, I want to project my ELO gain/loss before playing a match
- **US-038**: As a player, I want to see my ELO history over time with opponent names
- **US-039**: As a superadmin, I want to create and manage regions
