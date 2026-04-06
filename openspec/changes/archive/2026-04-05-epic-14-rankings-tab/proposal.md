# Proposal — EPIC 14: Rankings Tab (Tab 3)

## Intent

Implement the full Rankings tab for BlendPadel PWA: a region-filtered leaderboard where authenticated users can see the top players in their zone, their own position highlighted even if outside top N, gold/silver/bronze medals for top 3, region persistence across sessions, and an embeddable ELO projection card for pre-match decisions.

## Scope

### In scope
- `src/stores/rankings-store.ts` — Zustand store with persist middleware
- `src/features/rankings/RankingsPage.tsx` — rewrite existing placeholder
- `src/features/rankings/RankEntry.tsx` — individual leaderboard row
- `src/features/rankings/RankingTable.tsx` — full list with sticky current-user row
- `src/features/rankings/RegionPicker.tsx` — bottom-sheet region selector modal
- `src/features/rankings/ProjectionCard.tsx` — standalone ELO win/loss delta card
- `src/features/rankings/SkeletonRow.tsx` — loading skeleton for leaderboard rows

### Out of scope
- EPIC 16 matchmaking integration (ProjectionCard is ready for it, but wiring is deferred)
- Infinite scroll / load-more pagination (limit=10 is sufficient for MVP)
- Friend-filtered rankings tab

## Approach

### State: Zustand + persist
Store holds `selectedRegionId`, `regions[]`, `rankings[]`, `myPosition`, `projection`, plus loading/error flags. `selectedRegionId` persists to `localStorage` via `zustand/middleware/persist` so the last selected region survives page refresh.

### Data flow
1. On mount: `fetchRegions()` → populate dropdown, then `fetchRankings(selectedRegionId)`.
2. On region change: update store, trigger `fetchRankings()` immediately.
3. Pull-to-refresh: `refresh()` re-runs both fetches.
4. Projection: called on demand with 4 player IDs, stored separately.

### My position
Backend returns `RankingEntry` for the authenticated user via a separate object in the rankings response or via the user's own rank. If user is already in the top list (`rank <= limit`), no sticky footer is needed. If not, show a divider + sticky row at the bottom.

### Medals
Positions 1, 2, 3 get emoji medal (`🥇 🥈 🥉`) instead of the numeric rank badge. Pure presentational logic in `RankEntry`.

### Region picker
A controlled modal overlay (no external lib dependency) with a list of region chips. Closes on selection or backdrop tap.

## Endpoint contract assumptions

| Endpoint | Response shape |
|----------|---------------|
| `GET /regions` | `Region[]` where `Region = { id: string; name: string }` |
| `GET /rankings?region_id=&limit=10` | `{ rankings: RankingEntry[]; my_position: RankingEntry \| null }` |
| `GET /matches/projection?team_a=id1,id2&team_b=id3,id4` | `{ win_delta: number; loss_delta: number }` |

## Risks

- If backend returns flat `RankingEntry[]` without `my_position`, we derive it by matching `user_id` against auth store user.
- Region selector UX depends on total region count — if > 10, a search input may be needed (deferred).
