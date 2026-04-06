## Why

Pair metrics are the highest-retention feature in Fase 2. "Con vos tenemos 73% de win rate" generates organic conversation and virality. Players want to know who they play best with, their win rate as a pair, and how they compare playing solo vs with a partner.

## What Changes

- New endpoint to get pair statistics for a partnership (win rate, total matches, streak)
- New endpoint to get a player's "best partner" (highest win rate with minimum matches threshold)
- All stats derived from existing `match_players` + `match_results` data — no new tables needed

## Capabilities

### New Capabilities
- `pair-metrics`: Partnership statistics (win rate, total matches, streak) and best partner detection, derived from match history

### Modified Capabilities

## Impact

- **Database**: No new tables. New sqlc queries joining `match_players` + `match_results`
- **Backend**: New endpoints in partnership domain (or new `stats` sub-package)
- **API changes**: `GET /partnerships/{id}/stats`, `GET /players/me/best-partner`
- **Breaking changes**: None
