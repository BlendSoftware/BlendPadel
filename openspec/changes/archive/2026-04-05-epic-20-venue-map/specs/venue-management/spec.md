## ADDED Requirements

### Requirement: List venues by proximity
The system SHALL return venues near a given lat/lng within a specified radius via `GET /venues`.

#### Scenario: List venues within 10km
- **WHEN** a player requests `GET /venues?lat=-32.89&lng=-68.84&radius_km=10`
- **THEN** the response contains venues within 10km, each with `distance_meters`
- **THEN** results are ordered by distance ascending

#### Scenario: No venues in range
- **WHEN** a player requests `GET /venues?lat=0&lng=0&radius_km=1`
- **THEN** the response contains an empty list

#### Scenario: Missing lat/lng rejected
- **WHEN** a player requests `GET /venues` without lat or lng
- **THEN** the system returns HTTP 400

### Requirement: Get venue detail
The system SHALL return the full details of a venue by ID via `GET /venues/{id}`.

#### Scenario: Venue found
- **WHEN** a player requests `GET /venues/{id}` for an existing venue
- **THEN** the response contains all venue fields including name, address, lat, lng, court_count, phone, hours, verified, added_by

#### Scenario: Venue not found
- **WHEN** a player requests `GET /venues/{id}` for a non-existent ID
- **THEN** the system returns HTTP 404

### Requirement: Create (suggest) venue
The system SHALL allow any authenticated player to suggest a new venue via `POST /venues`. New venues SHALL have `verified = false`.

#### Scenario: Successful venue creation
- **WHEN** a player sends `POST /venues` with name, address, lat, lng, court_count
- **THEN** the venue is created with `verified = false` and `added_by = caller_id`
- **THEN** the system returns HTTP 201 with the created venue

#### Scenario: Missing required fields
- **WHEN** a player sends `POST /venues` without name or address
- **THEN** the system returns HTTP 400

### Requirement: Edit venue
The system SHALL allow the venue creator or an admin to update venue details via `PUT /venues/{id}`.

#### Scenario: Creator edits own venue
- **WHEN** the user who created a venue sends `PUT /venues/{id}` with updated name
- **THEN** the venue is updated
- **THEN** the `verified` field cannot be changed by a non-admin

#### Scenario: Admin edits and verifies venue
- **WHEN** an admin sends `PUT /venues/{id}` with `verified: true`
- **THEN** the venue is updated and marked as verified

#### Scenario: Non-owner non-admin rejected
- **WHEN** a player who is not the creator or admin sends `PUT /venues/{id}`
- **THEN** the system returns HTTP 403

### Requirement: Venue response includes all fields
The system SHALL include id, name, address, lat, lng, court_count, phone, hours, verified, region_id, added_by, created_at in all venue responses.

#### Scenario: Venue response structure
- **WHEN** a venue is returned in any endpoint response
- **THEN** the response includes all specified fields
