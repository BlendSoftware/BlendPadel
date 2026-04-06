## 1. Match Domain — Model & Constants

- [x] 1.1 Add `StatusCancelled = "cancelled"` constant to `match/model.go`
- [x] 1.2 Add `ErrMatchNotCancellable` sentinel error to `match/model.go`

## 2. Match Domain — Cancel Logic

- [x] 2.1 Add `CancelMatch(ctx, matchID, callerID)` method to `match/service.go` with status check, captain check, penalty logic, status update, and notification hook
- [x] 2.2 Add `POST /matches/{id}/cancel` handler in `match/handler.go`
- [x] 2.3 Register the new route in `match/routes.go`

## 3. Tests

- [x] 3.1 Write unit tests for CancelMatch: successful cancel by captain_a, successful cancel by captain_b, non-captain rejected (403), non-pending rejected (409), late cancel triggers penalty, early cancel no penalty, cancel after scheduled_at triggers penalty
