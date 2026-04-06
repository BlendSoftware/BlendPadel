## Why

Players currently have no way to cancel a scheduled match. If plans change, the match stays in `pending_result` forever — polluting match history and confusing other participants. Cancellation with a penalty window disincentivizes last-minute dropouts while allowing reasonable schedule changes.

## What Changes

- Add `POST /matches/{id}/cancel` endpoint for captains to cancel a match
- Matches cancelled < 3 hours before scheduled time trigger a Trust Score penalty (-15) for the cancelling captain
- Matches cancelled >= 3 hours before scheduled time incur no penalty
- Cancelled matches transition to `status = 'cancelled'` (preserved for audit trail, never deleted)
- Other match participants are notified via the existing FCM notification hook

## Capabilities

### New Capabilities
- `match-cancellation`: Cancel a match with time-based Trust Score penalty and participant notification

### Modified Capabilities

## Impact

- **Backend domains affected**: `match` (new endpoint, new status constant, cancel logic), `trust` (already has `PenalizeLateCancellation` — reused)
- **Database**: No migration needed — `matches.status` is `VARCHAR(30)` without CHECK constraint, "cancelled" fits
- **API changes**: New endpoint `POST /matches/{id}/cancel` (auth required, captain only)
- **Notifications**: Uses existing `NotificationHookFn` with new event `"match_cancelled"`
- **Breaking changes**: None
