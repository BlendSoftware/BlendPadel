## 1. Critical — Error Handling & Transaction Safety

- [x] 1.1 Fix mapError in match handler to use errors.Is() instead of direct switch comparison (internal/match/handler.go)
- [x] 1.2 Add BeginTx() method to match repository interface and postgres implementation (internal/match/repository.go, internal/match/postgres.go)
- [x] 1.3 Create UpdateStatusTx method in match repository that accepts pgx.Tx (internal/match/postgres.go)
- [x] 1.4 Create ApplyELOTx method in ranking service that accepts pgx.Tx (internal/ranking/service.go, internal/ranking/repository.go, internal/ranking/postgres.go)
- [x] 1.5 Create RecoverFromMatchTx method in trust service that accepts pgx.Tx (internal/trust/service.go, internal/trust/repository.go, internal/trust/postgres.go)
- [x] 1.6 Refactor ConfirmMatch to wrap UpdateStatus + sealMatch in a single transaction using the Tx methods (internal/match/service.go)

## 2. High Priority — ELO & Match Data

- [x] 2.1 Add GetPlayerELOs(ctx, []uuid.UUID) batch method to match repository (internal/match/repository.go, internal/match/postgres.go)
- [x] 2.2 Add sqlc query for batch ELO fetch (queries/matches.sql or queries/players.sql, run sqlc generate)
- [x] 2.3 Update CreateMatch in match service to fetch and compute real avg_elo (internal/match/service.go)
- [x] 2.4 Add result fields (WinnerTeam, Sets, TotalGamesA, TotalGamesB, GameDiff) to MatchResponse with omitempty (internal/match/model.go)
- [x] 2.5 Update matchToResponse() helper to populate result fields from MatchFull (internal/match/service.go or handler.go)

## 3. High Priority — Match Detail Endpoint

- [x] 3.1 Add GetMatchDetail method to match service using existing GetMatchWithPlayers (internal/match/service.go)
- [x] 3.2 Add GetMatchDetail handler (internal/match/handler.go)
- [x] 3.3 Register GET /matches/{id} route (internal/match/routes.go)

## 4. High Priority — Venue Coordinates

- [x] 4.1 Define VenueCoordsFetcher interface in match package (internal/match/service.go)
- [x] 4.2 Inject VenueCoordsFetcher into match Service constructor (internal/match/service.go)
- [x] 4.3 Implement VenueCoordsFetcher in venue package (internal/venue/)
- [x] 4.4 Update CreateMatch to fetch venue coords when venue_id is provided (internal/match/service.go)
- [x] 4.5 Wire VenueCoordsFetcher in server setup (cmd/server/main.go)

## 5. High Priority — Preferences Integration

- [x] 5.1 Define PlayerPreferencesFetcher interface in radar package (internal/radar/service.go)
- [x] 5.2 Inject PlayerPreferencesFetcher into radar Service constructor (internal/radar/service.go)
- [x] 5.3 Implement PlayerPreferencesFetcher adapter in player package (internal/player/)
- [x] 5.4 Update radar handler to detect missing query params and fetch preferences as defaults (internal/radar/handler.go)
- [x] 5.5 Update radar GetAlerts to accept optional radius param with preference fallback (internal/radar/service.go, internal/radar/handler.go)
- [x] 5.6 Inject PlayerPreferencesFetcher into matchmaking Service and apply preference defaults in GetFlares (internal/matchmaking/)
- [x] 5.7 Wire PlayerPreferencesFetcher adapters in server setup (cmd/server/main.go)

## 6. Medium Priority — Validation Guards

- [x] 6.1 Add player status check in CreateMatch after fetching profiles — reject if any player is banned (internal/match/service.go)
- [x] 6.2 Add ErrPlayerBanned sentinel error and map it in mapError (internal/match/model.go, internal/match/handler.go)
- [x] 6.3 Add onboarding validation in CreateFlare — check onboarding_completed before creating flare (internal/matchmaking/service.go)
- [x] 6.4 Add ErrOnboardingRequired sentinel error and map it in matchmaking handler (internal/matchmaking/)

## 7. Medium Priority — Dispute Dismiss

- [x] 7.1 Add Action field to ResolveDisputeRequest with "seal"/"dismiss" values (internal/match/model.go)
- [x] 7.2 Update ResolveDispute service method to branch on action — dismiss path: cancel match + unfreeze ELO without sealing (internal/match/service.go)

## 8. Medium Priority — Search Pagination & Avatar Hardening

- [x] 8.1 Add limit parameter to SearchByName service method (default 20, max 50) (internal/player/service.go)
- [x] 8.2 Update SearchByName handler to parse limit query param (internal/player/handler.go)
- [x] 8.3 Update sqlc search query to accept LIMIT parameter (queries/players.sql, run sqlc generate)
- [x] 8.4 Refactor avatar upload to buffer file with io.ReadAll + bytes.Reader instead of Seek (internal/player/service.go)

## 9. Low Priority — Trust Recovery Safety

- [x] 9.1 Move monthly recovery cap check inside the same transaction as score update in RecoverFromMatch (internal/trust/service.go)
