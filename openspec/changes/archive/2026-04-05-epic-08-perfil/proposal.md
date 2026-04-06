# EPIC 08 — Perfil (Tab 4): Proposal

## Intent

The profile is the "DNI Padelero" — the single source of truth about who a player is on the platform. It combines ELO, trust, match history, and personal preferences into one screen. It's the first thing an opponent looks at before accepting a match request.

Tab 4 serves two distinct audiences: the player viewing their own profile (full data, exact numbers, editable preferences) and another player viewing a public profile (curated trust display, no sensitive data, 404 on banned players). This distinction is non-trivial — trust scores should not be surfaced as raw numbers publicly, and banned players should simply not exist from the public's perspective.

## Problem

Without profiles:
- There's no public-facing player identity — opponents can't evaluate who they're about to play with
- Trust scores are raw numbers in the database with no human-readable interpretation
- Players have no way to configure their matching preferences (radar radius, ELO delta range)
- There's no conduct reporting mechanism — toxic players can't be flagged through the app

## Solution

Four endpoints that compose the full Profile tab experience:

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/players/{id}` | JWT (any) | Public player profile |
| PUT | `/players/me/preferences` | JWT (self) | Update matching preferences |
| POST | `/matches/{id}/report` | JWT (participant) | Report conduct in a match |
| GET | `/admin/reports` | JWT + moderator | List conduct reports filtered by region |

### Trust Score Public Display

Trust scores are not surfaced as raw numbers on public profiles. Instead they resolve to a category:

| Score Range | Label |
|-------------|-------|
| ≥ 90 | "Excelente" |
| 70 – 89 | "Bueno" |
| < 70 | "Bajo" |

The exact numeric score is only visible when a player views their own profile. This prevents players from gaming the system by targeting opponents with a specific score.

### Banned Players

Soft-banned and hard-banned players return HTTP 404 on the public profile endpoint. They do not exist from the public perspective. This is intentional — returning 403 would confirm the player exists but is restricted, which leaks information.

### Preferences JSONB

The `preferences` JSONB column (added to `users` in this EPIC's migration) stores per-player matching configuration:

```json
{
  "radar_radius_km": 10,
  "elo_min_delta": -200,
  "elo_max_delta": 200
}
```

Defaults are applied on INSERT and validated on PUT (radius 1–50 km, delta range ±500 max). These preferences are consumed by the Radar service (EPIC 05) for filtering match suggestions.

### Conduct Reports

The `conduct_reports` table is created in migration `000008_profile`. Reports are restricted to participants of the reported match — the handler must verify the reporting player appears in `match_players` for the given match ID. Reports go through a moderation queue visible to admins filtered by their region.

## Scope

### In scope
- Public profile endpoint (trust label, no ban exposure, no raw trust number)
- Self-profile (full data including exact trust score)
- Preferences CRUD with validation
- Conduct report creation (participant-only)
- Admin report list (region-filtered, paginated)
- Migration 000008 adding `preferences` column and `conduct_reports` table
- Extending the existing `internal/player/` package (no new domain)

### Out of scope
- Report resolution workflow (accept/dismiss by moderator) — separate EPIC
- Player avatars / profile photos
- Public match history on profile page
- Block/mute player functionality

## Technical Approach

Extending the existing `internal/player/` package rather than creating a new domain keeps cohesion high — the player package already owns the `users` table representation. Adding handlers, service methods, and repository methods stays within the established pattern.

The ban check in `GetPublicProfile` happens at the service layer before returning data: if `status IN ('banned_soft', 'banned_hard')`, return a domain error that maps to 404 at the handler layer.

## Dependencies

- EPIC 02 (player package, auth middleware, users table)
- EPIC 03 (trust_score on users table)
- EPIC 05 (preferences JSONB anticipated — column added here)
- Match service and `match_players` table (EPIC 04)

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Trust label gaming (score just above threshold) | Low | Thresholds are simple and hard to manipulate precisely |
| Report spam / abuse | Medium | Restrict to match participants; rate limiting deferred to auth EPIC |
| JSONB preferences drift over time | Low | Single source of defaults in service layer; migration adds NOT NULL with default |

## Stories

- **US-040**: As a player, I want to see another player's public profile so I can evaluate them before a match
- **US-041**: As a player, I want to configure my matching preferences (radius, ELO range) so I get better match suggestions
- **US-042**: As a player, I want to report unsportsmanlike conduct after a match so the platform stays clean
