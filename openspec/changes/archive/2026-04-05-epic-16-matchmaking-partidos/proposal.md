# Proposal: EPIC 16 — Matchmaking + Partidos Tab (Tab 2)

## Intent

Implement the full Tab 2 experience for BlendPadel mobile: the flare wall for finding
partners, the complete match lifecycle (pending result → confirm/dispute), and all
supporting stores/components.

## Scope

### New files
- `src/features/matchmaking/types.ts` — Flare, MatchDetail, SetScore, CreateMatchDTO, etc.
- `src/stores/matchmaking-store.ts` — Zustand store: flares CRUD, my flare
- `src/stores/match-store.ts` — Zustand store: matches, result submission, confirm/dispute
- `src/features/matchmaking/MatchmakingPage.tsx` — REWRITE: two-tab hub (Desafíos + Mis partidos)
- `src/features/matchmaking/MatchDetailPage.tsx` — REWRITE: status-driven detail with actions
- `src/features/matchmaking/components/FlareCard.tsx`
- `src/features/matchmaking/components/MatchCard.tsx`
- `src/features/matchmaking/components/SetScoreInput.tsx` — custom number pair input per set
- `src/features/matchmaking/components/ConfirmCountdown.tsx` — live 6h countdown timer
- `src/features/matchmaking/components/PlayerSearchPicker.tsx` — debounced player search
- `src/features/matchmaking/screens/CreateFlarePage.tsx`
- `src/features/matchmaking/screens/RespondFlarePage.tsx`
- `src/features/matchmaking/screens/CreateMatchPage.tsx`
- `src/features/matchmaking/screens/SubmitResultPage.tsx`
- `src/features/matchmaking/screens/ConfirmDisputePage.tsx`
- `src/routes/router.tsx` — add 5 new routes

### Out of scope
- Push notifications (EPIC 17)
- Map/distance rendering for coordinates
- Flare filters (ELO range, radius slider)

## Approach

### Zustand patterns
- Individual selectors everywhere — `useMatchmakingStore((s) => s.flares)` — no destructuring
- No useMemo/useCallback (React 19 Compiler)
- Two stores: one per domain (matchmaking, match)

### Match status machine
```
scheduled → pending_result → awaiting_confirmation → sealed
                                                   ↘ disputed
```
- Captain A submits result → status: awaiting_confirmation
- Captain B has 6h window to confirm or dispute
- Countdown polls every 60s to detect auto-seal by backend

### Key components
- `SetScoreInput`: pair of clamped [0-7] number inputs per set, min 2 / max 3 sets
- `ConfirmCountdown`: real-time second-by-second countdown from `result.submitted_at + 6h`,
  progress bar empties, urgent color at <1h, expired state at 0
- `ReportMisconductModal`: bottom-sheet, discretely placed, player radio selection + description
- `PlayerSearchPicker`: 350ms debounce on search, excludes already-selected IDs

### Routes added
| Path | Component |
|------|-----------|
| /matchmaking/create-flare | CreateFlarePage |
| /matchmaking/flares/:id/respond | RespondFlarePage |
| /matchmaking/new | CreateMatchPage |
| /matches/:id/result | SubmitResultPage |
| /matches/:id/confirm | ConfirmDisputePage |

## Risks

- Backend `/matchmaking/flares/mine` endpoint may not exist — `fetchMyFlare` handles
  silently (no-throw catch)
- Polling every 60s on awaiting_confirmation: cheap but adds load; acceptable for MVP
- Player search requires backend `/players/search?q=` endpoint

## Status
- [x] Types defined
- [x] Stores implemented
- [x] All screens built
- [x] Router updated
- [x] `npx tsc --noEmit` passes clean
