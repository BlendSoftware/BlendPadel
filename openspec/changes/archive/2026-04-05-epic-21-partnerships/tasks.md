## 1. Database Migration

- [x] 1.1 Create migration `000013_partnerships.up.sql`: CREATE TABLE player_partnerships with status CHECK, unique constraint, self-partnership check
- [x] 1.2 Create migration `000013_partnerships.down.sql`

## 2. sqlc Queries

- [x] 2.1 Create `queries/partnerships.sql`: CreatePartnership, GetPartnershipByID, GetActivePartnershipsByPlayer, CountActivePartnershipsByPlayer, UpdatePartnershipStatus, GetExistingPartnership (both directions)
- [x] 2.2 Run `sqlc generate` and verify compilation

## 3. Partnership Domain

- [x] 3.1 Create `partnership/model.go`: DTOs (CreateRequest, PartnershipResponse)
- [x] 3.2 Create `partnership/repository.go`: Repository interface
- [x] 3.3 Create `partnership/postgres.go`: PostgreSQL implementation
- [x] 3.4 Create `partnership/service.go`: Business logic (request, accept, reject, dissolve, list, limit check, duplicate check)
- [x] 3.5 Create `partnership/handler.go`: HTTP handlers for all 5 endpoints
- [x] 3.6 Create `partnership/routes.go`: Route registration

## 4. Wire Up

- [x] 4.1 Register partnership routes in `cmd/server/main.go`
- [x] 4.2 Verify full compilation
