## ADDED Requirements

### Requirement: Flare match type
The system SHALL support a `match_type` field on matchmaking flares with values `male`, `female`, or `mixed`. The field SHALL default to `male` if not provided.

#### Scenario: Create flare with match type
- **WHEN** a player creates a flare with `match_type: "female"`
- **THEN** the flare is stored with `match_type = 'female'`

#### Scenario: Create flare without match type
- **WHEN** a player creates a flare without specifying `match_type`
- **THEN** the flare defaults to `match_type = 'male'`

### Requirement: Flare listing filtered by match type
The system SHALL support an optional `match_type` query parameter when listing active flares. When provided, only flares of that type are returned.

#### Scenario: List only female flares
- **WHEN** a player requests `GET /flares?match_type=female&lat=X&lng=Y`
- **THEN** the response contains only flares with `match_type = 'female'`

#### Scenario: List all flares (default)
- **WHEN** a player requests `GET /flares?lat=X&lng=Y` without `match_type`
- **THEN** the response contains flares of all match types (current behavior preserved)

### Requirement: Flare response includes match type
The system SHALL include `match_type` in all flare response DTOs.

#### Scenario: Flare response includes match_type
- **WHEN** a player requests flare details or a flare list
- **THEN** each flare object includes `"match_type": "<value>"`
