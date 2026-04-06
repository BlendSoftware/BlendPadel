## ADDED Requirements

### Requirement: Feed endpoint
The system SHALL return a paginated activity feed via `GET /feed`, filterable by region.

#### Scenario: Feed with events
- **WHEN** a player requests `GET /feed?region_id=X&limit=10`
- **THEN** the response contains up to 10 recent feed items, newest first, each with player_name, event_type, content, created_at

#### Scenario: Empty feed
- **WHEN** a player requests `GET /feed?region_id=X` for a region with no events
- **THEN** the response contains an empty list

### Requirement: Win streak events
The system SHALL generate a `win_streak` feed event when a player wins 3 or more consecutive sealed matches.

#### Scenario: Player reaches 3-win streak
- **WHEN** a match is sealed and the winning player now has 3 consecutive wins
- **THEN** a feed event is created with event_type=`win_streak` and content including streak count and player name

### Requirement: Match milestone events
The system SHALL generate a `match_milestone` feed event when a player reaches 10, 25, 50, or 100 validated matches.

#### Scenario: Player reaches 10th match
- **WHEN** a match is sealed and the player's validated_match_count reaches 10
- **THEN** a feed event is created with event_type=`match_milestone` and content including milestone number

### Requirement: Feed events include player context
The system SHALL include the player's name and region in each feed event for display purposes.

#### Scenario: Feed item includes player info
- **WHEN** a feed item is returned in the feed endpoint
- **THEN** the response includes player_name and region_id
