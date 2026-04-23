# BlendPadel Backend — API Reference for Frontend Development

> Generated 2026-04-23. Source of truth: Go backend in `backend/`.
> Base URL: `http://localhost:8080` (env `APP_PORT`).
> **No `/api/v1` prefix** — all routes are at root level.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Error Format (RFC 7807)](#error-format-rfc-7807)
3. [Player Lifecycle](#player-lifecycle)
4. [Match Lifecycle](#match-lifecycle)
5. [Endpoints by Domain](#endpoints-by-domain)
   - [System](#system)
   - [Auth](#auth)
   - [Player / Profile / Onboarding](#player)
   - [Match](#match)
   - [Matchmaking (Flares)](#matchmaking-flares)
   - [Venue](#venue)
   - [Leaderboard / Rankings](#leaderboard--rankings)
   - [Radar](#radar)
   - [Partnership](#partnership)
   - [Feed](#feed)
   - [Notification](#notification)
   - [Admin](#admin)
6. [Route Summary Table](#route-summary-table)
7. [Background Jobs](#background-jobs)
8. [Business Rules Cheat Sheet](#business-rules-cheat-sheet)

---

## Authentication & Authorization

### JWT Access Token

- **Algorithm**: HS256
- **TTL**: 1 hour
- **Header**: `Authorization: Bearer <access_token>`
- **Claims**:
  ```json
  {
    "sub": "<user-uuid>",
    "iat": 1714000000,
    "exp": 1714003600,
    "role": "player | moderator | superadmin",
    "region_id": "<uuid> (omitempty)"
  }
  ```

### Refresh Token

- Opaque 32-byte random, base64url-encoded
- **TTL**: 30 days
- Rotation on every use (old token is revoked)
- Token family invalidation: reusing a revoked token revokes ALL tokens in the family (replay detection)

### Roles

| Role | Access |
|------|--------|
| `player` | Default. All player-facing endpoints |
| `moderator` | Region-scoped. Disputes + reports in assigned region |
| `superadmin` | Full access. All admin endpoints |

### Rate Limiting (auth routes only)

- Sliding window: **50 requests / 15 min per IP** (will be 5 in production)
- Header `X-RateLimit-Remaining: <int>` on each request
- On limit: HTTP 429 + header `Retry-After: <seconds>`

---

## Error Format (RFC 7807)

### Standard Error

```json
{
  "type": "about:blank",
  "title": "Error Title",
  "status": 422,
  "detail": "human-readable detail"
}
```

### Validation Error (422)

```json
{
  "type": "about:blank",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation",
  "errors": [
    { "field": "email", "message": "email is required" }
  ]
}
```

### Gender Mismatch (422, special)

```json
{
  "error_code": "GENDER_MISMATCH",
  "message": "gender mismatch for selected match type"
}
```

---

## Player Lifecycle

```
Register → calibration (trust=80, elo=1000)
    ↓
Onboarding questionnaire → elo adjusted (800–1400), onboarding_completed=true
    ↓
Play 3 validated matches → status transitions from "calibration" to "active"
    ↓
Active player (appears in rankings, full features)
```

### Player Statuses

| Status | Meaning |
|--------|---------|
| `calibration` | New player, < 3 validated matches |
| `active` | Fully active, appears in rankings |
| `banned_soft` | Temporary ban, hidden from other players |
| `banned_hard` | Permanent ban, hidden from other players |

### Trust Score

- Integer 0–100, starts at 80 on registration
- `>= 90` → label "Excelente"
- `>= 70` → label "Bueno"
- `< 70` → label "Bajo"
- Players with trust < 70 are **hidden** from flare/radar listings to players with trust >= 70

---

## Match Lifecycle

```
POST /matches → pending_result
    ↓
POST /matches/{id}/result (by any captain) → awaiting_confirmation
    ↓
  ├─ POST /matches/{id}/confirm (by OPPOSITE captain) → sealed ✓
  │     → ELO calculated, calibration check, feed events
  │
  ├─ POST /matches/{id}/dispute (by opposite captain) → disputed
  │     → Admin resolves via POST /admin/disputes/{id}/resolve → sealed ✓
  │
  └─ 6 hours expire (auto-sealer background job) → sealed ✓
        → Auto-sealed with submitted result

POST /matches/{id}/cancel → cancelled (only from pending_result)
```

### Match Statuses

| Status | Meaning |
|--------|---------|
| `pending_result` | Created, waiting for a captain to submit result |
| `awaiting_confirmation` | Result submitted, waiting for opposite captain |
| `sealed` | Confirmed or auto-sealed. ELO applied. Final state |
| `disputed` | Captain disputed the result. Needs admin resolution |
| `cancelled` | Cancelled (only possible from `pending_result`) |

### Captain Logic

- **Captain A** = first UUID in `team_a`
- **Captain B** = first UUID in `team_b`
- **Any captain** can submit the result
- The **opposite captain** (the one who did NOT submit) must confirm or dispute
- If submitter is Captain A → confirmer is Captain B, and vice versa

---

## Endpoints by Domain

### System

#### GET /
Public. Returns service info.
```json
{ "service": "blendpadel-api", "version": "0.1.0" }
```

#### GET /health
Public. Returns health + DB status.
```json
{ "status": "ok", "db": "connected", "version": "0.1.0" }
```
Returns 503 if DB is unreachable (`"db": "disconnected"`).

#### GET /uploads/*
Public. Serves uploaded files (avatars). Example: `GET /uploads/avatars/abc123.jpg`

---

### Auth

#### POST /auth/register
**Public** (rate limited)

Request:
```json
{
  "email": "string (required)",
  "password": "string (required, min 8 chars, 1 uppercase, 1 digit)",
  "name": "string (required)",
  "last_name": "string (optional)"
}
```

Response 201:
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "last_name": "string",
  "role": "player",
  "status": "calibration",
  "trust_score": 80
}
```

Errors: 400 bad JSON, 409 email taken, 422 weak password, 429 rate limit

---

#### POST /auth/login
**Public** (rate limited)

Request:
```json
{
  "email": "string",
  "password": "string"
}
```

Response 200:
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "opaque-base64url-string",
  "expires_in": 3600
}
```

Errors: 400, 401 invalid credentials, 429 rate limit

---

#### POST /auth/refresh
**Public**

Request:
```json
{ "refresh_token": "string" }
```

Response 200: same as login response

Errors: 400, 401 expired/reused token

---

#### POST /auth/logout
**Authenticated**

Request:
```json
{ "refresh_token": "string" }
```

Response 200:
```json
{ "message": "logged out successfully" }
```

---

#### PUT /auth/password
**Authenticated**

Request:
```json
{
  "current_password": "string",
  "new_password": "string"
}
```

Response 200:
```json
{ "message": "password changed successfully" }
```

Side effect: revokes ALL refresh tokens for the user.

---

### Player

#### POST /onboarding/questionnaire
**Authenticated**

Request:
```json
{
  "frequency": "nunca | rara_vez | 1_2_sem | 3_mas_sem",
  "tournaments": "nunca | amateur | federado",
  "paddle_type": "iniciacion | intermedia | avanzada",
  "self_assessment": "principiante | intermedio | avanzado | competitivo",
  "years_playing": 0,
  "gender": "male | female | other"
}
```
All fields required.

Response 200:
```json
{
  "elo": 1000,
  "onboarding_completed": true,
  "calibration_matches_remaining": 5
}
```

ELO calculation from base 1000, clamped to [800, 1400]:
- frequency: nunca/rara_vez → -100, 1_2_sem → 0, 3_mas_sem → +100
- tournaments: nunca → -50, amateur → +50, federado → +150
- paddle_type: iniciacion → -100, intermedia → 0, avanzada → +100
- self_assessment: principiante → -100, intermedio → 0, avanzado → +100, competitivo → +150
- Inconsistency cap: if self_assessment >= avanzado AND frequency <= 1_2_sem → cap total delta to +50

Errors: 400, 409 already completed, 422 invalid enum

---

#### GET /players/me
**Authenticated**

Response 200:
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "last_name": "string",
  "role": "string",
  "status": "calibration | active | banned_soft | banned_hard",
  "elo": 1000,
  "gender": "male | female | other",
  "avatar_url": "string (omitempty)",
  "onboarding_completed": true,
  "validated_match_count": 0,
  "elo_frozen": false,
  "trust_score": 100,
  "calibration_matches_remaining": 5,
  "created_at": "RFC3339"
}
```

---

#### PUT /players/me
**Authenticated**

Request:
```json
{
  "name": "string (optional)",
  "last_name": "string (optional)",
  "latitude": -34.5,
  "longitude": -68.5
}
```

Coordinates validated to Mendoza bounds: lat [-35.5, -32.0], lng [-70.5, -67.5].

Response 200:
```json
{ "message": "profile updated successfully" }
```

---

#### POST /players/me/avatar
**Authenticated**

Content-Type: `multipart/form-data`
Form field: `avatar` (file)
- Max 5 MB
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`

Response 200:
```json
{ "avatar_url": "/uploads/avatars/uuid_timestamp.jpg" }
```

Errors: 400, 413 file too large, 415 unsupported MIME

---

#### GET /players/{id}
**Authenticated**

Returns different shapes depending on caller:

**Self-view** (caller == {id}):
```json
{
  "id": "uuid",
  "name": "string",
  "elo": 1000,
  "gender": "string",
  "trust_label": "Excelente | Bueno | Bajo",
  "validated_match_count": 0,
  "region_id": "uuid",
  "trust_score": 100,
  "preferences": {
    "radar_radius_km": 10,
    "elo_min_delta": -200,
    "elo_max_delta": 200
  },
  "status": "string",
  "email": "string"
}
```

**Other-view**:
```json
{
  "id": "uuid",
  "name": "string",
  "elo": 1000,
  "gender": "string",
  "trust_label": "Excelente | Bueno | Bajo",
  "validated_match_count": 0,
  "region_id": "uuid"
}
```

Banned players appear as 404 to other users.

---

#### PUT /players/me/preferences
**Authenticated**

Request:
```json
{
  "radar_radius_km": 10,
  "elo_min_delta": -200,
  "elo_max_delta": 200
}
```

Validation: radar_radius_km [1–50], elo_min_delta [-500, 0], elo_max_delta [0, 500].

Response 200: same shape as request.

---

#### GET /players/search
**Authenticated**

Query params:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `q` | string | required | Search term. Empty → `[]` |
| `exclude_ids` | string | optional | Comma-separated UUIDs |
| `match_type` | string | optional | `male \| female \| mixed` → filters by gender |
| `limit` | int32 | 20 | Max 50 |

Response 200:
```json
[
  {
    "id": "uuid",
    "name": "string",
    "elo": 1000,
    "avatar_url": "string (omitempty)",
    "gender": "string"
  }
]
```

---

#### GET /players/me/elo-history
**Authenticated**

Query params:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `cursor` | int64 | optional | Unix nanoseconds of last entry |
| `limit` | int32 | 20 | Max 50 |

Response 200:
```json
{
  "entries": [
    {
      "id": "uuid",
      "match_id": "uuid",
      "elo_before": 980,
      "elo_after": 1000,
      "delta": 20,
      "opponent_name": "string",
      "opponent_id": "uuid",
      "created_at": "RFC3339"
    }
  ],
  "next_cursor": 1714000000000000000
}
```

---

#### GET /players/me/best-partner
**Authenticated**

Response 200:
```json
{
  "best_partner": {
    "partner_id": "uuid",
    "partner_name": "string",
    "partner_elo": 1000,
    "total_matches": 15,
    "wins": 10,
    "win_rate_pct": 66
  }
}
```

Returns `{"best_partner": null}` if no matches played with a partner.

---

### Match

#### POST /matches
**Authenticated**

Request:
```json
{
  "team_a": ["uuid", "uuid"],
  "team_b": ["uuid", "uuid"],
  "scheduled_at": "RFC3339",
  "latitude": -34.5,
  "longitude": -68.5,
  "match_type": "male | female | mixed",
  "venue_id": "uuid (optional)"
}
```

- Caller must be in team_a or team_b
- Players must be active (not banned)
- match_type must match team gender composition
- If venue_id provided, lat/lng are fetched from the venue

Response 201 (`MatchResponse`):
```json
{
  "id": "uuid",
  "status": "pending_result",
  "scheduled_at": "RFC3339",
  "captain_a_id": "uuid",
  "captain_b_id": "uuid",
  "avg_elo": 1000,
  "match_type": "male | female | mixed",
  "venue_id": "uuid (omitempty)",
  "sealed_by": "string (omitempty)",
  "team_a": ["uuid", "uuid"],
  "team_b": ["uuid", "uuid"],
  "winner_team": "A | B (omitempty)",
  "total_games_a": 0,
  "total_games_b": 0,
  "game_diff": 0,
  "sets": [],
  "created_at": "RFC3339"
}
```

Errors: 400 invalid type, 403 not participant/banned, 422 gender mismatch/invalid teams

---

#### GET /matches/{id}
**Authenticated**

Response 200: `MatchResponse` (same schema as POST response)

---

#### POST /matches/{id}/result
**Authenticated** (any captain)

Request:
```json
{
  "sets": [
    { "team_a_games": 6, "team_b_games": 3 },
    { "team_a_games": 6, "team_b_games": 4 }
  ]
}
```

Validation: 2–3 sets, each 0–7 games, must produce a clear winner.

Response 200:
```json
{ "status": "awaiting_confirmation" }
```

Side effect: sends notification to opposite captain with `confirmer_id`.

---

#### POST /matches/{id}/confirm
**Authenticated** (opposite captain only)

No request body.

Response 200:
```json
{ "status": "sealed" }
```

Confirmation window: 6 hours from result submission.

Errors: 409 `ErrWindowClosed` (6h expired)

---

#### POST /matches/{id}/dispute
**Authenticated** (opposite captain only)

Request:
```json
{ "reason": "string (required)" }
```

Response 200:
```json
{ "status": "disputed" }
```

---

#### POST /matches/{id}/cancel
**Authenticated**

No request body. Only from `pending_result` status.

Response 200:
```json
{ "status": "cancelled" }
```

---

#### GET /players/{playerID}/matches/active
**Authenticated**

Response 200: array of `MatchResponse`

---

#### GET /players/{playerID}/matches
**Authenticated**

Query params:
| Param | Type | Default |
|-------|------|---------|
| `limit` | int | 10 |
| `page` | int | 1 |

Response 200: array of `MatchResponse` (match history)

---

#### POST /matches/{id}/report
**Authenticated** (must be match participant)

Request:
```json
{
  "reported_id": "uuid",
  "reason": "string (max 500 chars)"
}
```

Response 201:
```json
{
  "id": "uuid",
  "reporter_id": "uuid",
  "reported_id": "uuid",
  "match_id": "uuid",
  "reason": "string",
  "status": "pending",
  "created_at": "RFC3339"
}
```

Errors: 403 not participant, 409 already reported, 422 match not completed

---

#### GET /matches/projection
**Authenticated**

Query params:
| Param | Type | Required |
|-------|------|----------|
| `opponent_id` | UUID | yes |
| `result` | string | yes (`win \| lose \| draw`) |

Response 200:
```json
{
  "current_elo": 1000,
  "projected_elo": 1020,
  "delta": 20,
  "opponent_elo": 980,
  "expected_score": 0.53
}
```

---

### Matchmaking (Flares)

#### POST /matchmaking/flares
**Authenticated** (requires completed onboarding)

Request:
```json
{
  "lat": -33.184,
  "lng": -68.466,
  "scheduled_at": "RFC3339 (must be future)",
  "elo_min": 800,
  "elo_max": 3000,
  "min_players": 4,
  "max_players": 4,
  "match_type": "male | female | mixed",
  "venue_id": "uuid (optional)"
}
```

Defaults: elo_min=0, elo_max=3000, min_players=4, max_players=4, match_type="male".

Validation:
- lat [-90, 90], lng [-180, 180]
- min_players must be 4 (padel is 2v2)
- max_players must be >= min_players and <= 4
- elo_max must be > elo_min
- scheduled_at must be in the future
- Only one active flare per player

Creator is auto-added as respondent (respondent_count starts at 1).

Response 201 (`FlareResponse`):
```json
{
  "id": "uuid",
  "player_id": "uuid",
  "creator_name": "string",
  "lat": -33.184,
  "lng": -68.466,
  "distance_meters": 0.0,
  "scheduled_at": "RFC3339",
  "elo_min": 800,
  "elo_max": 3000,
  "min_players": 4,
  "max_players": 4,
  "match_type": "male",
  "venue_id": "uuid (omitempty)",
  "respondent_count": 1,
  "status": "active",
  "expires_at": "RFC3339",
  "match_id": "uuid (omitempty)",
  "created_at": "RFC3339"
}
```

Errors: 409 already has active flare, 422 onboarding required

---

#### GET /matchmaking/flares/mine
**Authenticated**

Response 200: `FlareResponse` or `null`

---

#### GET /matchmaking/flares
**Authenticated**

Query params:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `lat` | float64 | **required** | |
| `lng` | float64 | **required** | |
| `radius_km` | float64 | player preference or 10 | |
| `page_size` | int32 | 20 | Max 50 |
| `cursor` | string | optional | Base64 pagination cursor |
| `match_type` | string | optional | `male \| female \| mixed` |

Filtering:
- Only flares within `radius_km` of (lat, lng)
- Only flares where viewer's ELO is within [elo_min, elo_max]
- Only flares from creators with trust_score >= 70
- Only `active` flares not yet expired

Response 200:
```json
{
  "items": [ FlareResponse, ... ],
  "next_cursor": "base64string (omitempty)"
}
```

Cursor format (base64 JSON): `{"ca":"RFC3339","id":"uuid"}`

---

#### POST /matchmaking/flares/{id}/respond
**Authenticated**

No request body.

When respondent_count reaches min_players (4), a match is **auto-created**:
- Team split: first half → team_a, second half → team_b
- Flare status changes to `"matched"`
- `match_id` is populated in the response

Response 200: `FlareResponse` (with updated respondent_count and possibly match_id)

---

#### DELETE /matchmaking/flares/{id}
**Authenticated** (must be flare owner)

Response 204: no content

---

### Venue

#### GET /venues
**Authenticated**

Query params:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `lat` | float64 | **required** | |
| `lng` | float64 | **required** | |
| `radius_km` | float64 | 10 | |
| `limit` | int32 | 20 | Max 100 |
| `offset` | int32 | 0 | |

Response 200:
```json
{
  "venues": [
    {
      "id": "uuid",
      "name": "Go Padel Rivadavia",
      "address": "Godoy Cruz 184, Rivadavia, Mendoza",
      "lat": -33.184,
      "lng": -68.466,
      "court_count": 2,
      "phone": "string (omitempty)",
      "hours": { "JSON blob (omitempty)" },
      "region_id": "uuid (omitempty)",
      "added_by": "uuid",
      "verified": true,
      "distance_meters": 1234.5,
      "created_at": "RFC3339"
    }
  ]
}
```

Venues ordered by distance (nearest first).

---

#### GET /venues/{id}
**Authenticated**

Response 200: single `VenueResponse` (same shape as list item)

---

#### POST /venues
**Authenticated**

Request:
```json
{
  "name": "string (required)",
  "address": "string (required)",
  "lat": -33.184,
  "lng": -68.466,
  "court_count": 2,
  "phone": "string (optional)",
  "hours": { "JSON (optional)" },
  "region_id": "uuid (optional)"
}
```

Response 201: `VenueResponse`

---

#### PUT /venues/{id}
**Authenticated** (venue creator or admin/moderator)

Request:
```json
{
  "name": "string (optional)",
  "address": "string (optional)",
  "court_count": 4,
  "phone": "string (optional)",
  "hours": { "JSON (optional)" },
  "verified": true
}
```

Response 200: `VenueResponse`

---

### Leaderboard / Rankings

#### GET /regions
**PUBLIC** (no auth required)

Response 200:
```json
{
  "regions": [
    { "id": "uuid", "name": "Gran Mendoza" },
    { "id": "uuid", "name": "Zona Este" },
    { "id": "uuid", "name": "Valle de Uco" },
    { "id": "uuid", "name": "Sur" }
  ]
}
```

---

#### GET /rankings
**Authenticated**

Query params:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `region_id` | UUID | JWT claim | Required if no JWT claim |
| `gender` | string | optional | `male \| female \| other` |
| `limit` | int32 | 50 | Max 100 |
| `offset` | int32 | 0 | |

Response 200:
```json
{
  "region_id": "uuid",
  "region_name": "Gran Mendoza",
  "entries": [
    {
      "rank": 1,
      "player_id": "uuid",
      "name": "string",
      "elo": 1200,
      "validated_match_count": 42
    }
  ],
  "total": 100
}
```

---

### Radar

#### GET /radar/matches
**Authenticated**

Query params:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `lat` | float64 | **required** | |
| `lng` | float64 | **required** | |
| `radius_km` | float64 | player preference or 10 | Max 50 |
| `elo_min` | int32 | player ELO - delta or 800 | |
| `elo_max` | int32 | player ELO + delta or 1200 | |
| `cursor` | string | optional | Base64url pagination cursor |
| `page_size` | int32 | 20 | Max 50 |

Response 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "captain_id": "uuid",
      "captain_name": "string",
      "lat": -33.184,
      "lng": -68.466,
      "distance_meters": 1500.0,
      "avg_elo": 1000,
      "scheduled_at": "RFC3339",
      "joined_count": 2
    }
  ],
  "next_cursor": "base64url (omitempty)"
}
```

Cursor format (base64url JSON): `{"sa":"RFC3339","id":"uuid"}`

---

#### GET /radar/alerts
**Authenticated**

Query params:
| Param | Type | Default |
|-------|------|---------|
| `lat` | float64 | **required** |
| `lng` | float64 | **required** |
| `radius_km` | float64 | player preference or 5 |

Response 200:
```json
{
  "items": [ RadarMatch, ... ]
}
```

Same `RadarMatch` schema as /radar/matches items.

---

### Partnership

#### POST /partnerships
**Authenticated**

Request:
```json
{ "partner_id": "uuid" }
```

Response 201:
```json
{
  "id": "uuid",
  "requester_id": "uuid",
  "partner_id": "uuid",
  "status": "pending",
  "partner_name": "string (omitempty)",
  "partner_elo": 1000,
  "created_at": "RFC3339"
}
```

Max 5 active partnerships per player.

Errors: 400 self-partnership, 409 already exists/max reached

---

#### PUT /partnerships/{id}/accept
**Authenticated** (must be target partner)

No body. Response 200: `PartnershipResponse` with status `"accepted"`

---

#### PUT /partnerships/{id}/reject
**Authenticated** (must be target partner)

No body. Response 200: `PartnershipResponse` with status `"rejected"`

---

#### DELETE /partnerships/{id}
**Authenticated** (must be a member)

Response 200: `PartnershipResponse` with status `"dissolved"`

---

#### GET /partnerships/me
**Authenticated**

Response 200:
```json
{
  "partnerships": [ PartnershipResponse, ... ]
}
```

---

#### GET /partnerships/requests/sent
**Authenticated**

Response 200:
```json
{
  "requests": [
    {
      "id": "uuid",
      "status": "pending",
      "requested_user": {
        "id": "uuid",
        "full_name": "string"
      },
      "created_at": "RFC3339"
    }
  ]
}
```

---

#### GET /partnerships/{id}/stats
**Authenticated** (must be a member)

Response 200:
```json
{
  "total_matches": 30,
  "wins": 20,
  "win_rate": 0.667,
  "current_streak": 3
}
```

---

### Feed

#### GET /feed
**Authenticated**

Query params:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `region_id` | UUID | JWT claim | Required if no JWT claim |
| `limit` | int32 | 20 | Max 50 |
| `offset` | int32 | 0 | |

Response 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "player_id": "uuid",
      "player_name": "string",
      "event_type": "win_streak | match_milestone",
      "content": { "JSON blob" },
      "region_id": "uuid (omitempty)",
      "created_at": "RFC3339"
    }
  ]
}
```

Milestone thresholds: 10, 25, 50, 100 validated matches.

---

### Notification

#### POST /players/me/device-token
**Authenticated**

Request:
```json
{
  "token": "string (FCM/APNS token, required)",
  "platform": "ios | android | web (required)"
}
```

Response 200:
```json
{ "status": "registered" }
```

Upserts: existing token for same player is updated.

---

#### DELETE /players/me/device-token
**Authenticated**

Request:
```json
{ "token": "string (required)" }
```

Response 204: no content

---

### Admin

All endpoints require **superadmin** role unless noted.

#### GET /admin/kpis
Response 200:
```json
{
  "total_players": 100,
  "active_players": 95,
  "banned_players": 5,
  "total_matches": 200,
  "completed_matches": 180,
  "pending_disputes": 3,
  "avg_elo": 1024.5,
  "total_moderators": 4
}
```

---

#### GET /admin/audit-log
Query params: `limit` (default 50), `offset` (default 0), `admin_id` (optional UUID filter)

Response 200:
```json
{
  "entries": [
    {
      "id": "uuid",
      "admin_id": "uuid",
      "action": "string",
      "target_user_id": "uuid (omitempty)",
      "details": "raw JSON (omitempty)",
      "created_at": "RFC3339"
    }
  ],
  "total": 42
}
```

---

#### GET /admin/moderators
Response 200: array of `ModeratorResponse`
```json
[
  {
    "id": "uuid",
    "email": "string",
    "name": "string",
    "last_name": "string (omitempty)",
    "role": "moderator",
    "status": "string",
    "region_id": "uuid (omitempty)",
    "created_at": "RFC3339"
  }
]
```

---

#### POST /admin/moderators
Request: provide `user_id` to promote existing user, OR `email`+`password`+`name` to create new.
```json
{
  "user_id": "uuid (optional, to promote existing)",
  "email": "string",
  "password": "string",
  "name": "string",
  "last_name": "string (optional)",
  "region_id": "uuid (required)"
}
```

Response 201: `ModeratorResponse`

---

#### PUT /admin/moderators/{id}
Same request body as POST. Response 200: `ModeratorResponse`

---

#### DELETE /admin/moderators/{id}
Response 204: no content

---

#### POST /admin/players/{id}/ban
Request:
```json
{
  "type": "soft | hard",
  "reason": "string (optional)"
}
```

Response 200: `{ "status": "banned" }`

---

#### POST /admin/players/{id}/unban
No body. Response 200: `{ "status": "active" }`

---

#### POST /admin/players/{id}/elo-adjust
Request:
```json
{
  "delta": 25,
  "reason": "string (optional)"
}
```

Response 200: `{ "status": "adjusted" }`

---

#### POST /admin/regions
**Superadmin only**

Request:
```json
{
  "name": "string (required)",
  "boundary_wkt": "POLYGON((...)) (optional)"
}
```

Response 201: `{ "id": "uuid", "name": "string" }`

---

#### GET /admin/reports
**Moderator or superadmin** (moderators require matching `region_id`)

Query params: `region_id`, `status` (pending|reviewed|dismissed), `limit` (default 20, max 100), `offset`

Response 200:
```json
{
  "reports": [ ReportResponse, ... ],
  "total": 42
}
```

---

#### GET /admin/disputes
**Moderator or superadmin**

Response 200: array of `DisputeResponse`
```json
[
  {
    "id": "uuid",
    "match_id": "uuid",
    "raised_by": "uuid",
    "reason": "string",
    "status": "pending | resolved",
    "resolved_by": "uuid (omitempty)",
    "penalized_player_id": "uuid (omitempty)",
    "resolved_at": "RFC3339 (omitempty)",
    "created_at": "RFC3339"
  }
]
```

---

#### POST /admin/disputes/{id}/resolve
**Moderator or superadmin**

Request:
```json
{
  "action": "seal | dismiss (default: seal)",
  "result_override": { "sets": [...] },
  "penalize_player_id": "uuid (optional)"
}
```

Response 200: `{ "status": "resolved" }`

---

## Route Summary Table

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/` | Public | Service info |
| GET | `/health` | Public | Health check |
| GET | `/uploads/*` | Public | Static files |
| POST | `/auth/register` | Public + rate limit | |
| POST | `/auth/login` | Public + rate limit | |
| POST | `/auth/refresh` | Public | |
| POST | `/auth/logout` | Authenticated | |
| PUT | `/auth/password` | Authenticated | |
| POST | `/onboarding/questionnaire` | Authenticated | |
| GET | `/players/me` | Authenticated | |
| PUT | `/players/me` | Authenticated | |
| POST | `/players/me/avatar` | Authenticated | multipart/form-data |
| PUT | `/players/me/preferences` | Authenticated | |
| GET | `/players/search` | Authenticated | |
| GET | `/players/{id}` | Authenticated | Different shape for self vs other |
| GET | `/players/me/elo-history` | Authenticated | Cursor-based pagination |
| GET | `/players/me/best-partner` | Authenticated | |
| GET | `/players/{playerID}/matches` | Authenticated | Page-based pagination |
| GET | `/players/{playerID}/matches/active` | Authenticated | |
| POST | `/players/me/device-token` | Authenticated | |
| DELETE | `/players/me/device-token` | Authenticated | |
| POST | `/matches` | Authenticated | |
| GET | `/matches/{id}` | Authenticated | |
| POST | `/matches/{id}/result` | Authenticated | Captain only |
| POST | `/matches/{id}/confirm` | Authenticated | Opposite captain |
| POST | `/matches/{id}/dispute` | Authenticated | Opposite captain |
| POST | `/matches/{id}/cancel` | Authenticated | Only from pending_result |
| POST | `/matches/{id}/report` | Authenticated | Match participant |
| GET | `/matches/projection` | Authenticated | ELO preview |
| POST | `/matchmaking/flares` | Authenticated | Requires onboarding |
| GET | `/matchmaking/flares` | Authenticated | Cursor-based, geo-filtered |
| GET | `/matchmaking/flares/mine` | Authenticated | |
| POST | `/matchmaking/flares/{id}/respond` | Authenticated | Auto-creates match at 4 |
| DELETE | `/matchmaking/flares/{id}` | Authenticated | Owner only |
| GET | `/venues` | Authenticated | Geo-search |
| GET | `/venues/{id}` | Authenticated | |
| POST | `/venues` | Authenticated | |
| PUT | `/venues/{id}` | Authenticated | Creator or admin |
| GET | `/regions` | **Public** | |
| GET | `/rankings` | Authenticated | |
| GET | `/radar/matches` | Authenticated | Cursor-based, geo-filtered |
| GET | `/radar/alerts` | Authenticated | |
| POST | `/partnerships` | Authenticated | Max 5 active |
| PUT | `/partnerships/{id}/accept` | Authenticated | Target partner |
| PUT | `/partnerships/{id}/reject` | Authenticated | Target partner |
| DELETE | `/partnerships/{id}` | Authenticated | Either member |
| GET | `/partnerships/me` | Authenticated | |
| GET | `/partnerships/requests/sent` | Authenticated | |
| GET | `/partnerships/{id}/stats` | Authenticated | |
| GET | `/feed` | Authenticated | |
| GET | `/admin/kpis` | Superadmin | |
| GET | `/admin/audit-log` | Superadmin | |
| GET | `/admin/moderators` | Superadmin | |
| POST | `/admin/moderators` | Superadmin | |
| PUT | `/admin/moderators/{id}` | Superadmin | |
| DELETE | `/admin/moderators/{id}` | Superadmin | |
| POST | `/admin/players/{id}/ban` | Superadmin | |
| POST | `/admin/players/{id}/unban` | Superadmin | |
| POST | `/admin/players/{id}/elo-adjust` | Superadmin | |
| POST | `/admin/regions` | Superadmin | |
| GET | `/admin/reports` | Moderator+ | Region-scoped |
| GET | `/admin/disputes` | Moderator+ | |
| POST | `/admin/disputes/{id}/resolve` | Moderator+ | |

**Total: 56 endpoints**

---

## Background Jobs

| Job | Interval | What it does |
|-----|----------|-------------|
| AutoSealer | 5 min | Seals matches in `awaiting_confirmation` if 6h window expired |
| FlareExpirer | 5 min | Expires flares past their `scheduled_at` |
| ReminderJob | 5 min | Sends push notification 4h before scheduled matches |

---

## Business Rules Cheat Sheet

| Rule | Detail |
|------|--------|
| Padel teams | Always 2v2 (4 players total) |
| ELO range | Stored as integer. Initial 1000, onboarding adjusts to [800, 1400] |
| Calibration | First 3 validated matches. Status "calibration" → "active" |
| ELO frozen | Frozen players still count match participation but ELO doesn't change |
| Trust visibility | Players with trust < 70 are hidden from flare/radar listings |
| Confirmation window | 6 hours. After that, auto-sealer seals with submitted result |
| Max partnerships | 5 active per player |
| Flare auto-match | When 4 respondents join a flare, a match is auto-created |
| One active flare | Each player can only have one active flare at a time |
| Creator = respondent | Flare creator is auto-added as first respondent |
| Avatar constraints | Max 5MB, JPEG/PNG/WebP only |
| Mendoza bounds | lat [-35.5, -32.0], lng [-70.5, -67.5] |
| Feed milestones | At 10, 25, 50, 100 validated matches |
| Win streak feed | Generated when a player has a notable win streak |

---

## Current Seed Data

### Regions (4 + 1 test)
- Gran Mendoza: `8c7c486f-83f4-46d7-90ea-60f29e2897a9`
- Zona Este: `7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7`
- Valle de Uco: `e455a1bc-eb2a-4d0f-a387-760a85423f71`
- Sur: `cfeb4b71-3f59-4527-87c4-27a5bec0fd2c`

### Venues (34 real padel courts in Mendoza)
- 8 in Zona Este (Rivadavia, San Martin, Junin)
- 26 in Gran Mendoza (Guaymallen, Godoy Cruz, Ciudad, Lujan de Cuyo, Chacras de Coria, Maipu)
- All verified, with PostGIS coordinates and court counts

### Test Users
| Email | Password | Role |
|-------|----------|------|
| admin@test.com | Test1234! | superadmin |
| playera@test.com | NewPass456! | player (trust=35, low) |
| playerb@test.com | TestPass123! | player (trust=90) |
| playerc@test.com | TestPass123! | player |
| playerd@test.com | TestPass123! | player |
