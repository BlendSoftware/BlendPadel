## Context

BlendPadel stores match results with team composition in `match_players` (match_id, player_id, team) and results in `match_results` (winner_team, sets). By joining these tables, we can compute pair statistics: how often two players played together and won.

## Goals / Non-Goals

**Goals:**
- Compute win rate, total matches, and current win streak for any pair of players
- Find a player's "best partner" (highest win rate, minimum 3 matches together)
- Serve these as API endpoints linked to partnerships

**Non-Goals:**
- Storing precomputed stats (all derived at query time)
- ELO-based pair rating (just win/loss stats)
- Comparison charts or visualizations (frontend concern)

## Decisions

### 1. Stats are computed, not stored

All pair metrics are derived from `match_players` + `match_results` at query time. With the small player pool in Mendoza, this is fast enough. No materialized views or denormalized tables needed for MVP.

### 2. SQL approach for pair stats

```sql
-- Matches where both players were on the same team
SELECT
    COUNT(*) AS total_matches,
    COUNT(*) FILTER (WHERE mr.winner_team = mp1.team) AS wins
FROM match_players mp1
JOIN match_players mp2 ON mp1.match_id = mp2.match_id
    AND mp1.team = mp2.team
    AND mp1.player_id != mp2.player_id
JOIN matches m ON m.id = mp1.match_id AND m.status = 'sealed'
JOIN match_results mr ON mr.match_id = mp1.match_id
WHERE mp1.player_id = $1 AND mp2.player_id = $2;
```

### 3. Best partner: minimum 3 matches threshold

To avoid "100% win rate with 1 match", best partner requires at least 3 sealed matches together. Among those qualifying, pick the highest win rate.

### 4. Endpoints live in partnership domain

Since pair stats are tightly coupled to partnerships, the endpoints live in the partnership handler/service. No new domain needed.

## Risks / Trade-offs

- **[Trade-off] Query-time computation** → Could be slow with many matches. Acceptable for MVP scale. Can add materialized view later if needed.
- **[Trade-off] No streak persistence** → Win streak is computed by scanning recent matches in order. Simple but O(n) on match history.
