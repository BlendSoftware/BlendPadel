# Proposal — EPIC 13: Tab Perfil

## Intent

Implementar el Tab 4 (Perfil) completo para la PWA BlendPadel. Esta es la primera tab funcional post-onboarding y debe generar el "golpe de dopamina" del usuario: ver su ELO, Trust Score, avatar y estadísticas. También incluye edición de perfil con geolocalización, upload de avatar, historial de partidos, preferencias de matchmaking y perfiles públicos de otros jugadores.

## Scope

**IN scope:**
- Pantalla Mi Perfil con datos reales desde GET /players/me
- Edición de apellido + geolocalización Mendoza (PUT /players/me)
- Upload de avatar con preview (POST /players/me/avatar)
- Preferencias de matchmaking con auto-save (GET/PUT /players/me/preferences)
- Perfil público de otros jugadores (GET /players/{id})
- Historial de partidos paginado (GET /players/me/matches y /players/{id}/matches)
- Gráfico ELO history con SVG (GET /players/me/elo-history)
- Profile Zustand store con caché
- Rutas: /profile/edit, /profile/preferences, /profile/:id

**OUT scope:**
- Chat/mensajería
- Notificaciones push
- Sistema de amigos/seguidores
- Compartir perfil externamente

## Approach

1. Crear `src/stores/profile-store.ts` — Zustand store para datos de perfil con caché y lazy fetch
2. Extender `src/types/index.ts` — agregar PlayerProfile, Preferences, MatchHistoryEntry, EloHistoryEntry
3. Reescribir `ProfilePage.tsx` — layout hero + stats + ELO chart + historial
4. Crear `EditProfilePage.tsx` — form con geolocalización browser
5. Crear `AvatarUploadPage.tsx` — file input + preview + multipart POST
6. Crear `PreferencesPage.tsx` — sliders con debounced auto-save
7. Reescribir `PublicProfilePage.tsx` — perfil readonly con trust label
8. Agregar rutas en `router.tsx`

## Risks

- Browser Geolocation API puede fallar en localhost/HTTP — usar HTTPS o fallback manual
- Avatar upload: el backend retorna nueva URL, necesitamos actualizar auth store también
- ELO history puede estar vacío en calibración — mostrar estado empty gracefully
- Validación de bounds Mendoza debe ser UX-friendly (mensaje claro)
