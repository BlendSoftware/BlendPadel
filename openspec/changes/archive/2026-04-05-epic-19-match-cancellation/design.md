## Context

BlendPadel matches currently support 4 statuses: `pending_result`, `awaiting_confirmation`, `sealed`, `disputed`. There's no way for a captain to cancel a match before it's played. The trust domain already has `PenalizeLateCancellation(ctx, playerID, matchID)` which creates a `late_cancellation` event with delta -15.

## Goals / Non-Goals

**Goals:**
- Allow either captain to cancel a match before results are submitted
- Penalize late cancellations (< 3 hours before scheduled time)
- Notify all other match participants
- Preserve cancelled matches for audit trail

**Non-Goals:**
- Allowing non-captain players to cancel
- Cancelling matches after results are submitted (awaiting_confirmation, sealed, disputed)
- Partial cancellation (removing one player and finding a replacement)
- Refund/undo of penalties

## Decisions

### 1. Only `pending_result` matches can be cancelled

Matches in `awaiting_confirmation`, `sealed`, or `disputed` have results submitted — cancellation makes no sense. Only `pending_result` (scheduled but not yet played) matches are eligible.

### 2. Penalty threshold: 3 hours before `scheduled_at`

```
now ────────────────── scheduled_at
│                           │
└── time_until_match ───────┘

time_until_match < 3h → Trust -15 (late_cancellation)
time_until_match >= 3h → no penalty
```

The trust service's `PenalizeLateCancellation` method already applies delta -15 and creates the event. No new trust logic needed.

### 3. Only the cancelling captain is penalized

Not all 4 players — only the captain who initiates the cancel. This is fair because the canceller is the one breaking the commitment.

### 4. Notification via existing hook

The match service already has `NotificationHookFn`. We fire a `"match_cancelled"` event with the match ID and the list of other players to notify. The notification domain handles FCM delivery.

### 5. No migration needed

`matches.status` is `VARCHAR(30)` with no CHECK constraint. The value `"cancelled"` (9 chars) fits within the column. We add it as a Go constant alongside the existing status constants.

## Risks / Trade-offs

- **[Risk] Captain cancels right before match** → Mitigated by Trust Score penalty. Repeat offenders will have low Trust Scores, affecting their matchmaking visibility.
- **[Trade-off] Only captain can cancel** → Other players can't cancel directly. If they need to, they must ask the captain. This keeps the authority model simple (captains own the match).
