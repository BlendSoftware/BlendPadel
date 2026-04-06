# EPIC 13 — Tab 4: Perfil

> **Sprint**: 6
> **Prioridad**: Alta
> **Dependencias**: EPIC 12
> **Historias**: FE-013 a FE-019

---

## Objetivo

Implementar el Tab 4 (Perfil) completo: mi perfil con ELO, Trust Score, estado de calibración, edición de perfil, upload de avatar, historial de ELO con gráfico, preferencias de matchmaking, y perfil público de otros jugadores. Esta es la primera tab funcional — cierra el loop de retención del onboarding.

## Contexto

El perfil es el "DNI Padelero". Es lo primero que el usuario ve después del onboarding. Acá recibe su golpe de dopamina: su ELO, su Trust Score, su avatar. Es CRUCIAL que esta pantalla esté pulida — es la primera impresión real de la app.

## Historias de Usuario

### FE-013: Pantalla de Mi Perfil
- GET /players/me → mostrar todo
- Avatar grande arriba
- ELO con número grande y badge de categoría
- Trust Score con icono (Excelente/Bueno/Bajo)
- Estado: "En calibración — te faltan {N} partidos" o posición en ranking
- validated_match_count visible
- Botón editar perfil, botón cambiar contraseña

### FE-014: Editar Perfil
- Formulario: nombre, apellido, ubicación
- Ubicación: usar expo-location para obtener lat/lng automáticamente
- Validación bounds Mendoza client-side
- PUT /players/me

### FE-015: Upload de Avatar
- Seleccionar desde galería (expo-image-picker)
- Preview antes de subir
- Crop circular
- POST /players/me/avatar (multipart)
- Mostrar nuevo avatar inmediatamente

### FE-016: Gráfico de ELO History
- GET /players/me/elo-history
- Line chart con react-native-chart-kit o victory-native
- Eje X: fechas, Eje Y: ELO
- Cada punto es clickeable → ver detalle del partido
- Mostrar delta (+/-) en cada punto

### FE-017: Preferencias de Matchmaking
- GET + PUT /players/me/preferences
- Slider: radio de búsqueda (1-50 km)
- Slider: rango ELO (±50 a ±500)
- Días preferidos (checkboxes)
- Guardar automáticamente al cambiar

### FE-018: Perfil Público de Otro Jugador
- GET /players/{id}
- Misma estructura que mi perfil pero sin edición
- Trust Score como label (Excelente/Bueno/Bajo), no número exacto
- Últimos 5 partidos
- Botón "Desafiar" → navegar a crear flare/partido
- Jugador baneado → pantalla de error

### FE-019: Historial de Partidos
- GET /players/{id}/matches?limit=10
- Lista de partidos con resultado, equipos, delta ELO
- Pull to refresh + paginación infinita
- Cada partido expandible para ver detalle

## Enfoque Técnico

### Estructura
```
src/features/profile/
├── screens/
│   ├── MyProfileScreen.tsx
│   ├── EditProfileScreen.tsx
│   ├── PreferencesScreen.tsx
│   ├── PublicProfileScreen.tsx
│   └── MatchHistoryScreen.tsx
├── components/
│   ├── ProfileHeader.tsx       # Avatar + ELO + Trust
│   ├── ELOChart.tsx           # Line chart
│   ├── CalibrationBadge.tsx
│   ├── TrustBadge.tsx
│   ├── MatchCard.tsx          # Card de partido en historial
│   └── AvatarPicker.tsx
├── hooks/
│   ├── useProfile.ts
│   └── useELOHistory.ts
└── stores/
    └── profile-store.ts       # Zustand store for profile data
```

### Dependencias Adicionales
- expo-image-picker (avatar)
- expo-location (geolocalización)
- react-native-chart-kit o victory-native (gráfico ELO)
- react-native-reanimated (animaciones)

## Testing

- Jest: componentes de perfil
- Verificar flujo: abrir perfil → ver ELO → editar → subir avatar → ver gráfico

## Definition of Done

- [ ] Mi perfil muestra ELO, Trust, calibración correctamente
- [ ] Editar perfil con geolocalización funciona
- [ ] Avatar upload desde galería funciona
- [ ] Gráfico ELO renderiza con datos reales
- [ ] Preferencias se guardan y persisten
- [ ] Perfil público muestra Trust como label
- [ ] Historial de partidos con paginación
