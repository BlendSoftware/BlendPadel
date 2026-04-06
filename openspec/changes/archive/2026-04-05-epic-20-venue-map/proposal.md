## Why

BlendPadel matches currently use free-form lat/lng coordinates for location. Players see "a point on the map" but have no context about where they're actually playing. Real padel venues (clubs, canchas) are the natural anchor for matches — adding them gives context ("Jugamos en Club Aconcagua") and enables venue-centric features like court availability and venue reputation.

## What Changes

- New `venues` entity: name, address, coordinates (PostGIS), court count, phone, hours, verified status
- CRUD endpoints for venues: list by proximity, detail, create (suggest), edit
- Optional `venue_id` on matches and flares (backward compatible — existing matches keep NULL)
- Mixed data sourcing: admin seed + user suggestions (unverified) + admin verification
- Spatial query to find venues near a given location

## Capabilities

### New Capabilities
- `venue-management`: CRUD for padel venues with spatial queries, user suggestions, and admin verification
- `venue-match-association`: Optional venue_id on matches and flares linking them to a real venue

### Modified Capabilities

## Impact

- **Database**: New `venues` table with PostGIS index + `venue_id` FK on `matches` and `matchmaking_flares` (migration 000012)
- **New backend domain**: `internal/venue/` (model, handler, service, repository, postgres, routes)
- **New sqlc queries**: `queries/venues.sql`
- **Modified domains**: `match` (accept venue_id on creation), `matchmaking` (accept venue_id on flare creation)
- **API changes**: 4 new endpoints under `/venues`, match/flare creation requests gain optional `venue_id`
- **Breaking changes**: None (venue_id is optional, existing data unaffected)
