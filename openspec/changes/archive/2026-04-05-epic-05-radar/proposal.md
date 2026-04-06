# Proposal: EPIC 05 — Radar (Tab 1)

## Status
proposed

## Why

Radar is the main screen players open when they launch BlendPadel. Its job is to surface hot matches happening nearby right now, creating the FOMO loop that drives engagement and retention. A player who opens the app and sees 3 matches within 2 km — one starting in 40 minutes with players at their ELO level — will feel compelled to join. Without Radar, the app has no front door.

Radar is also the primary demand signal: it shows players that supply exists, encouraging them to stay active and post their own flares (EPIC 06). Without a compelling Radar feed, the supply/demand flywheel never starts spinning.

## What

Two read-only HTTP endpoints under the `/radar` namespace:

### GET /radar/matches

Returns matches nearby filtered by:
- **Proximity**: PostGIS `ST_DWithin` with a configurable radius (default 10 km, max 50 km). Caller provides `lat`, `lng`, `radius_km` query params.
- **ELO compatibility**: defaults to ±200 from the authenticated player's current ELO. Caller may override with `elo_min` / `elo_max`.
- **Trust visibility**: only returns matches whose captain's trust tier is visible to the requesting player's trust tier, using the existing `trust.ThresholdVisible` constant as a WHERE clause predicate.
- **Status filter**: only `open` matches (not full, not started, not cancelled).
- **Time window**: scheduled within the next 48 hours.

Response includes: match ID, coordinates, distance in meters, avg ELO, scheduled time, players needed (capacity − joined count), captain display name.

Paginated with cursor on `scheduled_at` + `id`.

### GET /radar/alerts

Returns urgent matches that meet ALL of:
- Starting in < 1 hour
- Within < 5 km of the caller
- Trust-visible to the caller
- Status `open`

No ELO filter — urgency overrides ELO matching. This feeds a push-notification-friendly endpoint that will later power background polling or server-sent events.

## Scope

- New domain: `internal/radar/`
- No new database tables — queries run against the existing `matches` table
- New sqlc query file: `queries/radar.sql`
- New routes mounted at `/radar` with `AuthMiddleware`
- No writes, no state mutations

## Out of Scope

- Push notifications (future EPIC)
- Match detail view (EPIC 07)
- Saving/bookmarking matches
- Server-sent events or WebSocket streaming

## Stories Covered

| Story | Description |
|-------|-------------|
| US-030 | Player sees nearby open matches on Radar feed |
| US-031 | Player filters Radar by ELO range |
| US-032 | Player sees urgent alert for matches starting soon |

## Risks

| Risk | Mitigation |
|------|------------|
| PostGIS query slow on large datasets | GIST index already exists on `matches.location`; add composite index on `(status, scheduled_at)` |
| Trust filter leaks player existence | Trust visibility checked in WHERE clause, not in application layer — never returns rows the player can't see |
| Caller supplies malicious radius | Validate max 50 km in handler before query |
