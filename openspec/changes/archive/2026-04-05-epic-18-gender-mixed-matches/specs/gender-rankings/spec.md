## ADDED Requirements

### Requirement: Rankings filtered by gender
The system SHALL support an optional `gender` query parameter on the rankings endpoint. When provided, only players of that gender are included in the leaderboard and rank calculation.

#### Scenario: Male-only ranking
- **WHEN** a player requests `GET /rankings?region_id=X&gender=male`
- **THEN** the response contains only players with `gender = 'male'`, ranked by ELO descending

#### Scenario: Female-only ranking
- **WHEN** a player requests `GET /rankings?region_id=X&gender=female`
- **THEN** the response contains only players with `gender = 'female'`, ranked by ELO descending

#### Scenario: Unfiltered ranking (default)
- **WHEN** a player requests `GET /rankings?region_id=X` without a `gender` parameter
- **THEN** the response contains all active players regardless of gender, ranked by ELO descending (current behavior preserved)

#### Scenario: Invalid gender filter rejected
- **WHEN** a player requests `GET /rankings?region_id=X&gender=invalid`
- **THEN** the system returns HTTP 400 with detail "invalid gender filter"

### Requirement: Player rank reflects gender filter
The system SHALL compute a player's rank within their gender pool when a gender filter is active.

#### Scenario: Female player rank in female ranking
- **WHEN** there are 3 female players with ELO 1500, 1300, 1100
- **THEN** the player with ELO 1300 has rank 2 in the female ranking
- **THEN** the same player may have rank 15 in the unfiltered ranking

### Requirement: ELO calculation unchanged
The ELO calculation SHALL NOT change based on match type or player gender. All matches use the same K-factor logic and single ELO pool (Model C).

#### Scenario: Mixed match ELO update
- **WHEN** a mixed match is sealed with a result
- **THEN** all 4 players receive ELO updates using the same formula as male or female matches
