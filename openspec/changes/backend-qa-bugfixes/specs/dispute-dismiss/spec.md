## ADDED Requirements

### Requirement: Dispute resolution supports dismiss action
The ResolveDispute operation SHALL accept an `action` field with values "seal" or "dismiss". When action is "dismiss", the match is cancelled and ELO is unfrozen without applying results. When action is "seal" or empty, the current behavior (seal match + apply ELO) is preserved.

#### Scenario: Dismiss dispute cancels match
- **WHEN** a moderator resolves a dispute with action="dismiss"
- **THEN** the match status is set to "cancelled", both captains' ELO is unfrozen, and no ELO changes are applied

#### Scenario: Seal dispute applies results (default)
- **WHEN** a moderator resolves a dispute with action="seal" or empty action
- **THEN** the match is sealed, ELO is applied to all players, and trust recovery runs (current behavior preserved)

#### Scenario: Dismiss with penalize
- **WHEN** a moderator resolves a dispute with action="dismiss" and penalize_player_id set
- **THEN** the match is cancelled, ELO is unfrozen, and the specified player receives a conduct penalty
