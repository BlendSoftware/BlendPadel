## ADDED Requirements

### Requirement: MatchResponse includes result data for sealed matches
The MatchResponse DTO SHALL include result fields (winner_team, total_games_a, total_games_b, game_diff, sets) when the match has a result. These fields MUST be omitted (omitempty) for matches without results.

#### Scenario: Sealed match response includes result
- **WHEN** a match in "sealed" status is returned via any endpoint
- **THEN** the JSON response includes winner_team, total_games_a, total_games_b, game_diff, and sets fields

#### Scenario: Pending match response omits result
- **WHEN** a match in "pending_result" status is returned via any endpoint
- **THEN** the JSON response does not include winner_team, total_games_a, total_games_b, game_diff, or sets fields
