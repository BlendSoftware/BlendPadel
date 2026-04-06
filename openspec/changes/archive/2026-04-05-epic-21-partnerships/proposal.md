## Why

In informal padel, players have regular partners they play doubles with. Currently there's no way to formalize this relationship. Adding partnerships enables pre-selection of partners when creating matches/flares and unlocks pair metrics (EPIC 22).

## What Changes

- New `player_partnerships` table with bidirectional acceptance flow (pending → accepted/rejected/dissolved)
- CRUD endpoints: request partnership, accept, reject, dissolve, list my partners
- Up to 5 active partnerships per player
- Both players must accept for a partnership to be active

## Capabilities

### New Capabilities
- `player-partnerships`: Bidirectional partnership management with request/accept/reject/dissolve lifecycle and a limit of 5 active partners

### Modified Capabilities

## Impact

- **Database**: New `player_partnerships` table (migration 000013)
- **New backend domain**: `internal/partnership/` (model, handler, service, repository, postgres, routes)
- **New sqlc queries**: `queries/partnerships.sql`
- **API changes**: 5 new endpoints under `/partnerships`
- **Breaking changes**: None
