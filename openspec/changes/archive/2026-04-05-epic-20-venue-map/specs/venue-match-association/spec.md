## ADDED Requirements

### Requirement: Optional venue_id on match creation
The system SHALL accept an optional `venue_id` field when creating a match. If provided, the venue MUST exist.

#### Scenario: Match created with venue
- **WHEN** a captain creates a match with `venue_id: "<valid-uuid>"`
- **THEN** the match is stored with the given venue_id
- **THEN** the match response includes `venue_id`

#### Scenario: Match created without venue
- **WHEN** a captain creates a match without `venue_id`
- **THEN** the match is created with `venue_id = NULL`
- **THEN** the match response includes `venue_id: null`

#### Scenario: Match with non-existent venue rejected
- **WHEN** a captain creates a match with `venue_id: "<non-existent-uuid>"`
- **THEN** the system returns HTTP 400 with detail "venue not found"

### Requirement: Optional venue_id on flare creation
The system SHALL accept an optional `venue_id` field when creating a flare. If provided, the venue MUST exist.

#### Scenario: Flare created with venue
- **WHEN** a player creates a flare with `venue_id: "<valid-uuid>"`
- **THEN** the flare is stored with the given venue_id
- **THEN** the flare response includes `venue_id`

#### Scenario: Flare created without venue
- **WHEN** a player creates a flare without `venue_id`
- **THEN** the flare is created with `venue_id = NULL` (current behavior preserved)

### Requirement: Venue ID in responses
The system SHALL include `venue_id` in match and flare response DTOs.

#### Scenario: Match response includes venue_id
- **WHEN** a player requests match detail or history
- **THEN** the response includes `venue_id` (may be null)

#### Scenario: Flare response includes venue_id
- **WHEN** a player requests flare listing
- **THEN** each flare includes `venue_id` (may be null)
