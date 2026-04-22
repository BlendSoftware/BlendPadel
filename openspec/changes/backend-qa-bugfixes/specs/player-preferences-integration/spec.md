## ADDED Requirements

### Requirement: Radar applies player preferences as defaults
The radar GetMatches endpoint SHALL use the authenticated player's saved preferences (search_radius_km, elo_delta) as defaults when query parameters are not explicitly provided.

#### Scenario: No query params uses saved preferences
- **WHEN** a player with saved preferences (radius=15km, elo_delta=300) calls GET /radar/matches without radius or ELO params
- **THEN** the results are filtered using radius=15km and ELO range based on player's ELO +/- 300

#### Scenario: Explicit query params override preferences
- **WHEN** a player with saved preferences calls GET /radar/matches?radius_km=5&elo_min=800&elo_max=1200
- **THEN** the explicit values are used, not the saved preferences

#### Scenario: No preferences and no params uses system defaults
- **WHEN** a player with no saved preferences calls GET /radar/matches without params
- **THEN** system defaults are used (radius=10km, elo_spread=200)

### Requirement: Radar alerts respect user search radius
The radar GetAlerts endpoint SHALL accept an optional radius parameter and fall back to the player's saved preference, then to the 5km system default.

#### Scenario: Alerts with custom radius
- **WHEN** a player calls GET /radar/alerts?radius_km=20
- **THEN** alerts within 20km are returned

#### Scenario: Alerts with saved preference
- **WHEN** a player with saved radius=15km calls GET /radar/alerts without radius param
- **THEN** alerts within 15km are returned

### Requirement: Matchmaking applies player preferences as defaults
The matchmaking GetFlares endpoint SHALL use the authenticated player's saved preferences as defaults when query parameters are not explicitly provided.

#### Scenario: Flares filtered by saved preferences
- **WHEN** a player with saved elo_delta=200 calls GET /matchmaking/flares without ELO params
- **THEN** flares are filtered using the player's ELO +/- 200
