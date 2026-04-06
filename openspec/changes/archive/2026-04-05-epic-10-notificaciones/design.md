# Design: Epic 10 — Notificaciones Push

## Status: proposed

---

## D1: Notifier Interface

```go
// internal/notification/notifier.go
type Notifier interface {
    Send(ctx context.Context, playerID uuid.UUID, n Notification) error
    SendMulticast(ctx context.Context, playerIDs []uuid.UUID, n Notification) error
}
```

**Rationale**: Single interface for all notification delivery. Allows swapping MockNotifier
(dev/test) for FCMNotifier (prod) at wire time without touching any business logic.

---

## D2: Two Notifier Implementations

### MockNotifier
- Logs each notification with `zerolog` at Info level
- Fields: player_id, type, title, body, data
- For `SendMulticast`: iterates and logs one per player
- Zero external dependencies — safe for all tests and local dev

### FCMNotifier
- Stub implementation that returns nil (no-op)
- Accepts FCM credentials path/string in constructor (unused until wired)
- Struct holds `fcmClient interface{}` placeholder
- When credentials are available: fill in real FCM HTTP v1 API calls

---

## D3: device_tokens Table

```sql
CREATE TABLE device_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL,
    platform    VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (player_id, token)
);
CREATE INDEX idx_device_tokens_player ON device_tokens(player_id);
```

**Rationale**: One player can have multiple devices. Token uniqueness is per (player, token) pair.
`last_used_at` enables future staleness cleanup.

---

## D4: notification_log Table (Deduplication)

```sql
CREATE TABLE notification_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    reference_id      UUID,
    sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notification_log_lookup
    ON notification_log(player_id, notification_type, reference_id);
```

**Dedup logic**: Before sending, query for existing row with same (player_id, notification_type, reference_id).
If found within the dedup window (24h for reminders, session-based for ELO), skip.
No UPDATE — idempotency via INSERT check.

---

## D5: Notification Hooks in Existing Services

Pattern: optional function field, set via setter method.

```go
// In match.Service:
type NotificationHook func(ctx context.Context, event string, data interface{})

func (s *Service) SetNotificationHook(hook NotificationHook) {
    s.notifyHook = hook
}
```

**Why not constructor injection**: Avoids circular dependency issues and keeps existing
`NewService` signatures intact. Tests that don't need notifications pass nothing.

Hook calls are always wrapped in:
```go
if s.notifyHook != nil {
    s.notifyHook(ctx, "result_submitted", matchID)
}
```

Errors from hooks are logged but never propagate to the caller.

---

## D6: Reminder Goroutine

```go
// internal/notification/reminder.go
type ReminderJob struct {
    repo    Repository
    notifSvc *Service
    interval time.Duration
}
```

- Runs every 5 minutes via `time.NewTicker`
- Query: matches in `awaiting_confirmation` where `submitted_at` is between 4h and 5h ago
- For each match: check dedup log for `reminder_4h` + match_id, skip if already sent
- Calls `notifSvc.SendReminder(ctx, captainBID, matchID)`
- Respects context cancellation for clean shutdown

---

## D7: MVP — MockNotifier Only

For the initial release:
- Wire `MockNotifier` in `main.go`
- FCMNotifier is present but not wired
- No FCM credentials required
- All tests use MockNotifier

This allows the full notification flow to be tested end-to-end without external deps.
FCM wiring is a single line change in `main.go` when credentials are ready.

---

## Migration: 000010_notifications

Creates `device_tokens` and `notification_log` tables.
Migration number follows existing sequence (last was 000008_profile).
Note: 000009 may be reserved — using 000010 for this epic.

---

## File Structure

```
internal/notification/
├── model.go           — Notification struct, NotificationType constants
├── notifier.go        — Notifier interface
├── mock.go            — MockNotifier
├── fcm.go             — FCMNotifier (stub)
├── repository.go      — Repository interface (device_tokens + notification_log)
├── postgres.go        — PostgreSQL implementation
├── service.go         — NotificationService (orchestrates send + dedup)
├── reminder.go        — ReminderJob goroutine
├── handler.go         — HTTP handlers for device token endpoints
├── routes.go          — Route registration
└── integration_test.go
```

---

## Data Flow

```
HTTP POST /players/me/device-token
  → handler.go → service.UpsertDeviceToken → postgres.go

match.Service.SubmitResult (existing)
  → [hook] → notification.Service.SendResultValidation
  → dedup check → MockNotifier.Send → zerolog

reminder goroutine (every 5min)
  → query awaiting_confirmation matches at 4h mark
  → dedup check → MockNotifier.Send → zerolog

match.Service.sealMatch → ranking.ApplyELO returns deltas
  → [hook] → notification.Service.SendELOChange (if delta > 50)
  → dedup check → MockNotifier.Send → zerolog

trust.Service.applyDelta (after penalty)
  → [hook] → notification.Service.SendTrustWarning (if score < 70)
  → dedup check → MockNotifier.Send → zerolog
```
