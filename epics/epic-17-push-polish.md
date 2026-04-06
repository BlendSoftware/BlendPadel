# EPIC 17 — Push Notifications + Polish

> **Sprint**: 7
> **Prioridad**: Media-Alta
> **Dependencias**: EPIC 14, EPIC 15, EPIC 16
> **Historias**: FE-038, FE-039, FE-040, FE-041, FE-042, FE-043

---

## Objetivo

Completar la experiencia de usuario con push notifications (FCM via expo-notifications), deep linking, manejo global de errores, offline banner, skeletons de carga y pull-to-refresh uniforme en todos los tabs. Es la capa de calidad que diferencia una app funcional de una app que la gente quiere usar.

## Contexto

Después de implementar los 3 tabs funcionales (EPICs 14-16), el producto tiene todas las features pero le falta la capa de robustez y delight. Las notificaciones push son el canal de retención más poderoso para un producto de matchmaking: "Te encontré partido en tu zona" es el mensaje que trae al usuario de vuelta. El manejo de errores evita que la app quede en estados corruptos. Los skeletons y la animación hacen que el tiempo de carga percibido sea mucho menor.

## Historias de Usuario

### FE-038: Registro de device token FCM
- Al iniciar la app (post-login), solicitar permisos de notificación con `expo-notifications`
- Obtener el `ExpoPushToken` o token FCM nativo
- `POST /players/me/device-token` con el token al primer launch y cuando cambia
- Manejar caso donde el usuario deniega permisos (no bloquear app, solo skip silenciosamente)
- Re-registrar token si cambia (detectado via `expo-notifications` listener)

### FE-039: Handling de push notifications
- Listener para notificaciones en foreground: mostrar in-app toast (`AlertBanner` global)
- Listener para notificaciones en background/killed: al tap navegar al destino correcto
- Tipos de notificación esperados del backend:
  - `match.confirmed` → navegar a `matches/:id`
  - `flare.completed` → navegar a `matches/:id`
  - `match.result_submitted` → navegar a `matches/:id/confirm`
  - `dispute.resolved` → navegar a `matches/:id`
  - `radar.alert` → abrir Tab 1 (Radar)

### FE-040: Deep links
- Scheme `blendpadel://` configurado en `app.json` y `metro.config.js`
- Rutas deep link:
  - `blendpadel://matches/{id}` → MatchDetailScreen
  - `blendpadel://flares/{id}` → FlareDetailScreen
  - `blendpadel://rankings` → Tab 3
- `expo-linking` para parsear URLs entrantes
- Funciona tanto desde notificaciones push como desde links externos (SMS, WhatsApp)

### FE-041: In-app notification banner (toast)
- Componente `InAppToast` global montado en el layout raíz (sobre todos los tabs)
- Aparece desde arriba con animación slide-down de 300ms
- Se auto-dismiss en 4 segundos o al tap del usuario
- Estilos por tipo: info (azul), success (verde), warning (amarillo), error (rojo)
- Queue de máximo 3 toasts simultáneos (FIFO)
- Tap en el toast ejecuta la acción de navegación si tiene `actionRoute`

### FE-042: Error handling global
- `ErrorBoundary` React envolviendo el árbol de navegación raíz
- En caso de error no capturado: pantalla de crash con botón "Reintentar" que recarga el componente
- `NetworkErrorScreen` para errores de conectividad (HTTP 0 / timeout)
- Botón "Reintentar" en todos los estados de error de listas y pantallas
- Interceptor en el cliente HTTP (axios/fetch) para manejar 401 (→ logout), 403 (→ toast "Sin permisos"), 5xx (→ toast "Error del servidor, intentá más tarde")

### FE-043: Offline banner + UX polish
- `NetInfo` (expo-network) para detectar conectividad
- Banner naranja "Sin conexión — modo offline" aparece cuando no hay red
- Desaparece automáticamente al recuperar conexión
- Pull-to-refresh habilitado en todas las listas de todos los tabs (patrón uniforme)
- Loading skeletons en listas de: flares, matches, rankings, radar (reemplaza spinners ciegos)
- Animaciones de entrada para cards en listas (FadeIn desde abajo, 150ms delay escalonado)

## Enfoque Técnico

### Estructura de archivos
```
src/
  features/
    notifications/
      hooks/
        usePushNotifications.ts    # Registro de token + listeners
        useDeepLinks.ts            # Parsing y navegación de deep links
      services/
        notifications.service.ts   # POST /players/me/device-token
      store/
        notifications-store.ts     # Zustand: toasts[], unreadCount
      types/
        notifications.types.ts     # PushPayload, ToastConfig interfaces

  shared/
    components/
      InAppToast.tsx               # Toast global con queue
      OfflineBanner.tsx            # Banner naranja de sin conexión
      ErrorBoundary.tsx            # React error boundary global
      NetworkErrorScreen.tsx       # Pantalla de error de red con retry
      SkeletonCard.tsx             # Skeleton genérico reutilizable
      SkeletonList.tsx             # N repeticiones de SkeletonCard
    hooks/
      useNetworkStatus.ts          # Wrapper expo-network con estado reactivo
      useRefresh.ts                # Pull-to-refresh state helper reutilizable
    utils/
      http-client.ts               # Interceptores 401/403/5xx
```

### Zustand store: `notifications-store.ts`
```ts
interface NotificationsStore {
  toasts: ToastConfig[];
  deviceToken: string | null;
  permissionStatus: 'granted' | 'denied' | 'undetermined';

  addToast: (toast: Omit<ToastConfig, 'id'>) => void;
  dismissToast: (id: string) => void;
  setDeviceToken: (token: string) => void;
  setPermissionStatus: (status: NotificationsStore['permissionStatus']) => void;
}

interface ToastConfig {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  actionRoute?: string;
  duration?: number; // ms, default 4000
}
```

### Registro de push token
```ts
// usePushNotifications.ts — llamado en AppLayout
async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await notificationsService.registerDeviceToken(token);
  store.setDeviceToken(token);
}
```

### Interceptor HTTP
```ts
// En http-client.ts
instance.interceptors.response.use(null, (error) => {
  if (error.response?.status === 401) authStore.logout();
  if (error.response?.status === 403) toastStore.addToast({ type: 'error', message: 'Sin permisos' });
  if (error.response?.status >= 500) toastStore.addToast({ type: 'error', message: 'Error del servidor' });
  return Promise.reject(error);
});
```

### Skeleton pattern
```tsx
// Uso consistente en todas las listas
{isLoading ? (
  <SkeletonList count={5} />
) : items.length === 0 ? (
  <EmptyState />
) : (
  <FlatList data={items} ... />
)}
```

### Endpoints consumidos
| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/players/me/device-token` | Registrar token FCM del dispositivo |

### Configuración `app.json`
```json
{
  "expo": {
    "scheme": "blendpadel",
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#00C896"
    }
  }
}
```

## Testing

- **Tests unitarios**: `notifications-store.ts` — addToast respeta queue de 3, dismissToast elimina por id; `useNetworkStatus` retorna estado correcto
- **Tests de componente**: `InAppToast` renderiza y se auto-dismiss en el tiempo correcto; `OfflineBanner` aparece cuando `isConnected = false`; `ErrorBoundary` captura error y renderiza fallback
- **Mocks**: `expo-notifications` mockeado en tests; `expo-network` con NetInfoState configurable
- **Tests de integración**: flujo recibir notificación foreground → toast aparece; flujo deep link `blendpadel://matches/123` → navega a MatchDetailScreen

## Definition of Done

- [ ] Token FCM se registra en el backend al iniciar la app
- [ ] Permiso denegado no bloquea el flujo normal de la app
- [ ] Notificaciones en foreground muestran InAppToast
- [ ] Tap en notificación background navega a la pantalla correcta
- [ ] Deep links `blendpadel://matches/{id}` navegan correctamente
- [ ] InAppToast queue funciona con máximo 3 simultáneos
- [ ] OfflineBanner aparece y desaparece según conectividad real
- [ ] ErrorBoundary captura crashes y muestra pantalla de recuperación
- [ ] Interceptor HTTP maneja 401 (logout), 403 (toast), 5xx (toast) uniformemente
- [ ] Skeletons visibles en carga inicial de todos los tabs
- [ ] Pull-to-refresh funciona en todos los tabs
- [ ] Animaciones de entrada en listas no degradan FPS en dispositivos de gama media
