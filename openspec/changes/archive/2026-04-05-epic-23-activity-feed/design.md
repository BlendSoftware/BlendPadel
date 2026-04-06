## Context

BlendPadel has no social features beyond match results. Adding an automatic activity feed creates engagement without user effort. Events are generated when matches are sealed.

## Goals / Non-Goals

**Goals:**
- Store achievement events in `activity_feed` table
- Generate events automatically on match seal (win streak, milestone matches)
- Serve a paginated, region-filtered feed endpoint

**Non-Goals:**
- User follows, likes, comments (Fase 3)
- Push notifications for feed events
- Feed personalization or algorithmic ranking

## Decisions

### 1. Activity feed table

```sql
CREATE TABLE activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL,
    content JSONB NOT NULL,
    region_id UUID REFERENCES regions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Event types: `win_streak`, `match_milestone`, `elo_milestone`.

### 2. Event generation via match seal hook

After a match is sealed, the feed service checks each player for:
- **Win streak**: 3+ consecutive sealed match wins → `win_streak` event
- **Match milestone**: 10th, 25th, 50th, 100th validated match → `match_milestone` event

Events are generated inline in the seal flow. Since this is fire-and-forget (errors logged, not propagated), it won't slow down match sealing.

### 3. Feed endpoint

`GET /feed?region_id=X&limit=20&offset=0` — returns recent feed items for a region, newest first. Includes player name for display.

### 4. New domain: `internal/feed/`

Minimal domain with just the CRUD + generation logic.

## Risks / Trade-offs

- **[Trade-off] Inline event generation** → Could miss events if generation fails. Acceptable for MVP — events are nice-to-have, not critical.
- **[Trade-off] No deduplication** → Win streak events could duplicate if a player is on a long streak. Mitigated by checking if a recent event of the same type exists.
