## Context

BlendPadel uses PostGIS for player and match locations. The `matches` and `matchmaking_flares` tables store a `geography(Point, 4326)` column for free-form coordinates. There's no concept of a "venue" — every match is just a point on the map. This EPIC introduces venues as a first-class entity.

## Goals / Non-Goals

**Goals:**
- Create a venues table with PostGIS spatial indexing
- Provide CRUD endpoints with spatial proximity search
- Allow any authenticated player to suggest a venue (unverified)
- Allow admin or venue creator to edit venue details
- Allow admin to mark venues as verified
- Optionally link matches and flares to a venue

**Non-Goals:**
- Court booking or availability management
- Venue ratings or reviews
- Venue-specific pricing
- Seeding venue data (done manually or in a separate migration)
- Frontend UI changes

## Decisions

### 1. Venues table schema

```sql
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    court_count INT NOT NULL DEFAULT 1,
    phone VARCHAR(30),
    hours JSONB,
    region_id UUID REFERENCES regions(id),
    added_by UUID NOT NULL REFERENCES users(id),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`hours` is JSONB with day-of-week keys: `{"mon": "08:00-22:00", "tue": "08:00-22:00", ...}`. Nullable — not all venues have known hours.

### 2. Spatial query approach

Same pattern as flares: `ST_DWithin(location, ST_MakePoint(@lng, @lat)::geography, @radius_meters)` with a GIST index on `location`. Returns distance_meters as a computed column.

### 3. Authorization model

| Action | Who |
|--------|-----|
| List/Detail venues | Any authenticated user |
| Create (suggest) venue | Any authenticated user (verified=false) |
| Edit venue | Admin OR the user who added it |
| Verify venue | Admin only (superadmin/moderator) |

Edit and verify share the same `PUT /venues/{id}` endpoint — admin can set `verified=true`, creator can update name/address/etc but not `verified`.

### 4. venue_id on matches and flares

Optional foreign key. Match/flare creation requests gain an optional `venue_id` field. If provided, the venue must exist. If not provided, the match uses free-form lat/lng as before. The venue's coordinates are NOT copied to the match — the match still has its own `location` column.

**Alternative considered**: Auto-set match location from venue coordinates. Rejected because a match might be at a venue but on a specific court at different coordinates, and existing data relies on the match's own location.

### 5. New domain: `internal/venue/`

Following the project's feature-first pattern:
```
internal/venue/
├── model.go        # DTOs and domain types
├── service.go      # Business logic
├── handler.go      # HTTP handlers
├── repository.go   # Interface
├── postgres.go     # Implementation
└── routes.go       # Route registration
```

## Risks / Trade-offs

- **[Risk] Duplicate venue entries** → Users might suggest venues that already exist. Mitigated by: (1) spatial proximity check on creation — warn if venue exists within 100m, (2) admin verification process to merge duplicates.
- **[Trade-off] No seed data in this EPIC** → Venues table starts empty. The dev team manually seeds 15-20 known Mendoza venues after deployment. Could be a migration but manual is faster for MVP.
- **[Trade-off] Hours as free JSONB** → No schema validation on hours format. Simple for MVP, could be formalized later.
