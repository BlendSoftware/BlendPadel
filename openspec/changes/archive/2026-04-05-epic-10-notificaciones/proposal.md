# Proposal: Epic 10 — Notificaciones Push

## Status: proposed
## Stories: US-048, US-049, US-050, US-051, US-052

---

## Problem Statement

BlendPadel players have no way to receive timely push notifications for critical events:
result validation requests, upcoming match reminders, ELO rank changes, trust score warnings,
and urgent nearby match opportunities. Without these, player engagement drops and match
confirmation rates suffer.

---

## Proposed Solution

Build a notification infrastructure behind a `Notifier` interface that:

1. Abstracts push delivery (FCM for production, console logging for dev/test)
2. Stores device tokens per player/platform
3. Deduplicates notifications via a `notification_log` table
4. Integrates as optional hooks into existing match and trust services

---

## Scope

### US-048 — Device Token Registration
- `POST /players/me/device-token` — register an FCM device token (authenticated)
- `DELETE /players/me/device-token` — unregister a device token (authenticated)
- `device_tokens` table: player_id, token, platform (ios/android/web), last_used_at

### US-049 — Result Validation Notification
- When captain_a submits a result, notify captain_b to confirm or dispute
- Trigger: after `SubmitResult` transitions match to `awaiting_confirmation`
- Notification type: `result_validation`

### US-050 — 4-Hour Reminder
- When a match has been in `awaiting_confirmation` for ~4h, remind captain_b
- Background goroutine polling every 5 minutes
- Notification type: `reminder_4h`
- Deduplication: only once per match (reference_id = match_id)

### US-051 — ELO Change Notification
- After match is sealed, if any player's ELO delta exceeds 50 points (gain or loss), notify them
- Trigger: after `sealMatch` completes ELO application
- Notification type: `elo_change`

### US-052 — Trust Warning & Urgent Match
- Trust warning: when a player's trust score drops below 70, notify them
- Trigger: after `applyDelta` in trust service if score crosses threshold downward
- Notification type: `trust_warning`
- Urgent match nearby: when a flare match fills up within 10km of opted-in players
- Notification type: `urgent_match_nearby`

---

## Infrastructure

### Notifier Interface
```go
type Notifier interface {
    Send(ctx context.Context, playerID uuid.UUID, n Notification) error
    SendMulticast(ctx context.Context, playerIDs []uuid.UUID, n Notification) error
}
```

### Implementations
- **MockNotifier**: logs notification content with zerolog at Info level. Used for MVP and tests.
- **FCMNotifier**: stub that returns nil (ready for FCM credentials when available).

### Deduplication
Before sending, `NotificationService` checks `notification_log` for (player_id, notification_type, reference_id).
If found and sent within the dedup window, skip sending.

### Integration Pattern
Existing services (match, trust) accept an optional `NotificationHook` function.
When set, they call it after the primary operation completes.
This avoids modifying service signatures and keeps notification as a side-effect.

---

## Non-Goals (MVP)

- FCM credentials and real push delivery (stub only)
- Rich notification payloads / localization
- Notification preferences / opt-out per type
- Notification inbox / read tracking

---

## Risks

- Notification hook panics could affect match/trust flows — must catch errors non-fatally
- 4h reminder goroutine needs careful dedup to avoid spamming on restart
- Device token staleness — FCM will eventually require token refresh logic
