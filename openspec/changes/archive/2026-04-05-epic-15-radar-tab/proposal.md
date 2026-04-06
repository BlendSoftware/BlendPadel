# Proposal — EPIC 15: Radar Tab (Tab 1)

**Change ID**: epic-15-radar-tab
**Status**: proposed
**Date**: 2026-04-04
**Sprint**: 6

---

## Intent

Implement the Radar tab — the primary screen of BlendPadel PWA. Shows nearby active padel matches on an interactive map with urgency alerts, ELO filtering, and match detail bottom sheet. This is the highest-impact retention screen.

## Scope

**In scope:**
- Leaflet map centered on user's GPS position (CartoDB dark tiles)
- Custom SVG match markers (padel-green) with click-to-detail
- Radar Zustand store with individual selectors
- `GET /radar/matches` and `GET /radar/alerts` API calls
- AlertBanner for urgent matches (<1h, <5km)
- ELO range filter panel (collapsible, 500ms debounce)
- Radius selector: 5km, 10km, 15km, 25km
- Match detail bottom sheet (slide-up panel)
- Geolocation: permission request → denial fallback (manual input or Mendoza default)
- Auto-refresh every 30s
- Empty state and loading state
- Leaflet CSS dark-theme integration
- TypeScript strict — zero type errors

**Out of scope:**
- "Quiero jugar" CTA navigation (EPIC 16 dependency)
- Push notifications for alerts
- Persistent alert badge on BottomNav (BottomNav is static for now)

## Approach

**Map library**: Leaflet + react-leaflet (lightweight, free, OpenStreetMap protocol, dark tiles via CartoDB). Avoids Google Maps billing.

**Marker icons**: Custom SVG markers injected via `L.divIcon` to bypass the Webpack/Vite broken-path issue with Leaflet's default PNG icons.

**Geolocation flow**:
1. On mount, request `navigator.geolocation.getCurrentPosition`
2. Success → store lat/lng, fetch matches
3. Denied → show LocationPermissionDenied screen with manual coordinate input (default to Mendoza: -33.35, -68.33)

**Filter panel**: Collapsible overlay above the map. ELO range uses two `<input type="range">` with debounce. Radius is a segmented control (4 options).

**Bottom sheet**: Custom implementation using CSS transform + transition (no external library dependency). Slides up from bottom, closes on backdrop click or escape key.

**Auto-refresh**: `setInterval` in `useEffect` within RadarPage, cleared on unmount.

**Store pattern**: Individual Zustand selectors per CRITICAL rule — no destructuring.

## File Structure

```
src/
  features/
    radar/
      RadarPage.tsx               ← root, wires store + map
      components/
        RadarMap.tsx              ← Leaflet MapContainer + markers
        MatchMarker.tsx           ← L.divIcon SVG marker per match
        AlertBanner.tsx           ← urgent match strip (top of page)
        ELOFilterPanel.tsx        ← collapsible filter overlay
        MatchDetailSheet.tsx      ← slide-up bottom sheet
        RadarEmptyState.tsx       ← no matches in radius
        LocationDeniedScreen.tsx  ← geolocation denied fallback
  stores/
    radar-store.ts                ← Zustand store
  types/
    radar.ts                      ← RadarMatch, RadarAlert, ELORange
```

## Risks

| Risk | Mitigation |
|------|-----------|
| Leaflet SSR issues | PWA is client-only (Vite), no SSR — safe |
| Leaflet default icon 404s | Use custom `L.divIcon` SVG markers, no PNG dependency |
| Geolocation denied in browser | Fallback to manual input with Mendoza default |
| CartoDB tile rate limits | Free tier is generous for dev; note for production |
| Map re-renders on filter change | Only re-fetch data, not remount map — store updates propagate to markers |
