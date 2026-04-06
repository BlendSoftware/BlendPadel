## 1. Database Migration

- [x] 1.1 Create migration `000012_venues.up.sql`: CREATE TABLE venues with PostGIS location, GIST index, all columns per design
- [x] 1.2 Same migration: ALTER TABLE matches ADD COLUMN venue_id UUID REFERENCES venues(id)
- [x] 1.3 Same migration: ALTER TABLE matchmaking_flares ADD COLUMN venue_id UUID REFERENCES venues(id)
- [x] 1.4 Create migration `000012_venues.down.sql`

## 2. sqlc Queries

- [x] 2.1 Create `queries/venues.sql` with: CreateVenue, GetVenueByID, GetVenuesNearby (spatial), UpdateVenue, list all fields explicitly
- [x] 2.2 Update `queries/matches.sql`: Add `venue_id` to CreateMatch INSERT and all SELECT queries
- [x] 2.3 Update `queries/flares.sql`: Add `venue_id` to CreateFlare INSERT and GetActiveFlares/GetActiveFlaresByMatchType SELECTs
- [x] 2.4 Run `sqlc generate` and verify compilation

## 3. Venue Domain (New)

- [x] 3.1 Create `venue/model.go`: CreateVenueRequest, UpdateVenueRequest, VenueResponse DTOs
- [x] 3.2 Create `venue/repository.go`: Repository interface (Create, GetByID, GetNearby, Update)
- [x] 3.3 Create `venue/postgres.go`: PostgreSQL implementation using sqlc queries
- [x] 3.4 Create `venue/service.go`: Business logic (validation, authorization — creator or admin can edit, only admin can verify)
- [x] 3.5 Create `venue/handler.go`: HTTP handlers for GET /venues, GET /venues/{id}, POST /venues, PUT /venues/{id}
- [x] 3.6 Create `venue/routes.go`: Route registration with auth middleware

## 4. Match/Flare Domain Updates

- [x] 4.1 Update `match/model.go`: Add `VenueID *uuid.UUID` to CreateMatchRequest, MatchResponse, MatchFull, MatchHistoryItem
- [x] 4.2 Update `match/repository.go`: Add VenueID to CreateMatchInput
- [x] 4.3 Update `match/postgres.go`: Pass venue_id through all match mappings
- [x] 4.4 Update `match/service.go`: Validate venue_id exists if provided (call venue repo or use FK constraint)
- [x] 4.5 Update `matchmaking/model.go`: Add VenueID to CreateFlareRequest, FlareResponse, FlareRow
- [x] 4.6 Update `matchmaking/postgres.go`: Pass venue_id through flare creation and listing mappings

## 5. Wire Up

- [x] 5.1 Register venue routes in `cmd/server/main.go` (or wherever routes are wired)
- [x] 5.2 Verify full compilation with `go build ./...`
