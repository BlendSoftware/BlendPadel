# Tasks — EPIC 13: Tab Perfil

## T1 — Extender tipos en src/types/index.ts
- [x] Agregar PlayerProfile (id, name, last_name, elo_rating, trust_score, trust_label, status, validated_match_count, calibration_matches_remaining, latitude, longitude, avatar_url)
- [x] Agregar PlayerPreferences (radar_radius_km, elo_min_delta, elo_max_delta)
- [x] Agregar MatchHistoryEntry (id, played_at, result, team1, team2, elo_delta, won)
- [x] Agregar EloHistoryEntry (date, elo, delta)
- [x] Agregar UpdateProfileData (last_name, latitude?, longitude?)
- [x] Agregar PublicPlayerProfile (versión sin datos sensibles, trust_label como string)

## T2 — Crear src/stores/profile-store.ts
- [x] Estado: profile, eloHistory, matchHistory, matchHistoryPage, hasMoreMatches, preferences, loading, uploading, error
- [x] fetchProfile(): GET /players/me
- [x] updateProfile(data): PUT /players/me
- [x] uploadAvatar(file): POST /players/me/avatar como multipart
- [x] fetchEloHistory(): GET /players/me/elo-history
- [x] fetchMatchHistory(playerId?, reset?): GET /players/me/matches o /players/{id}/matches con paginación
- [x] fetchPreferences(): GET /players/me/preferences
- [x] updatePreferences(data): PUT /players/me/preferences
- [x] fetchPublicProfile(id): GET /players/{id}
- [x] Usar selectores individuales (no destructuring)

## T3 — Reescribir src/features/profile/ProfilePage.tsx
- [x] Fetch profile on mount (useEffect con fetchProfile)
- [x] Hero section: Avatar XL + name + last_name + username
- [x] ELO display: número grande + badge categoría
- [x] TrustBadge component
- [x] Estado calibración: "Te faltan N partidos" o posición ranking
- [x] Stats row: partidos jugados, ELO trend
- [x] Quick actions: Editar perfil, Preferencias, Cambiar contraseña, Cerrar sesión
- [x] EloChart con GET /players/me/elo-history
- [x] Spinner mientras carga, error state
- [x] Avatar clickeable → /profile/avatar

## T4 — Crear src/features/profile/EditProfilePage.tsx
- [x] Form: last_name input
- [x] Botón "Usar mi ubicación" con navigator.geolocation
- [x] Validación bounds Mendoza client-side
- [x] Mostrar lat/lng actual si existe
- [x] Spinner en botón submit
- [x] PUT /players/me on submit via updateProfile
- [x] navigate(-1) on success
- [x] Error handling con mensaje user-friendly

## T5 — Crear src/features/profile/AvatarUploadPage.tsx
- [x] File input hidden + label clickeable (touch target 44px)
- [x] Preview inmediato con FileReader
- [x] Validación: accept image/jpeg,image/png,image/webp, max 5MB
- [x] POST /players/me/avatar via uploadAvatar(file)
- [x] Spinner durante upload
- [x] navigate(-1) on success
- [x] Error handling

## T6 — Crear src/features/profile/PreferencesPage.tsx
- [x] GET /players/me/preferences on mount
- [x] Range slider radar_radius_km (1-50)
- [x] Range sliders elo_min_delta (-500 a 0) y elo_max_delta (0 a +500)
- [x] Debounce 800ms en onChange → PUT /players/me/preferences
- [x] Estado "Guardando..." / "Guardado" visible
- [x] Revertir en error

## T7 — Reescribir src/features/profile/PublicProfilePage.tsx
- [x] GET /players/{id} via fetchPublicProfile
- [x] Misma estructura que ProfilePage pero READ-ONLY
- [x] Trust como label texto (Excelente/Bueno/Bajo), no número
- [x] Últimos 5 partidos via fetchMatchHistory(id)
- [x] Botón "Desafiar" → link a /matchmaking
- [x] 404 handling: "Jugador no encontrado" si banned/no existe

## T8 — Crear src/features/profile/components/EloChart.tsx
- [x] SVG line chart sin dependencias externas
- [x] ViewBox responsive
- [x] Path interpolado desde EloHistoryEntry[]
- [x] Gradiente área bajo la curva
- [x] Empty state "Sin historial ELO"

## T9 — Crear src/features/profile/components/MatchHistoryList.tsx
- [x] Lista de MatchHistoryEntry con resultado, equipos, delta ELO
- [x] Delta ELO: +N verde, -N rojo
- [x] "Load more" button para paginación
- [x] Empty state "Sin partidos jugados"

## T10 — Actualizar src/routes/router.tsx
- [x] Agregar /profile/edit → EditProfilePage
- [x] Agregar /profile/avatar → AvatarUploadPage
- [x] Agregar /profile/preferences → PreferencesPage
- [x] Verificar /profile/:id → PublicProfilePage (ya existe)

## T11 — Verificación
- [x] npx tsc --noEmit → 0 errores
- [x] Perfil carga datos reales del backend
- [x] Edit profile con geolocalización
- [x] Avatar upload funciona
- [x] Preferencias se guardan
- [x] Perfil público muestra trust label
- [x] ELO history se muestra
- [x] Historial de partidos lista
