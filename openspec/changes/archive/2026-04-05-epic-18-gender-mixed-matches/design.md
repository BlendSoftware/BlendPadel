## Context

BlendPadel MVP has a single-ELO, gender-agnostic system. The `users` table has no `gender` column, `matches` has no `match_type`, and rankings are a single leaderboard per region. The codebase uses Go + Chi + sqlc + PostgreSQL with PostGIS. There are ~12 test players in the system.

The decision has been made to use **Model C**: a single ELO pool with rankings filtered by gender via query. This avoids fragmenting the small player pool in Mendoza while still providing gender-specific leaderboards.

## Goals / Non-Goals

**Goals:**
- Add `gender` as a mandatory field for all players (required at onboarding)
- Classify matches and flares by type: `male`, `female`, `mixed`
- Validate team composition matches the declared match type
- Provide gender-filtered rankings without changing ELO calculation logic
- Filter matchmaking flares by match type
- Handle existing data gracefully (migration strategy for playerless gender)

**Non-Goals:**
- Separate ELO pools per gender (explicitly rejected — Model C chosen)
- Gender-specific K-factors or ELO adjustments
- Frontend/mobile UI changes (separate EPIC)
- Gender validation beyond the declared match type (no gender-policing of `other`)

## Decisions

### 1. Gender values: `male`, `female`, `other`

Players with `gender = 'other'` can join any match type. They are not restricted to mixed-only. They appear in the overall ranking but are excluded from gender-filtered views unless they opt into one (future consideration).

**Alternative considered**: Non-binary, prefer-not-to-say. Rejected for simplicity — `other` covers all cases for now without UI complexity.

### 2. Migration strategy for existing users

Existing users get `gender = 'male'` as DEFAULT in the migration. This is acceptable because:
- Only ~12 test players exist
- All are the dev team (all male)
- Production hasn't launched yet

If production had real users, we'd use a nullable column + forced gender selection on next login instead.

### 3. Match type validation rules

| Match Type | Team A | Team B | Players with `other` |
|------------|--------|--------|---------------------|
| `male` | All `male` | All `male` | Not allowed |
| `female` | All `female` | All `female` | Not allowed |
| `mixed` | At least 1 `male` + 1 `female` | At least 1 `male` + 1 `female` | Allowed (counts as either) |

Players with `gender = 'other'` satisfy the "at least 1" requirement for either gender in mixed matches. They cannot join single-gender matches to keep the constraint simple and unambiguous.

**Alternative considered**: Allow `other` in all match types. Rejected because it would make gender-specific matches meaningless — a "female" match with 3 `other` players defeats the purpose.

### 4. Rankings query approach

Add optional `gender` query parameter to `GET /rankings`. When absent, return all players (current behavior). When present, filter `WHERE users.gender = $gender`.

The `GetPlayerRank` query also needs the gender filter so a player's rank reflects their position within their gender's leaderboard, not the overall one.

### 5. Flare match_type filtering

`GetActiveFlares` gains an optional `match_type` filter. The flare creator sets the match type at creation. Respondents see flares matching their preferred match type (or all if no filter).

No gender-based auto-filtering (e.g., "don't show male flares to female players") — players choose what they want to see.

### 6. sqlc query strategy

Separate queries for filtered vs unfiltered rankings rather than COALESCE/dynamic WHERE tricks. sqlc works best with static SQL, and the queries are simple enough that duplication is clearer than conditional logic.

- `GetRankingByRegion` → unchanged (all genders)
- `GetRankingByRegionAndGender` → new query with `WHERE gender = $X`
- `GetPlayerRank` → unchanged
- `GetPlayerRankByGender` → new query

## Risks / Trade-offs

- **[Risk] `other` gender exclusion from single-gender matches** → Players who select `other` can only play mixed matches. This is a social design choice, not a technical one. Mitigation: monitor feedback, adjust in future if needed.
- **[Risk] Default `male` in migration** → Only safe because no real users exist yet. If this migration runs after launch with real female players, their rankings would be wrong. Mitigation: this EPIC deploys before launch.
- **[Risk] No frontend in this EPIC** → API changes ship without UI. Existing mobile app won't send `gender` on onboarding or `match_type` on match creation. Mitigation: new fields have defaults, so existing behavior is preserved until frontend is updated.
- **[Trade-off] Duplicate ranking queries** → More SQL to maintain, but cleaner than dynamic query building in sqlc.
