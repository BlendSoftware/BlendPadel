## ADDED Requirements

### Requirement: Match creation validates player ban status
The CreateMatch operation SHALL verify that all 4 players have an active (non-banned) status before allowing match creation.

#### Scenario: Match with banned player rejected
- **WHEN** a CreateMatch request includes a player with status "banned"
- **THEN** the system returns HTTP 422 with a clear error message identifying the banned player

#### Scenario: Match with all active players proceeds
- **WHEN** a CreateMatch request includes 4 players all with active status
- **THEN** match creation proceeds normally

### Requirement: Flare creation validates onboarding completion
The CreateFlare operation SHALL verify that the creating player has completed onboarding (has gender, region, and ELO assigned) before allowing flare creation.

#### Scenario: Flare by non-onboarded player rejected
- **WHEN** a player who has not completed onboarding attempts to create a flare
- **THEN** the system returns HTTP 422 with a message indicating onboarding must be completed first

#### Scenario: Flare by onboarded player proceeds
- **WHEN** a player who has completed onboarding creates a flare
- **THEN** flare creation proceeds normally
