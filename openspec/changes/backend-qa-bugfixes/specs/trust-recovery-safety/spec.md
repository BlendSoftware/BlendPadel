## ADDED Requirements

### Requirement: Trust score monthly recovery cap is transaction-safe
The RecoverFromMatch operation SHALL check the monthly recovery cap and apply the recovery within the same database transaction to prevent concurrent match sealings from exceeding the monthly limit.

#### Scenario: Recovery within monthly cap
- **WHEN** a player has used 2 of 5 monthly recovery points and a match seals
- **THEN** the recovery is applied and the monthly count is incremented atomically

#### Scenario: Concurrent sealings respect cap
- **WHEN** two matches seal simultaneously for the same player who has 4 of 5 monthly recovery points
- **THEN** only one recovery is applied (the other is rejected by the transaction), and the cap is not exceeded

#### Scenario: Cap already reached
- **WHEN** a player has already used all monthly recovery points
- **THEN** no recovery is applied and no error is raised (silently skipped)
