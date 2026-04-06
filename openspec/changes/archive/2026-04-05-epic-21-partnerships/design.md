## Context

BlendPadel has no concept of player partnerships. Players create matches with any 4 players but can't designate regular doubles partners. This EPIC adds a partnership entity with a bidirectional acceptance flow.

## Goals / Non-Goals

**Goals:**
- Allow players to request, accept, reject, and dissolve partnerships
- Limit active partnerships to 5 per player
- List a player's active partners
- Provide foundation for pair metrics (EPIC 22)

**Non-Goals:**
- Auto-assigning partner when creating match/flare (future enhancement)
- Partnership-based matchmaking filtering
- Partnership history or statistics (that's EPIC 22)

## Decisions

### 1. Partnership table schema

```sql
CREATE TABLE player_partnerships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id),
    partner_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'dissolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_partnership CHECK (requester_id != partner_id),
    CONSTRAINT unique_partnership UNIQUE (requester_id, partner_id)
);
```

### 2. Bidirectional uniqueness

The UNIQUE constraint on `(requester_id, partner_id)` prevents duplicate requests in one direction. The service layer also checks the reverse direction — if A→B exists, B→A is rejected with "partnership already exists".

### 3. Limit of 5 active partnerships

Enforced in the service layer, not the database. Before creating a new partnership request, count the requester's active (accepted) partnerships. If >= 5, reject.

### 4. Status lifecycle

```
pending ──→ accepted ──→ dissolved
        └─→ rejected
```

Only the partner (not the requester) can accept or reject. Either party can dissolve an accepted partnership.

### 5. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /partnerships | Request partnership (body: partner_id) |
| PUT | /partnerships/{id}/accept | Accept pending request |
| PUT | /partnerships/{id}/reject | Reject pending request |
| DELETE | /partnerships/{id} | Dissolve active partnership |
| GET | /partnerships/me | List my active partners |

## Risks / Trade-offs

- **[Risk] Spam partnership requests** → Mitigated by: only 1 pending request per pair (UNIQUE constraint), limit of 5 active partnerships.
- **[Trade-off] No notification on partnership request** → Could add push notification later. For now, partners check manually.
