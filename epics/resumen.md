# EPICs — BlendPadel

> Resumen de todas las EPICs del proyecto con dependencias, sprint asignado y estado.
> Referencia completa de historias backend: `Historias de Usuario.md`

## Backend (EPICs 00-10) — COMPLETADO

| EPIC | Nombre | Sprint | Estado |
|------|--------|--------|--------|
| 00 | Infraestructura y Setup | 0 | Archivada |
| 01 | Autenticación y RBAC | 1 | Archivada |
| 02 | Jugador y Onboarding | 1 | Archivada |
| 03 | Motor ELO y Trust Score | 2 | Archivada |
| 04 | Partidos y Validación Cruzada | 2 | Archivada |
| 05 | Radar (Tab 1) | 3 | Archivada |
| 06 | Matchmaking (Tab 2) | 3 | Archivada |
| 07 | Rankings (Tab 3) | 3 | Archivada |
| 08 | Perfil (Tab 4) | 3 | Archivada |
| 09 | Panel Admin / Tribunal | 4 | Archivada |
| 10 | Notificaciones Push | 4 | Archivada |

**11 paquetes, ~175 tests, ~44 endpoints, 10 migraciones.**

---

## Frontend Mobile (EPICs 11-17)

| EPIC | Nombre | Sprint | Historias | Depende de | Estado |
|------|--------|--------|-----------|------------|--------|
| 11 | Scaffolding Mobile | 5 | FE-001 a FE-006 | Ninguna | Pendiente |
| 12 | Auth Screens | 5 | FE-007 a FE-012 | EPIC 11 | Pendiente |
| 13 | Perfil (Tab 4) | 6 | FE-013 a FE-019 | EPIC 12 | Pendiente |
| 14 | Rankings (Tab 3) | 6 | FE-020 a FE-023 | EPIC 13 | Pendiente |
| 15 | Radar (Tab 1) | 6 | FE-024 a FE-028 | EPIC 13 | Pendiente |
| 16 | Matchmaking + Partidos (Tab 2) | 6-7 | FE-029 a FE-037 | EPIC 13 | Pendiente |
| 17 | Push Notifications + Polish | 7 | FE-038 a FE-043 | EPICs 14-16 | Pendiente |

## Frontend Admin (EPICs 18-19) — CONGELADO

| EPIC | Nombre | Sprint | Depende de | Estado |
|------|--------|--------|------------|--------|
| 18 | Admin Scaffolding + Dashboard | 8+ | Ninguna | Congelado |
| 19 | Admin CRUD + Moderación | 8+ | EPIC 18 | Congelado |

> Admin panel congelado hasta nuevo aviso. Los primeros 50 usuarios de Rivadavia se administran con queries directas a la DB.

---

## Grafo de Dependencias — Frontend Mobile

```
EPIC 11 (Scaffold) ──► EPIC 12 (Auth) ──► EPIC 13 (Perfil)
                                               │
                                    ┌──────────┼──────────┐
                                    ▼          ▼          ▼
                              EPIC 14     EPIC 15     EPIC 16
                              (Rankings)  (Radar)     (Match+MM)
                                    │          │          │
                                    └──────────┴──────────┘
                                               │
                                               ▼
                                          EPIC 17 (Push+Polish)
```

## Fases de Implementación — Frontend

### FASE F1 — Fundación Mobile
> Secuencial.

| EPIC | Nombre | Estimación |
|------|--------|------------|
| 11 | Scaffolding Mobile | 1 sprint |

**Entregable**: Expo app compilando, 4 tabs, API client con JWT, auth store, componentes base.

---

### FASE F2 — Auth + Primera Tab
> Secuencial.

| EPIC | Nombre | Estimación |
|------|--------|------------|
| 12 | Auth Screens | 1 sprint |
| 13 | Perfil (Tab 4) | 1 sprint |

**Entregable**: Flujo completo register → login → onboarding → ver perfil con ELO.

---

### FASE F3 — Las 3 Tabs Restantes (PARALELAS)
> **100% paralelas entre sí.**

| EPIC | Nombre | Estimación |
|------|--------|------------|
| 14 | Rankings (Tab 3) | 1 sprint |
| 15 | Radar (Tab 1) | 1 sprint |
| 16 | Matchmaking + Partidos (Tab 2) | 1-2 sprints |

**Entregable**: App mobile con las 4 tabs funcionales.

```
        ┌── EPIC 14 (Rankings) ─────┐
        │                           │
F2 ─────┼── EPIC 15 (Radar) ───────┼──► F4
        │                           │
        └── EPIC 16 (Match+MM) ────┘
```

---

### FASE F4 — Push + Polish
> Secuencial.

| EPIC | Nombre | Estimación |
|------|--------|------------|
| 17 | Push Notifications + Polish | 1 sprint |

**Entregable**: App mobile lista para beta en Rivadavia.

---

## Timeline Completo

```
BACKEND (completado)
═══════════════════════════════════════════════════
Sprint 0-4: EPICs 00-10 ✓

FRONTEND MOBILE
═══════════════════════════════════════════════════
Sprint 5:    F1 [EPIC 11] + F2 [EPIC 12]
Sprint 6:    F2 [EPIC 13] + F3 [EPIC 14|15|16 paralelo]
Sprint 7:    F3 (fin) + F4 [EPIC 17]

ADMIN (congelado)
═══════════════════════════════════════════════════
Sprint 8+:  EPICs 18-19 (cuando haya 50+ usuarios)
```

## Resumen Rápido

| Fase | EPICs | ¿Paralelas? | Sprint |
|------|-------|-------------|--------|
| F1 | 11 | No | 5 |
| F2 | 12, 13 | No (secuencial) | 5-6 |
| F3 | 14, 15, 16 | Sí, 100% paralelas | 6-7 |
| F4 | 17 | No | 7 |

**Total frontend mobile**: ~3 sprints para MVP mobile completo.

---

## Flujo de Trabajo por EPIC

```
1. Leé el MD de la EPIC → epics/epic-{NN}-{nombre}.md
2. /opsx:propose → genera proposal + design + tasks
3. /opsx:apply → implementa task por task
4. /opsx:verify → valida contra specs y DoD
5. /opsx:archive → cierra la EPIC y pasa a la siguiente
```
