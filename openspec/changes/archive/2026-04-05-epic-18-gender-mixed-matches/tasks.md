## 1. Database Migration

- [x] 1.1 Create migration `000011_gender_match_type.up.sql`: ADD `gender VARCHAR(10) NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female', 'other'))` to `users`
- [x] 1.2 Same migration: ADD `match_type VARCHAR(10) NOT NULL DEFAULT 'male' CHECK (match_type IN ('male', 'female', 'mixed'))` to `matches`
- [x] 1.3 Same migration: ADD `match_type VARCHAR(10) NOT NULL DEFAULT 'male' CHECK (match_type IN ('male', 'female', 'mixed'))` to `matchmaking_flares`
- [x] 1.4 Create migration `000011_gender_match_type.down.sql` with DROP COLUMN statements

## 2. sqlc Queries

- [x] 2.1 Update `queries/players.sql`: Add `gender` to SELECT list in `GetPlayerProfile`
- [x] 2.2 Update `queries/profiles.sql`: Add `gender` to SELECT list in `GetPublicProfile` and `GetOwnProfile`
- [x] 2.3 Add new query `GetRankingByRegionAndGender` in `queries/rankings.sql` with `WHERE gender = $X` filter
- [x] 2.4 Add new query `GetPlayerRankByGender` in `queries/rankings.sql` with gender filter
- [x] 2.5 Update `queries/matches.sql`: Add `match_type` to `CreateMatch` INSERT and all SELECT queries
- [x] 2.6 Update `queries/flares.sql`: Add `match_type` to `CreateFlare` INSERT, add optional filter to `GetActiveFlares`
- [x] 2.7 Run `sqlc generate` and verify generated Go code compiles

## 3. Player Domain (Gender)

- [x] 3.1 Update `player/model.go`: Add `Gender string` to `PlayerProfile`, `ProfileResponse`, `OnboardingRequest`, `PublicProfileResponse`, `OwnProfileResponse`
- [x] 3.2 Update `player/service.go`: Validate gender in onboarding (must be `male`, `female`, or `other`), save to users table via query
- [x] 3.3 Update `player/handler.go`: Include gender in profile response mapping

## 4. Match Domain (Match Type + Validation)

- [x] 4.1 Update `match/model.go`: Add `MatchType string` to `CreateMatchRequest`, `MatchResponse`, `MatchFull`, `MatchHistoryItem`
- [x] 4.2 Implement team composition validation in `match/service.go`: Fetch player genders, validate against match_type rules (male=all male, female=all female, mixed=at least 1 male+1 female per team, other counts as either in mixed)
- [x] 4.3 Update match creation handler to pass `match_type` to query and return it in responses
- [x] 4.4 Write tests for team composition validation: valid male, valid female, valid mixed, invalid male with female, invalid mixed with single-gender team, other gender handling

## 5. Ranking Domain (Gender Filter)

- [x] 5.1 Update `ranking/handler.go`: Parse optional `gender` query param, validate allowed values
- [x] 5.2 Update `ranking/service.go`: Route to `GetRankingByRegionAndGender` when gender param present, otherwise use existing `GetRankingByRegion`
- [x] 5.3 Update `GetPlayerRank` usage to use gender-filtered version when appropriate

## 6. Matchmaking Domain (Flare Match Type)

- [x] 6.1 Update `matchmaking/model.go`: Add `MatchType string` to `CreateFlareRequest`, `FlareResponse`, `GetFlaresParams`
- [x] 6.2 Update `matchmaking/handler.go`: Parse `match_type` from create request and list query params
- [x] 6.3 Update flare creation and listing to pass match_type through to queries
- [x] 6.4 Handle the `GetActiveFlares` filter: create a separate query `GetActiveFlaresByMatchType` or add conditional logic

## 7. Integration Testing

- [x] 7.1 Test full flow: register → onboard with gender → create match with match_type → validate composition → seal → check ranking with gender filter
- [x] 7.2 Test edge cases: missing gender on onboarding (400), invalid match_type (400), gender filter on empty ranking
