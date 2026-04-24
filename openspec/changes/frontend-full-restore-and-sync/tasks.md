# Tasks: Frontend Full Restore + Sync

## Status: applied (code committed, runtime verify pending)
## Depends on: proposal.md, design.md
## Commit: 3b7854c

---

## 0. Restore scaffold

- [x] 0.1 Copy `app_archive_v1/` → `frontend/`
- [x] 0.2 Strip `node_modules/`, `dist/`, scratch files (bypass.ps1, debug_overpass.js, test.js, test_overpass.js)
- [x] 0.3 Preserve package.json, vite.config.ts, tsconfig, eslint.config, public/

---

## EPIC 01 — Foundation + Auth + Onboarding

- [x] 1.1 api.ts: axios client with request interceptor (Bearer token)
- [x] 1.2 api.ts: response interceptor with 401 refresh queue
- [x] 1.3 api.ts: proactive refresh timer (25 min)
- [x] 1.4 api.ts: decoupled toast dispatch via CustomEvent
- [x] 1.5 auth-store: `login`, `register`, `logout`, `refresh`, `initialize`, `completeOnboarding`
- [x] 1.6 auth-store: always rotate refresh_token on every successful refresh (backend rotates)
- [x] 1.7 auth-store: `RegisterData.last_name` made optional
- [x] 1.8 LoginPage, RegisterPage, OnboardingPage, OnboardingResultPage, ChangePasswordScreen present
- [x] 1.9 PrivateRoute guard with auth + onboarding check
- [x] 1.10 router.tsx with public (/login, /register, /onboarding, /change-password) + protected trees
- [x] 1.11 types: User, OnboardingAnswers, OnboardingResult, AuthTokens, ApiError (RFC 7807)
- [ ] 1.12 🧪 Runtime: login with admin@test.com / Test1234! succeeds
- [ ] 1.13 🧪 Runtime: register weak password returns 422 with field errors
- [ ] 1.14 🧪 Runtime: onboarding questionnaire returns ELO in [800, 1400]

---

## EPIC 02 — Player profile + preferences + avatar

- [x] 2.1 profile-store: `updateProfile` re-fetches after PUT (backend returns `{message}`)
- [x] 2.2 profile-store: `fetchPreferences` uses `GET /players/{id}` self-view (no dedicated endpoint)
- [x] 2.3 profile-store: `fetchMatchHistory` uses page-based pagination (1-indexed)
- [x] 2.4 profile-store: `fetchEloHistory` cursor-based (`cursor` = int64 unix nanoseconds)
- [x] 2.5 types: `PlayerProfile` adds `role`, `elo_frozen`, `calibration_matches_remaining`
- [x] 2.6 types: `PublicPlayerProfile` uses `trust_label` ("Excelente|Bueno|Bajo"), not `trust_score`
- [x] 2.7 types: `EloHistoryEntry` has `opponent_id`, `opponent_name`
- [x] 2.8 EditProfilePage no longer reads latitude/longitude from GET /players/me
- [x] 2.9 PublicProfilePage reads `trust_label` directly, no recompute
- [x] 2.10 MatchHistoryList rewritten to use Match shape (status, winner_team, total_games_a/b, sets)
- [x] 2.11 AvatarUploadPage uses multipart form-data
- [ ] 2.12 🧪 Runtime: PUT /players/me with valid Mendoza coords succeeds
- [ ] 2.13 🧪 Runtime: avatar upload 5MB JPEG succeeds, 6MB returns 413
- [ ] 2.14 🧪 Runtime: ELO history cursor pagination loads next page

---

## EPIC 03 — Match lifecycle

- [x] 3.1 match-store: `createMatch` with team_a, team_b, scheduled_at, lat/lng, match_type
- [x] 3.2 match-store: `hydrateMatch` builds result from top-level `sets` array
- [x] 3.3 match-store: `submitResult` (2-3 sets, 0-7 games each)
- [x] 3.4 match-store: `confirmResult`, `disputeResult`, `cancelMatch`
- [x] 3.5 match-store: `reportMisconduct` uses `reported_id` field (not `reported_player_id`)
- [x] 3.6 match-store: UPCOMING_STATUSES without invalid 'scheduled'
- [x] 3.7 CreateMatchPage, SubmitResultPage, ConfirmDisputePage screens present
- [x] 3.8 MatchDetailPage with correct status labels
- [x] 3.9 MatchCard without 'scheduled' label
- [x] 3.10 types: MatchStatus = `pending_result|awaiting_confirmation|sealed|disputed|cancelled`
- [x] 3.11 types: match_type = `male|female|mixed`
- [ ] 3.12 🧪 Runtime: create match between 4 active players succeeds
- [ ] 3.13 🧪 Runtime: submit result → confirm by opposite captain → sealed
- [ ] 3.14 🧪 Runtime: confirm after 6h returns 409 ErrWindowClosed
- [ ] 3.15 🧪 Runtime: cancel from awaiting_confirmation returns error

---

## EPIC 04 — Matchmaking flares

- [x] 4.1 matchmaking-store: `createFlare` with `lat`/`lng` (not latitude/longitude)
- [x] 4.2 matchmaking-store: `respondToFlare` without body (endpoint accepts none)
- [x] 4.3 matchmaking-store: `nextCursor` state stored from `fetchFlares`
- [x] 4.4 matchmaking-store: `fetchMyFlare`, `deleteFlare`
- [x] 4.5 CreateFlarePage without `message` field (removed — not in API)
- [x] 4.6 FlareCard without message rendering
- [x] 4.7 MatchmakingPage filters by `player_id` only (removed dead user_id)
- [x] 4.8 RespondFlarePage location check uses `lat !== 0 && lng !== 0`
- [x] 4.9 types: FlareResponse shape (player_id, creator_name, respondent_count, match_id, expires_at)
- [x] 4.10 Flare status = `active|matched|expired`
- [ ] 4.11 🧪 Runtime: create flare with onboarding incomplete returns 422
- [ ] 4.12 🧪 Runtime: 4th respondent triggers match auto-creation
- [ ] 4.13 🧪 Runtime: cursor pagination returns next page
- [ ] 4.14 Follow-up: expose elo_min/elo_max inputs in CreateFlarePage UI
- [ ] 4.15 Follow-up: add "load more" button wired to nextCursor

---

## EPIC 05 — Radar + venues

- [x] 5.1 radar-store: `fetchMatches` with lat/lng/radius/elo_min/elo_max, stores nextCursor
- [x] 5.2 radar-store: `fetchAlerts` (same RadarMatch shape)
- [x] 5.3 types/radar: RadarMatch with captain_id, captain_name, avg_elo, joined_count, distance_meters
- [x] 5.4 RadarPage MatchCard + MatchSheet use new field names
- [x] 5.5 venue-store: `fetchNearby`, `getVenue`, `createVenue`, `updateVenue`
- [x] 5.6 venue-store: CreateVenueData includes hours (JSON blob) + region_id
- [x] 5.7 VenuesPage, CreateVenuePage present
- [ ] 5.8 🧪 Runtime: radar returns matches within radius sorted by distance
- [ ] 5.9 🧪 Runtime: create venue within Mendoza bounds succeeds
- [ ] 5.10 Follow-up: VenueEditPage to use updateVenue store action

---

## EPIC 06 — Rankings + feed + partnerships

- [x] 6.1 rankings-store: `fetchRankings` parses `entries` (not `rankings`)
- [x] 6.2 rankings-store: `fetchProjection(opponent_id, 'win'|'lose'|'draw')`
- [x] 6.3 rankings-store: `fetchRegions` (public endpoint)
- [x] 6.4 types: RankingsResponse = {region_id, region_name, entries, total}
- [x] 6.5 types: MatchProjection = {current_elo, projected_elo, delta, opponent_elo, expected_score}
- [x] 6.6 RegionPicker local type: Region with `id: string` UUID
- [x] 6.7 feed-store: `regionId` optional (JWT claim fallback)
- [x] 6.8 FeedPage no regional guard
- [x] 6.9 partnership-store: full lifecycle + `fetchSentRequests`
- [x] 6.10 partnership-store: `fetchBestPartner` returns null-safe
- [x] 6.11 api-errors: handles GENDER_MISMATCH + 409 partnership conflict
- [ ] 6.12 🧪 Runtime: /rankings with region_id from JWT claim works without explicit param
- [ ] 6.13 🧪 Runtime: /partnerships request → accept → stats
- [ ] 6.14 🧪 Runtime: 6th partnership returns 409 max reached

---

## EPIC 07 — Admin panel (new)

- [x] 7.1 admin-store: kpis, moderators, disputes, reports, auditEntries, playerSearchResults
- [x] 7.2 admin-store: fetchKpis, fetchModerators, createModerator (promote OR new), updateModerator, deleteModerator
- [x] 7.3 admin-store: banPlayer (soft|hard), unbanPlayer, eloAdjust
- [x] 7.4 admin-store: fetchDisputes, resolveDispute (action=seal|dismiss, optional result_override, optional penalize)
- [x] 7.5 admin-store: fetchReports with filter, fetchAuditLog paginated, createRegion
- [x] 7.6 AdminRoute guard (role=superadmin|moderator)
- [x] 7.7 AdminLayout with role-filtered sidebar
- [x] 7.8 AdminDashboard (8 KPI cards)
- [x] 7.9 AdminModeratorsPage (table + create/edit modal both modes)
- [x] 7.10 AdminDisputesPage (pending/resolved split, resolve modal)
- [x] 7.11 AdminReportsPage (filters)
- [x] 7.12 AdminPlayerActionsPage (search + ban/unban/elo-adjust)
- [x] 7.13 AdminAuditLogPage (paginated, admin_id filter)
- [x] 7.14 AdminRegionsPage (create form with optional WKT)
- [x] 7.15 router.tsx registers /admin/* tree
- [x] 7.16 ProfilePage conditional "Panel Admin" link
- [x] 7.17 types: KpisResponse, ModeratorResponse, AuditLogEntry, DisputeResponse, ReportResponse, BanRequest, EloAdjustRequest, ResolveDisputeRequest, CreateModeratorRequest, PlayerSearchResult
- [ ] 7.18 🧪 Runtime: login as admin@test.com → /admin dashboard shows KPIs
- [ ] 7.19 🧪 Runtime: ban player as soft → appears hidden from flare listings
- [ ] 7.20 🧪 Runtime: resolve dispute → match sealed
- [ ] 7.21 Follow-up: result_override set builder UI on dispute resolve modal

---

## EPIC 08 — Notifications + PWA + polish

- [x] 8.1 device-token service: register + unregister (DELETE with body)
- [x] 8.2 useDeviceTokenRegistration hook
- [x] 8.3 vite-plugin-pwa manifest (standalone, theme color, icons)
- [x] 8.4 Workbox runtime caching (NetworkFirst for API, default precache for assets)
- [x] 8.5 OfflineBanner component
- [x] 8.6 ErrorBoundary top-level
- [ ] 8.7 🧪 Runtime: install PWA on mobile, appears on home screen
- [ ] 8.8 🧪 Runtime: FCM device token registers and unregisters
- [ ] 8.9 🧪 Runtime: offline mode shows banner + cached shell

---

## Verification checklist (next session)

1. `cd frontend && npm install`
2. Start backend: `cd backend && go run ./cmd/server` (requires Postgres running — `docker compose up postgres api` in WSL with Docker Desktop, or install postgres locally)
3. `cd frontend && npm run dev` → http://localhost:5173
4. Run through test plan in each EPIC's 🧪 Runtime tasks
5. Any failing endpoint → fix store/component, re-verify
6. `openspec archive frontend-full-restore-and-sync` once all 🧪 tasks pass
