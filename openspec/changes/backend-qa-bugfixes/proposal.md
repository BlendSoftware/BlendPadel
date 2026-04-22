## Why

QA audit (code review + user reports from Franco Mellimaci, 2026-04-09) revealed 14 backend bugs ranging from data corruption (match sealed without ELO applied) to broken features (preferences never applied) and incorrect HTTP error codes (wrapped errors always return 500). These bugs affect core gameplay loops — match creation, result confirmation, ranking display — and must be fixed before onboarding more users.

## What Changes

- Fix match handler error mapping to use `errors.Is()` instead of direct comparison, so wrapped errors return correct HTTP status codes
- Wrap ConfirmMatch + sealMatch in a database transaction to prevent partial state (sealed without ELO)
- Calculate real avg_elo when creating a match instead of hardcoding 0
- Add result data (winner, scores, sets) to MatchResponse DTO
- Create GET /matches/{id} endpoint for fetching individual match details
- Use venue coordinates when venue_id is provided in match creation
- Apply saved player preferences as defaults in radar and matchmaking services
- Make radar alerts respect user's search radius preference
- Validate player ban status before allowing match creation
- Validate onboarding completion before allowing flare creation
- Add dismiss action to dispute resolution (cancel match without sealing)
- Add pagination limit to player search by name
- Harden avatar upload against non-seekable multipart streams
- Make trust score monthly recovery cap transaction-safe

## Capabilities

### New Capabilities

- `match-detail`: GET /matches/{id} endpoint returning full match data including teams, result, and venue info
- `match-error-handling`: Correct HTTP error mapping for all match domain endpoints using errors.Is() pattern
- `match-transaction-safety`: Atomic match sealing with transactional ELO and trust score application
- `match-elo-calculation`: Real-time avg_elo computation during match creation
- `match-venue-coords`: Venue-based coordinate resolution when venue_id is provided
- `match-result-response`: Extended MatchResponse with result data fields
- `player-preferences-integration`: Preferences applied as defaults in radar and matchmaking queries
- `match-validation-guards`: Ban status and onboarding checks before match/flare creation
- `dispute-dismiss`: Dismiss action for dispute resolution without sealing
- `search-pagination`: Paginated player search with configurable limits
- `avatar-upload-hardening`: Non-seekable stream support for avatar uploads
- `trust-recovery-safety`: Transaction-safe monthly recovery cap enforcement

### Modified Capabilities

## Impact

- **Match domain** (`internal/match/`): handler.go, service.go, model.go, routes.go, repository.go, postgres.go — most changes concentrated here
- **Radar domain** (`internal/radar/`): service.go, handler.go — preferences injection
- **Matchmaking domain** (`internal/matchmaking/`): service.go — preferences injection, onboarding validation
- **Player domain** (`internal/player/`): service.go, handler.go — avatar upload, search pagination
- **Trust domain** (`internal/trust/`): service.go — transaction-safe recovery cap
- **API surface**: One new endpoint (GET /matches/{id}), one modified request DTO (ResolveDisputeRequest adds `action` field)
- **No breaking changes**: All existing endpoints retain their contracts, responses gain additional fields
