## Why

BlendPadel MVP treats all players and matches as gender-neutral. Women can't find female-only matches, mixed doubles aren't supported, and rankings show everyone in a single pool. Adding gender as a first-class concept unlocks female padel, mixed matches, and gender-filtered rankings — expanding the addressable market and improving matchmaking relevance for all players.

## What Changes

- Add `gender` field to player profiles (mandatory at onboarding: `male`, `female`, `other`)
- Add `match_type` to matches and flares (`male`, `female`, `mixed`)
- Validate team composition against match type (e.g., female match requires all-female teams)
- Filter rankings by gender (same ELO, filtered views — Model C)
- Filter matchmaking flares by match type
- Update all profile queries and responses to include gender
- Existing players without gender need a migration strategy (set default `male` for existing data, require update on next login)

## Capabilities

### New Capabilities
- `player-gender`: Gender field on player profile, mandatory at onboarding, included in all profile responses
- `match-types`: Match type classification (male/female/mixed) with team composition validation
- `gender-rankings`: Rankings filtered by gender via query parameter, same ELO pool (Model C)
- `matchmaking-gender-filter`: Flares include match type, listing filters by match type

### Modified Capabilities

## Impact

- **Database**: Migration adds `gender` to `users`, `match_type` to `matches` and `matchmaking_flares` (3 ALTER TABLE statements)
- **Backend domains affected**: `player` (model, handler, service), `match` (model, service, handler), `matchmaking` (model, handler, queries), `ranking` (handler, service, queries)
- **sqlc queries**: 8+ queries need modification (rankings, matches, flares, profiles, players)
- **API changes**: Onboarding request gains `gender` field, match/flare creation gains `match_type`, rankings endpoint gains `?gender=` query param, profile responses gain `gender`
- **Frontend (future EPIC)**: Onboarding screen, match/flare creation, rankings tab
- **Breaking changes**: None for existing clients (new fields have defaults, gender filter is optional on rankings)
