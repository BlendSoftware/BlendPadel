# Proposal: Epic 11 — PWA Scaffolding

## Why

The project was originally built on React Native (Expo). The pivot is driven by a hard
practical constraint: the dev environment is WSL2 with no Android emulator available, so
testing the RN build is impossible without a physical device on every iteration.

A PWA running in Chrome solves this completely:
- Instant feedback in the browser, no build step for native
- Installable on Android via "Add to Home Screen" — same UX as a native app
- Same visual result on mobile: full-screen, dark theme, bottom navigation
- Zero emulator dependency for day-to-day development

## What

Bootstrap the `app/` directory from scratch as a production-grade PWA:

| Layer | Choice |
|-------|--------|
| Bundler | Vite 6 |
| UI framework | React 18 + TypeScript strict |
| Styling | TailwindCSS 4 (CSS-based config, @tailwindcss/vite) |
| State | Zustand 5 |
| Routing | React Router v7 |
| HTTP | Axios with interceptors |
| PWA | vite-plugin-pwa (Workbox autoUpdate) |
| Icons | lucide-react |

## Visual Design

- **Always dark**: background `#0f172a`, cards `#1e293b`
- **Accent**: padel-green `#22c55e`
- **Mobile-first**: max-width 480px centered container — feels like a native phone app on desktop
- **Bottom navigation**: 4 tabs fixed at bottom, content scrolls above

## Backend

100% complete. 44 REST endpoints at `http://localhost` (Docker + Caddy reverse proxy).
The frontend is a pure SPA consuming that REST API. No SSR needed.

## Scope

FE-001: Vite + React + TS project init
FE-002: TailwindCSS 4 + theme tokens
FE-003: PWA manifest + service worker
FE-004: App shell (AppShell + BottomNav + routing)
FE-005: Axios API client + Auth Zustand store
FE-006: Base UI components + placeholder pages per route
