## ADDED Requirements

### Requirement: Player gender field
The system SHALL store a `gender` field for every player with allowed values `male`, `female`, or `other`. The field SHALL be mandatory and persisted in the `users` table.

#### Scenario: Gender stored at onboarding
- **WHEN** a player completes onboarding with `gender: "female"`
- **THEN** the system stores `gender = 'female'` in the user record

#### Scenario: Invalid gender rejected
- **WHEN** a player submits onboarding with `gender: "unknown"`
- **THEN** the system returns HTTP 400 with error detail "invalid gender value"

#### Scenario: Gender missing from onboarding
- **WHEN** a player submits onboarding without a `gender` field
- **THEN** the system returns HTTP 400 with error detail "gender is required"

### Requirement: Gender in profile responses
The system SHALL include `gender` in all profile response DTOs: own profile, public profile, and player profile.

#### Scenario: Own profile includes gender
- **WHEN** a player requests `GET /players/me`
- **THEN** the response body includes `"gender": "<value>"`

#### Scenario: Public profile includes gender
- **WHEN** a player requests `GET /players/{id}`
- **THEN** the response body includes `"gender": "<value>"`

### Requirement: Existing users migration
The system SHALL migrate existing users without a gender to `gender = 'male'` as the default value in the database migration.

#### Scenario: Migration applies default gender
- **WHEN** migration 000011 runs on a database with existing users
- **THEN** all existing users have `gender = 'male'`
- **THEN** the `gender` column has a NOT NULL constraint
