## Why

BlendPadel needs to feel like a social platform, not just a match tracker. An automatic activity feed of player achievements ("Franco subió a 5ta", "Rami ganó 3 partidos seguidos") creates engagement without requiring user-generated content. This is the MVP social layer — no follows, likes, or comments yet.

## What Changes

- New `activity_feed` table for storing achievement events
- New endpoint to read the feed filtered by region
- Achievement events generated automatically when matches are sealed (win streaks, rank changes, milestones)
- Feed is read-only — no user input required

## Capabilities

### New Capabilities
- `activity-feed`: Automatic read-only feed of player achievements, filterable by region

### Modified Capabilities

## Impact

- **Database**: New `activity_feed` table (migration 000014)
- **New backend domain**: `internal/feed/` (model, handler, service, repository, postgres, routes)
- **Modified domain**: `match/service.go` — generate feed events after match sealing
- **API changes**: `GET /feed` endpoint
- **Breaking changes**: None
