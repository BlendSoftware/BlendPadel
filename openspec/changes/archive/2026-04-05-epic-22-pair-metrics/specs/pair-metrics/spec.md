## ADDED Requirements

### Requirement: Partnership stats endpoint
The system SHALL return pair statistics for a partnership via `GET /partnerships/{id}/stats`.

#### Scenario: Pair with match history
- **WHEN** a player requests stats for a partnership where both players have 10 sealed matches together, 7 wins
- **THEN** the response includes total_matches=10, wins=7, win_rate=0.7

#### Scenario: Pair with no matches together
- **WHEN** a player requests stats for a partnership where the pair has 0 sealed matches together
- **THEN** the response includes total_matches=0, wins=0, win_rate=0.0

#### Scenario: Partnership not found
- **WHEN** a player requests stats for a non-existent partnership ID
- **THEN** the system returns HTTP 404

### Requirement: Best partner endpoint
The system SHALL return the player's best partner via `GET /players/me/best-partner`. Best partner is the partner with the highest win rate among those with at least 3 sealed matches together.

#### Scenario: Player has qualifying partners
- **WHEN** a player has partner A (5 matches, 80% win rate) and partner B (10 matches, 60% win rate)
- **THEN** the response returns partner A as best partner with win_rate=0.8

#### Scenario: No qualifying partners
- **WHEN** a player has no partner with >= 3 matches together
- **THEN** the system returns HTTP 200 with null/empty result

### Requirement: Stats include win streak
The system SHALL include the current consecutive win streak for the pair in partnership stats.

#### Scenario: Pair on a 3-match win streak
- **WHEN** the pair's last 3 matches together were all wins
- **THEN** the response includes current_streak=3
