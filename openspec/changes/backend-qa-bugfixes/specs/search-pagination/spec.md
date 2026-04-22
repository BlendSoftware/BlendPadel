## ADDED Requirements

### Requirement: Player search by name is paginated
The SearchByName endpoint SHALL accept a limit parameter (default 20, max 50) to cap the number of results returned.

#### Scenario: Default limit applied
- **WHEN** a player search is performed without a limit parameter
- **THEN** at most 20 results are returned

#### Scenario: Custom limit respected
- **WHEN** a player search is performed with limit=10
- **THEN** at most 10 results are returned

#### Scenario: Limit capped at maximum
- **WHEN** a player search is performed with limit=500
- **THEN** at most 50 results are returned
