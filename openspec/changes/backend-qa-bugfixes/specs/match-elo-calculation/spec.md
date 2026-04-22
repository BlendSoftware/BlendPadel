## ADDED Requirements

### Requirement: Match creation calculates real average ELO
When a match is created, the system SHALL fetch the current ELO rating of all 4 players and compute the average. The avg_elo field MUST reflect the actual average, not a hardcoded default.

#### Scenario: Match created with 4 players of known ELO
- **WHEN** a match is created with players having ELO values 1200, 1300, 1100, 1400
- **THEN** the match avg_elo is set to 1250

#### Scenario: Match created with calibration players (default ELO)
- **WHEN** a match is created with players who have just completed onboarding
- **THEN** the match avg_elo reflects their initial calculated ELO from onboarding, not 0

### Requirement: Player ELOs fetched in batch
The system SHALL fetch all player ELOs in a single batch query, not N+1 individual queries.

#### Scenario: Batch ELO fetch for 4 players
- **WHEN** CreateMatch needs ELO for 4 players
- **THEN** a single query retrieves all 4 ELO values
