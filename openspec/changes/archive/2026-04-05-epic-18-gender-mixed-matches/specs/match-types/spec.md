## ADDED Requirements

### Requirement: Match type classification
The system SHALL classify every match as `male`, `female`, or `mixed`. The match type SHALL be set at match creation and stored in the `matches` table.

#### Scenario: Create male match
- **WHEN** a captain creates a match with `match_type: "male"`
- **THEN** the match is stored with `match_type = 'male'`

#### Scenario: Default match type
- **WHEN** a captain creates a match without specifying `match_type`
- **THEN** the match defaults to `match_type = 'male'`

### Requirement: Team composition validation for male matches
The system SHALL reject match creation if `match_type` is `male` and any player in either team has `gender` other than `male`.

#### Scenario: Male match with female player rejected
- **WHEN** a captain creates a match with `match_type: "male"` and team_a includes a player with `gender = 'female'`
- **THEN** the system returns HTTP 400 with detail "all players must be male for a male match"

#### Scenario: Male match with other gender rejected
- **WHEN** a captain creates a match with `match_type: "male"` and team_b includes a player with `gender = 'other'`
- **THEN** the system returns HTTP 400 with detail "all players must be male for a male match"

### Requirement: Team composition validation for female matches
The system SHALL reject match creation if `match_type` is `female` and any player in either team has `gender` other than `female`.

#### Scenario: Female match with male player rejected
- **WHEN** a captain creates a match with `match_type: "female"` and team_a includes a player with `gender = 'male'`
- **THEN** the system returns HTTP 400 with detail "all players must be female for a female match"

### Requirement: Team composition validation for mixed matches
The system SHALL require at least one `male` and one `female` (or `other`) player per team for `mixed` matches.

#### Scenario: Mixed match with valid composition
- **WHEN** a captain creates a match with `match_type: "mixed"` and team_a has 1 male + 1 female, team_b has 1 male + 1 other
- **THEN** the match is created successfully

#### Scenario: Mixed match with single-gender team rejected
- **WHEN** a captain creates a match with `match_type: "mixed"` and team_a has 2 male players
- **THEN** the system returns HTTP 400 with detail "mixed matches require at least one player of each gender per team"

### Requirement: Match type in match responses
The system SHALL include `match_type` in all match response DTOs (match detail, match history).

#### Scenario: Match response includes match_type
- **WHEN** a player requests `GET /matches/{id}`
- **THEN** the response body includes `"match_type": "<value>"`
