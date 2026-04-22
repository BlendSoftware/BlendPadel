## ADDED Requirements

### Requirement: ConfirmMatch executes status update and seal atomically
The ConfirmMatch operation SHALL execute the status update to "sealed" and all sealMatch operations (ELO application, trust recovery, calibration check) within a single database transaction. If any step fails, the entire operation MUST roll back.

#### Scenario: Successful confirmation seals match and applies ELO
- **WHEN** captain_b confirms a match in awaiting_confirmation status within the 6h window
- **THEN** the match status changes to "sealed" AND ELO is applied to all 4 players AND trust recovery is applied, all atomically

#### Scenario: ELO application failure rolls back status change
- **WHEN** captain_b confirms a match but the ELO calculation fails
- **THEN** the match status remains "awaiting_confirmation" (not "sealed") and no partial state is persisted

#### Scenario: Trust recovery failure rolls back entire seal
- **WHEN** captain_b confirms a match but trust recovery fails after ELO was computed
- **THEN** the match status remains "awaiting_confirmation" and no ELO changes are applied
