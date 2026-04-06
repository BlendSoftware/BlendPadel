# Proposal: EPIC 06 — Matchmaking (Tab 2)

## Status
proposed

## Why

Radar (EPIC 05) shows existing supply. Matchmaking is where supply gets created. A player who wants to play but can't find a match in Radar needs a way to broadcast their intent — a "flare" that says "I'm available, Sunday 18:00, within 3 km, ELO ~1400, need 3 more players."

Matchmaking is the supply/demand hub of BlendPadel. Without it, supply only comes from players who proactively create full matches. Flares lower the friction: post intent, wait for others to respond, match gets created automatically when enough players join. This drives the network effects that make the platform valuable.

It also creates a two-sided hook: players with supply (courts, time, friends) create matches; players with demand (available time, no court) post flares. Both flows converge into a created match.

## What

Four HTTP endpoints under the `/matchmaking` namespace:

### POST /matchmaking/flares

Create a new flare. A flare expresses intent: "I want to play at this time, near this location, at ~this ELO." Only one active flare per player at a time (enforced in service). Flare includes: location (lat/lng), scheduled_at, desired ELO range (optional), min/max players, expiration (default 24h).

### GET /matchmaking/flares

List active flares filtered by:
- **Proximity**: PostGIS `ST_DWithin`, caller provides `lat`, `lng`, `radius_km`
- **ELO compatibility**: defaults to ±200 from caller's ELO
- **Trust visibility**: same `trust.ThresholdVisible` predicate as Radar
- **Status**: only `active` flares

Cursor-paginated on `created_at` + `id`.

### POST /matchmaking/flares/{id}/respond

Respond to a flare. If the flare now has enough confirmed respondents (≥ min_players), a match is created automatically by calling `match.Service.CreateMatch` inside the same transaction. The flare transitions to `matched` status. If not yet enough players, the respondent is queued.

### DELETE /matchmaking/flares/{id}

Cancel own flare. Only the flare's creator can cancel. Sets status to `cancelled`.

## Scope

- New domain: `internal/matchmaking/`
- New table: `matchmaking_flares` with PostGIS `GEOGRAPHY` column + GIST index
- New migration: `000006_matchmaking`
- New sqlc query file: `queries/flares.sql`
- Auto-expirer goroutine that expires flares older than 24h
- Integration with existing `match.Service.CreateMatch`
- Routes mounted at `/matchmaking` with `AuthMiddleware`

## Out of Scope

- Real-time notifications when flare gets a response (future EPIC — WebSocket)
- Flare search history or analytics
- Multi-sport support (padel only for now)

## Stories Covered

| Story | Description |
|-------|-------------|
| US-033 | Player posts a matchmaking flare |
| US-034 | Player browses and responds to nearby flares |
| US-035 | System auto-creates match when flare reaches min players |

## Risks

| Risk | Mitigation |
|------|------------|
| Race condition: two respondents trigger CreateMatch simultaneously | Respond logic runs inside DB transaction with SELECT FOR UPDATE on flare row |
| Player spams flares | Service enforces 1 active flare per player via GetActiveFlareByPlayer check |
| Expired flares pollute the feed | Expirer goroutine runs every 5 minutes; also filtered by status in queries |
| CreateMatch fails mid-transaction | Transaction rollback leaves flare in `active` state; respondent sees error and can retry |
