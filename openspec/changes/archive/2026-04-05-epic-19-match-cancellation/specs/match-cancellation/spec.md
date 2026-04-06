## ADDED Requirements

### Requirement: Captain can cancel a pending match
The system SHALL allow either captain (captain_a or captain_b) to cancel a match that is in `pending_result` status via `POST /matches/{id}/cancel`.

#### Scenario: Captain A cancels match successfully
- **WHEN** captain_a sends POST /matches/{id}/cancel for a match in `pending_result` status
- **THEN** the match status changes to `cancelled`
- **THEN** the system returns HTTP 200

#### Scenario: Captain B cancels match successfully
- **WHEN** captain_b sends POST /matches/{id}/cancel for a match in `pending_result` status
- **THEN** the match status changes to `cancelled`
- **THEN** the system returns HTTP 200

#### Scenario: Non-captain player cannot cancel
- **WHEN** a player who is not captain_a or captain_b sends POST /matches/{id}/cancel
- **THEN** the system returns HTTP 403 with detail "only a captain can cancel this match"

#### Scenario: Cannot cancel non-pending match
- **WHEN** a captain sends POST /matches/{id}/cancel for a match in `awaiting_confirmation` status
- **THEN** the system returns HTTP 409 with detail "match cannot be cancelled in its current status"

#### Scenario: Match not found
- **WHEN** a player sends POST /matches/{id}/cancel for a non-existent match ID
- **THEN** the system returns HTTP 404

### Requirement: Late cancellation penalizes Trust Score
The system SHALL penalize the cancelling captain's Trust Score by -15 when cancelling less than 3 hours before the match's `scheduled_at` time.

#### Scenario: Late cancellation (< 3 hours)
- **WHEN** captain cancels a match and `scheduled_at - now < 3 hours`
- **THEN** the captain's Trust Score decreases by 15
- **THEN** a trust event of type `late_cancellation` is recorded

#### Scenario: Early cancellation (>= 3 hours)
- **WHEN** captain cancels a match and `scheduled_at - now >= 3 hours`
- **THEN** no Trust Score penalty is applied
- **THEN** no trust event is recorded

#### Scenario: Cancellation after scheduled time
- **WHEN** captain cancels a match and `scheduled_at` has already passed (now > scheduled_at)
- **THEN** the cancellation is treated as late (Trust Score -15)

### Requirement: Cancelled match preserved for audit
The system SHALL keep cancelled matches in the database with `status = 'cancelled'`. Cancelled matches SHALL NOT be deleted.

#### Scenario: Cancelled match visible in history
- **WHEN** a player requests their match history
- **THEN** cancelled matches appear with `status: "cancelled"`

### Requirement: Participants notified on cancellation
The system SHALL notify all other match participants when a match is cancelled via the existing notification hook.

#### Scenario: Other players notified
- **WHEN** captain_a cancels a match with 4 players
- **THEN** the notification hook is called with event `"match_cancelled"` and the IDs of the other 3 players
