# Tasks: Epic 10 — Notificaciones Push

## Status: implemented

---

## Task 1: Migration 000010_notifications
- [x] Create `migrations/000010_notifications.up.sql` with `device_tokens` and `notification_log` tables
- [x] Create `migrations/000010_notifications.down.sql`
- [x] Apply migration to Docker postgres (localhost:5432, blendpadel/password/blendpadel)

## Task 2: sqlc Queries
- [x] Create `queries/device_tokens.sql` with: UpsertDeviceToken, DeleteDeviceToken, GetDeviceTokensByPlayer
- [x] Create `queries/notification_log.sql` with: InsertNotificationLog, CheckNotificationSent
- [x] Run `sqlc generate` to produce `internal/db/device_tokens.sql.go` and `internal/db/notification_log.sql.go`

## Task 3: Notification Domain — model.go
- [x] Create `internal/notification/model.go`
  - `NotificationType` string type + constants: ResultValidation, Reminder4h, ELOChange, TrustWarning, UrgentMatchNearby
  - `Notification` struct: Type, Title, Body, Data map[string]string

## Task 4: Notification Domain — notifier.go
- [x] Create `internal/notification/notifier.go`
  - `Notifier` interface: `Send(ctx, playerID, Notification) error`, `SendMulticast(ctx, []playerID, Notification) error`

## Task 5: Notification Domain — mock.go
- [x] Create `internal/notification/mock.go`
  - `MockNotifier` struct
  - `Send`: log with zerolog Info, fields: player_id, type, title, body
  - `SendMulticast`: iterate and call Send for each player

## Task 6: Notification Domain — fcm.go
- [x] Create `internal/notification/fcm.go`
  - `FCMNotifier` struct with placeholder `credentials string` field
  - `NewFCMNotifier(credentials string) *FCMNotifier`
  - `Send`: return nil (stub)
  - `SendMulticast`: return nil (stub)

## Task 7: Notification Domain — repository.go
- [x] Create `internal/notification/repository.go`
  - `Repository` interface:
    - `UpsertDeviceToken(ctx, playerID, token, platform) error`
    - `DeleteDeviceToken(ctx, playerID, token) error`
    - `GetDeviceTokensByPlayer(ctx, playerID) ([]string, error)`
    - `InsertNotificationLog(ctx, playerID, notifType, referenceID) error`
    - `CheckNotificationSent(ctx, playerID, notifType, referenceID) (bool, error)`

## Task 8: Notification Domain — postgres.go
- [x] Create `internal/notification/postgres.go`
  - `postgresRepo` implementing `Repository` using `*db.Queries`
  - `NewPostgresRepo(q *db.Queries) Repository`

## Task 9: Notification Domain — service.go
- [x] Create `internal/notification/service.go`
  - `Service` struct: holds `Repository` + `Notifier`
  - `NewService(repo Repository, notifier Notifier) *Service`
  - `SendResultValidation(ctx, captainBID, matchID) error`
  - `SendReminder(ctx, captainBID, matchID) error`
  - `SendELOChange(ctx, playerID, delta int, matchID) error`
  - `SendTrustWarning(ctx, playerID uuid, newScore int) error`
  - `SendUrgentMatch(ctx, playerIDs []uuid, matchID) error`
  - Each method: dedup check → notifier.Send → log entry

## Task 10: Notification Domain — reminder.go
- [x] Create `internal/notification/reminder.go`
  - `ReminderJob` struct: holds match repo query func + notif service
  - `NewReminderJob(pool *pgxpool.Pool, notifSvc *Service, interval time.Duration) *ReminderJob`
  - `Start(ctx context.Context)`: ticker loop, query matches at 4h mark, send reminders

## Task 11: Device Token Handler — handler.go
- [x] Create `internal/notification/handler.go`
  - `Handler` struct holding `*Service`
  - `RegisterDeviceToken(w, r)`: POST /players/me/device-token
    - Decode `{token, platform}` body
    - Call `service.UpsertDeviceToken`
    - Return 200 OK
  - `DeleteDeviceToken(w, r)`: DELETE /players/me/device-token
    - Decode `{token}` body
    - Call `service.DeleteDeviceToken`
    - Return 204 No Content

## Task 12: Device Token Routes — routes.go
- [x] Create `internal/notification/routes.go`
  - `RegisterRoutes(r chi.Router, h *Handler, authMw func(http.Handler) http.Handler)`
  - Mount under authenticated group:
    - `POST /players/me/device-token`
    - `DELETE /players/me/device-token`

## Task 13: Integration Hooks — match service
- [x] Add `notifyHook NotificationHookFn` field to `match.Service`
- [x] Add `SetNotificationHook(hook NotificationHookFn)` method
- [x] Call hook (non-fatal) after `SubmitResult` transitions to `awaiting_confirmation`
- [x] Call hook (non-fatal) after `sealMatch` completes ELO application (with ELO deltas)

## Task 14: Integration Hooks — trust service
- [x] Add `notifyHook TrustNotificationHookFn` field to `trust.Service`
- [x] Add `SetNotificationHook(hook TrustNotificationHookFn)` method
- [x] Call hook (non-fatal) in `applyDelta` when new score < ThresholdVisible (70)

## Task 15: Wire in main.go
- [x] Create `notification.NewPostgresRepo(queries)`
- [x] Create `notification.NewMockNotifier()`
- [x] Create `notification.NewService(notifRepo, mockNotifier)`
- [x] Wire match service hook: `matchSvc.SetNotificationHook(...)`
- [x] Wire trust service hook: `trustSvc.SetNotificationHook(...)`
- [x] Start reminder job goroutine
- [x] Register notification routes

## Task 16: Integration Tests
- [x] Create `internal/notification/integration_test.go`
  - Test UpsertDeviceToken + GetDeviceTokensByPlayer
  - Test dedup: CheckNotificationSent returns false first, true after InsertNotificationLog
  - Test SendResultValidation logs and inserts log entry
  - Test SendReminder dedup (second call skipped)

## Task 17: Build + Test Verification
- [x] `go build ./...` — zero errors
- [x] `go test ./...` — all existing tests pass
