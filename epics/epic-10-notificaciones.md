# EPIC 10 — Notificaciones Push

> **Sprint**: 2-4 (transversal)
> **Prioridad**: Alta
> **Dependencias**: EPIC 01, EPIC 04
> **Historias**: US-048, US-049, US-050, US-051, US-052

---

## Objetivo

Implementar la infraestructura de push notifications con Firebase Cloud Messaging (FCM) y todos los triggers de notificación del sistema: validación de resultados, cambios de ELO, Trust Score crítico y partidos urgentes.

## Contexto

FCM es la ÚNICA dependencia externa autorizada. Las notificaciones son críticas para el flujo de validación cruzada (Capitán B tiene 6 horas para responder) y para la retención (alertas de partidos urgentes). La implementación debe estar encapsulada detrás de una interfaz `Notifier` para poder cambiar el provider sin tocar el dominio.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| NO-01 | Push al Capitán B cuando Capitán A carga resultado (deep link) |
| NO-02 | Recordatorio a las 4h si Capitán B no actuó (quedan 2h) |
| NO-03 | Push cuando delta ELO > ±50 |
| NO-04 | Push cuando Trust Score cae bajo 70 |
| NO-05 | Push cuando hay partido abierto urgente a <5km |

## Historias de Usuario

### US-048: Infraestructura de notificaciones FCM
- `POST /players/me/device-token` — registrar token FCM
- Tabla `device_tokens` con soporte multi-device
- Interface `Notifier` + implementación FCM
- Manejo de tokens inválidos (UNREGISTERED → delete)

### US-049: Notificación de resultado a validar
- Hook post-carga de resultado → push a Capitán B
- "Resultado pendiente: [Nombre] cargó [X]-[Y]. Tenés 6h para confirmar o disputar."
- Recordatorio a las 4h: "¡Te quedan 2 horas!"
- Deep link: `blendpadel://matches/{id}`

### US-050: Notificación de cambio significativo de ELO
- Hook post-ApplyELO: si |delta| > 50 → push
- Victoria: "¡Subiste [+N] puntos! Ahora tenés [total]."
- Derrota: "Bajaste [-N] puntos. ¡Dale para adelante!"
- Deep link al perfil/historial

### US-051: Notificación de Trust Score crítico
- Evento `trust_threshold_crossed`: Trust < 70
- "Tu Trust Score bajó a [N]. Quedás oculto del radar de jugadores serios."
- Solo en el cruce inicial (no repetir si ya estaba bajo 70)
- Rehabilitación: push cuando vuelve a ≥70

### US-052: Notificación de partido abierto urgente
- Job cada 15 minutos: partidos `open` a <90min
- PostGIS: jugadores elegibles en radio 5km + ELO ±300 + Trust
- FCM `SendMulticast` para eficiencia
- `notification_log` para evitar duplicados

## Enfoque Técnico

### Tablas (migración)
```sql
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    token VARCHAR(500) NOT NULL,
    platform VARCHAR(10) NOT NULL, -- ios | android
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_device_tokens_player ON device_tokens(player_id);

CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    notification_type VARCHAR(30) NOT NULL,
    reference_id UUID, -- match_id, etc.
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_log_player_type ON notification_log(player_id, notification_type, sent_at);
```

### Estructura del dominio notification/
```
internal/notification/
├── notifier.go     # Interface Notifier { Send(playerID, title, body, data) error }
├── fcm.go          # Implementación FCM (firebase-admin-go)
├── service.go      # NotificationService: lógica de cuándo enviar
├── jobs.go         # Jobs periódicos: recordatorio 4h, partidos urgentes
├── repository.go   # Interface para device_tokens y notification_log
└── postgres.go     # Implementación
```

### Interface Notifier
```go
type Notifier interface {
    Send(ctx context.Context, playerID uuid.UUID, notification Notification) error
    SendMulticast(ctx context.Context, playerIDs []uuid.UUID, notification Notification) error
}

type Notification struct {
    Title    string
    Body     string
    Data     map[string]string // deep links, etc.
    Priority string           // high | normal
}
```

### Jobs Periódicos (goroutines)
1. **Recordatorio 4h**: cada 5 min, buscar partidos `awaiting_confirmation` donde `submitted_at` entre 4h y 3h59m atrás
2. **Partidos urgentes**: cada 15 min, buscar partidos `open` a <90min, match con jugadores elegibles por PostGIS
3. **Limpieza tokens**: cada 24h, eliminar tokens con `last_used_at` > 60 días

## Testing

- **Mock Notifier**: para tests de integración (no llamar a FCM real)
- **Tests unitarios**: lógica de decisión de cuándo enviar (thresholds, dedup)
- **Tests de integración**: device token CRUD, notification_log dedup
- **NO TDD** (no es core domain)

## Definition of Done

- [ ] Device tokens registrados y eliminados al desregistrarse
- [ ] Push a Capitán B al cargar resultado
- [ ] Recordatorio a las 4h funciona
- [ ] Push de ELO significativo (|delta| > 50)
- [ ] Push de Trust Score crítico (cruce de 70)
- [ ] Push de partidos urgentes sin duplicados
- [ ] Notifier mockeado en tests (no depende de FCM)
- [ ] notification_log previene notificaciones duplicadas
