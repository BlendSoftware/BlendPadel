## ADDED Requirements

### Requirement: Match creation uses venue coordinates when venue_id provided
When creating a match with a venue_id, the system SHALL fetch the venue's coordinates and use them for the match location instead of raw latitude/longitude from the request.

#### Scenario: Match created with venue_id
- **WHEN** a CreateMatch request includes a valid venue_id
- **THEN** the match location is set to the venue's stored coordinates, ignoring request lat/lng

#### Scenario: Match created without venue_id
- **WHEN** a CreateMatch request has no venue_id
- **THEN** the match location is set to the request's latitude and longitude

#### Scenario: Invalid venue_id
- **WHEN** a CreateMatch request includes a venue_id that does not exist
- **THEN** the system returns HTTP 404 with a clear error message about the venue
