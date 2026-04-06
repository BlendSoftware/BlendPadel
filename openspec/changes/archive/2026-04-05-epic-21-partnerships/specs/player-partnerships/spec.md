## ADDED Requirements

### Requirement: Request partnership
The system SHALL allow a player to request a partnership with another player via `POST /partnerships`.

#### Scenario: Successful request
- **WHEN** player A sends `POST /partnerships` with `partner_id: B`
- **THEN** a partnership is created with status `pending`, requester_id=A, partner_id=B
- **THEN** the system returns HTTP 201

#### Scenario: Self-partnership rejected
- **WHEN** a player sends `POST /partnerships` with their own ID
- **THEN** the system returns HTTP 400

#### Scenario: Duplicate request rejected
- **WHEN** player A already has a pending/accepted partnership with B (in either direction)
- **THEN** the system returns HTTP 409

#### Scenario: Active partnership limit reached
- **WHEN** player A already has 5 accepted partnerships
- **THEN** the system returns HTTP 409 with detail "maximum active partnerships reached"

### Requirement: Accept partnership
The system SHALL allow the partner (not the requester) to accept a pending request via `PUT /partnerships/{id}/accept`.

#### Scenario: Partner accepts
- **WHEN** player B (the partner) sends `PUT /partnerships/{id}/accept` for a pending request
- **THEN** the partnership status changes to `accepted`

#### Scenario: Requester cannot accept own request
- **WHEN** player A (the requester) sends `PUT /partnerships/{id}/accept`
- **THEN** the system returns HTTP 403

#### Scenario: Non-pending cannot be accepted
- **WHEN** a player tries to accept an already accepted partnership
- **THEN** the system returns HTTP 409

### Requirement: Reject partnership
The system SHALL allow the partner to reject a pending request via `PUT /partnerships/{id}/reject`.

#### Scenario: Partner rejects
- **WHEN** player B sends `PUT /partnerships/{id}/reject` for a pending request
- **THEN** the partnership status changes to `rejected`

### Requirement: Dissolve partnership
The system SHALL allow either party to dissolve an accepted partnership via `DELETE /partnerships/{id}`.

#### Scenario: Either party dissolves
- **WHEN** either the requester or partner sends `DELETE /partnerships/{id}` for an accepted partnership
- **THEN** the partnership status changes to `dissolved`

#### Scenario: Cannot dissolve non-accepted partnership
- **WHEN** a player tries to dissolve a pending partnership
- **THEN** the system returns HTTP 409

### Requirement: List active partnerships
The system SHALL return a player's accepted partnerships via `GET /partnerships/me`.

#### Scenario: Player with partners
- **WHEN** a player with 3 accepted partnerships requests `GET /partnerships/me`
- **THEN** the response contains 3 partnerships with partner details

#### Scenario: Player with no partners
- **WHEN** a player with no accepted partnerships requests `GET /partnerships/me`
- **THEN** the response contains an empty list
