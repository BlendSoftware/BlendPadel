## 1. sqlc Queries

- [x] 1.1 Create `queries/pair_stats.sql`: GetPairStats (total matches + wins for a pair), GetBestPartner (highest win rate with min 3 matches), GetPairRecentMatches (for streak calculation)
- [x] 1.2 Run `sqlc generate` and verify compilation

## 2. Partnership Domain Updates

- [x] 2.1 Add PairStatsResponse and BestPartnerResponse DTOs to `partnership/model.go`
- [x] 2.2 Add GetPairStats and GetBestPartner to repository interface and postgres implementation
- [x] 2.3 Add GetPartnershipStats and GetBestPartner service methods (streak calculation in Go from recent matches)
- [x] 2.4 Add `GET /partnerships/{id}/stats` and `GET /players/me/best-partner` handlers
- [x] 2.5 Register new routes in `partnership/routes.go`

## 3. Verification

- [x] 3.1 Verify full compilation with `go build ./...`
