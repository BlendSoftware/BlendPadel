## 1. Database Migration

- [x] 1.1 Create migration `000014_activity_feed.up.sql`: CREATE TABLE activity_feed
- [x] 1.2 Create migration `000014_activity_feed.down.sql`

## 2. sqlc Queries

- [x] 2.1 Create `queries/activity_feed.sql`: CreateFeedEvent, GetFeedByRegion (with player name join), GetRecentWinStreak (for dedup check)
- [x] 2.2 Run `sqlc generate` and verify compilation

## 3. Feed Domain

- [x] 3.1 Create `feed/model.go`: FeedEventResponse DTO
- [x] 3.2 Create `feed/repository.go`: Repository interface
- [x] 3.3 Create `feed/postgres.go`: PostgreSQL implementation
- [x] 3.4 Create `feed/service.go`: Feed reading + event generation logic (CheckAndGenerateEvents called after match seal)
- [x] 3.5 Create `feed/handler.go`: GET /feed handler
- [x] 3.6 Create `feed/routes.go`: Route registration

## 4. Wire Up

- [x] 4.1 Register feed routes in `cmd/server/main.go`
- [x] 4.2 Wire feed event generation into match seal flow (via notification hook or direct call)
- [x] 4.3 Verify full compilation
