# EPIC 09 — Panel Admin / Tribunal

> **Sprint**: 4
> **Prioridad**: Alta
> **Dependencias**: EPIC 01, EPIC 03, EPIC 04
> **Historias**: US-043, US-044, US-045, US-046, US-047

---

## Objetivo

Implementar el panel web de administración (React + Vite + Tailwind) y los endpoints backend de admin: dashboard de KPIs, gestión de moderadores, baneos, recalibración de ELO y vista de disputas para moderadores. Dashboard utilitario, cero firuletes estéticos.

## Contexto

El panel admin es la herramienta del Tribunal de BlendPadel. Inicialmente solo lo usan Juani y su socio como SuperAdmin. Pero el RBAC está preparado para sumar Moderadores (referentes de zona) cuando la app escale. El panel es web separado (React + Vite + Tailwind), no infla la app mobile.

## Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| AD-01 | SuperAdmin: soft ban (oculto ranking) y hard ban (acceso revocado) |
| AD-02 | Recalibración ELO con justificación auditada |
| AD-03 | SuperAdmin crea Moderadores con region_id |
| AD-04 | Moderador: solo audita su región |
| AD-05 | KPIs: partidos/día, tasa disputas, distribución Trust, jugadores/zona |
| AU-04 | RBAC: SuperAdmin > Moderador > Jugador |

## Historias de Usuario

### US-043: Dashboard de KPIs
- `GET /admin/kpis` — partidos hoy/semana/mes, tasa disputas, distribución Trust, jugadores/zona
- Cache 5 minutos (in-memory)
- Alerta si tasa disputas > 5% en 7 días
- Admin panel: auto-refresh cada 60s

### US-044: Gestión de moderadores
- `POST /admin/moderators` — email, nombre, region_id
- `PUT /admin/moderators/{id}` — cambiar región (invalida JWT)
- `GET /admin/moderators` — listar con stats
- `DELETE /admin/moderators/{id}` — degradar a jugador

### US-045: Banear y desbanear jugadores
- `POST /admin/players/{id}/ban` — tipo (soft/hard), razón, duración
- Soft ban: invisible en ranking/radar, puede loguearse
- Hard ban: acceso revocado, tokens invalidados
- Audit log obligatorio
- `POST /admin/players/{id}/unban` — desbanear

### US-046: Recalibración manual de ELO
- `POST /admin/players/{id}/elo-adjust` — new_elo, reason
- Registrar en elo_history tipo `manual_adjustment`
- Registrar en admin_audit_log
- Rango permitido: 500-2500
- Recalcular posición en ranking

### US-047: Vista de disputas pendientes (Moderador)
- `GET /admin/disputes?status=pending` — filtrado por region_id
- Detalle con historial ELO de ambos capitanes
- Flag urgente si >24h pendiente
- Historial de disputas resueltas propias

## Enfoque Técnico

### Tablas (migración)
```sql
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- ban | unban | elo_adjust | create_moderator | remove_moderator | resolve_dispute
    target_user_id UUID REFERENCES users(id),
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_target ON admin_audit_log(target_user_id);
```

### Endpoints Admin
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/admin/kpis` | Dashboard KPIs |
| GET/POST | `/admin/moderators` | Listar/Crear moderadores |
| PUT/DELETE | `/admin/moderators/{id}` | Editar/Remover moderador |
| POST | `/admin/players/{id}/ban` | Banear jugador |
| POST | `/admin/players/{id}/unban` | Desbanear jugador |
| POST | `/admin/players/{id}/elo-adjust` | Recalibrar ELO |
| GET | `/admin/disputes` | Listar disputas |
| POST | `/admin/disputes/{id}/resolve` | Resolver disputa |
| GET | `/admin/reports` | Listar reportes conducta |

### Panel Web (admin/)
```
admin/
├── src/
│   ├── features/
│   │   ├── dashboard/     # KPIs, gráficos de tendencia
│   │   ├── disputes/      # Lista y detalle de disputas
│   │   ├── players/       # Buscar, ver, banear, ajustar ELO
│   │   ├── moderators/    # CRUD moderadores
│   │   └── reports/       # Reportes de conducta
│   ├── components/        # Table, Card, Badge, Modal
│   ├── hooks/             # useAuth, useFetch
│   ├── stores/            # Zustand: authStore
│   ├── services/          # API client
│   └── types/
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

### Diseño del Panel
- Utilitario, no estético. Fondo oscuro, datos en tablas.
- Sidebar con navegación: Dashboard, Jugadores, Moderadores, Disputas, Reportes
- Tablas con búsqueda, filtros y paginación
- Modales para acciones (banear, ajustar ELO)
- Badges de estado con colores semánticos

## Testing

- **Backend**: Tests de integración para cada endpoint admin con RBAC
- **Frontend**: Tests básicos de componentes con Jest
- **NO TDD** (no es core domain)

## Definition of Done

- [ ] KPIs dashboard con cache y auto-refresh
- [ ] CRUD moderadores con asignación de región
- [ ] Ban/unban con audit log completo
- [ ] Recalibración ELO con trazabilidad
- [ ] Disputas filtradas por región del moderador
- [ ] Panel web funcional (React + Vite + Tailwind)
- [ ] Todos los endpoints protegidos por RBAC
