## Context

BlendPadel backend (Go 1.22+, Chi, sqlc, PostgreSQL) has 14 verified bugs across match, radar, matchmaking, player, and trust domains. The bugs range from data corruption (match sealed without ELO) to incorrect HTTP status codes and missing endpoints. The codebase already has correct patterns in some domains (e.g., partnership handler uses `errors.Is()`) but inconsistent application in others (match handler uses direct `switch err`).

Current architecture: feature-first domain packages under `internal/`, each with handler → service → repository layers. Repository uses sqlc-generated code. No cross-domain transactions exist yet.

## Goals / Non-Goals

**Goals:**
- Fix all 14 verified backend bugs without breaking existing API contracts
- Ensure match sealing is atomic (status + ELO + trust in one transaction)
- Make error responses consistent across all handlers (RFC 7807 with correct status codes)
- Connect preference persistence to consumption (radar, matchmaking)

**Non-Goals:**
- Frontend fixes (6 Franco bugs are frontend-only — separate epic)
- New features beyond what's needed to fix bugs
- Performance optimization (indexes, query tuning) — separate concern
- Refactoring domain boundaries or architecture

## Decisions

### D1: Fix mapError with errors.Is() chain (not error codes)

Use the same `switch { case errors.Is(err, ...): }` pattern that `partnership/handler.go` already uses. This handles wrapped errors from `fmt.Errorf("...: %w", err)`.

**Alternative considered**: Error code enum system with typed errors. Rejected — overengineered for a bugfix epic. The `errors.Is()` pattern is idiomatic Go and already proven in the codebase.

### D2: Transaction for ConfirmMatch via pgx.Tx passthrough

Create a `SealMatchTx` method that accepts a `pgx.Tx` and passes it through to repository, ranking service, and trust service operations. The `ConfirmMatch` method starts a transaction, calls `UpdateStatusTx` + `SealMatchTx`, and commits or rolls back.

**Alternative considered**: Saga pattern with compensating actions. Rejected — overkill for a single-database system. A simple DB transaction is sufficient and correct.

**Implementation**: Add `BeginTx()` to match repository interface. Ranking and trust services need `ApplyELOTx` and `RecoverFromMatchTx` variants that accept `pgx.Tx`. This is the most invasive change but critical for data integrity.

### D3: avg_elo via new repository method

Add `GetPlayerELOs(ctx, []uuid.UUID) (map[uuid.UUID]int, error)` to match repository. Single batch query instead of N+1. Compute average in service layer.

**Alternative considered**: Cross-service call to ranking service. Rejected — adds coupling. The ELO is stored in the users table, accessible from any repo.

### D4: MatchResponse extension (additive, non-breaking)

Add optional fields to MatchResponse: `WinnerTeam`, `TotalGamesA`, `TotalGamesB`, `GameDiff`, `Sets`. These are `omitempty` so unsealed matches return the same shape as before.

### D5: GET /matches/{id} uses existing GetMatchWithPlayers

The repository already has `GetMatchWithPlayers()` which returns `MatchFull` with result data. The new handler just needs to call it and map to the extended `MatchResponse`.

### D6: Venue coordinate resolution in match service

Inject venue repository (or a `VenueCoordsFetcher` interface) into match service. In `CreateMatch`, if `VenueID != nil`, fetch venue and use its coordinates. This keeps the venue domain decoupled — match service only needs lat/lng from it.

### D7: Preferences as overridable defaults

Radar and matchmaking handlers check if query params are provided. If not, fetch player preferences and use those. If preferences are also empty, use system defaults. Three-tier fallback: explicit params > saved preferences > system defaults.

Inject `PlayerPreferencesFetcher` interface (single method: `GetPreferences(ctx, userID) (Preferences, error)`) into radar and matchmaking services. This avoids importing the full player package.

### D8: ResolveDispute action field

Add `Action string` to `ResolveDisputeRequest` with values `"seal"` (default, current behavior) and `"dismiss"`. Dismiss sets match to cancelled, unfreezes ELO, skips seal. Empty action defaults to `"seal"` for backwards compatibility.

### D9: Avatar upload buffering

Replace Seek-based flow with full buffer read: `io.ReadAll(io.LimitReader(file, maxAvatarSize+1))`. Check length > maxAvatarSize. Use `bytes.NewReader(buf)` for both MIME detection and file write. Eliminates Seek dependency entirely.

## Risks / Trade-offs

- **[D2 Transaction scope]** Passing `pgx.Tx` through service boundaries couples services to pgx. → Acceptable for a monolith. If we ever split services, we'd need saga anyway.
- **[D2 Implementation complexity]** Adding Tx variants to ranking and trust services is the largest change. → Mitigate by keeping the Tx methods as thin wrappers that delegate to existing logic.
- **[D7 N+1 on preferences]** Fetching preferences on every radar/matchmaking request adds a DB call. → Single indexed lookup by user ID, negligible latency. Could cache later if needed.
- **[D8 Backwards compatibility]** Existing admin clients sending ResolveDisputeRequest without `action` field. → Default to `"seal"` preserves current behavior.
