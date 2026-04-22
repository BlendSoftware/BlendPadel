## ADDED Requirements

### Requirement: GET /matches/{id} returns full match detail
The system SHALL provide a GET /matches/{id} endpoint that returns complete match information including teams, result data, venue, and status.

#### Scenario: Fetch sealed match with result
- **WHEN** an authenticated user requests GET /matches/{matchID} for a sealed match
- **THEN** the response includes match status, teams, avg_elo, match_type, venue_id, winner_team, total_games_a, total_games_b, game_diff, and sets

#### Scenario: Fetch pending match without result
- **WHEN** an authenticated user requests GET /matches/{matchID} for a pending_result match
- **THEN** the response includes match status, teams, avg_elo, match_type, venue_id, and result fields are omitted

#### Scenario: Match not found
- **WHEN** an authenticated user requests GET /matches/{invalidID}
- **THEN** the system returns HTTP 404 with RFC 7807 problem detail

#### Scenario: Unauthenticated request
- **WHEN** an unauthenticated user requests GET /matches/{id}
- **THEN** the system returns HTTP 401
