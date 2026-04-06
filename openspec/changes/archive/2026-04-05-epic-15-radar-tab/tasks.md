# Tasks — EPIC 15: Radar Tab

**Change ID**: epic-15-radar-tab
**Status**: complete

---

## Task List

- [x] T1 — Install leaflet + react-leaflet + @types/leaflet
- [x] T2 — Create `src/types/radar.ts` — RadarMatch, RadarAlert, ELORange interfaces
- [x] T3 — Create `src/stores/radar-store.ts` — Zustand store with individual selectors
- [x] T4 — Create `src/features/radar/components/AlertBanner.tsx`
- [x] T5 — Create `src/features/radar/components/MatchDetailSheet.tsx`
- [x] T6 — Create `src/features/radar/components/ELOFilterPanel.tsx`
- [x] T7 — Create `src/features/radar/components/RadarEmptyState.tsx`
- [x] T8 — Create `src/features/radar/components/LocationDeniedScreen.tsx`
- [x] T9 — Create `src/features/radar/components/RadarMap.tsx` (Leaflet map + custom SVG markers)
- [x] T10 — Rewrite `src/features/radar/RadarPage.tsx` — wires all components
- [x] T11 — Import leaflet CSS in RadarPage (or main.tsx)
- [x] T12 — Run `npx tsc --noEmit` — zero type errors
