# Historias de Usuario — BlendPadel

> **Proyecto**: Motor de Reputación y Ranking del Pádel Informal en Mendoza
> **Fecha**: 2026-04-04
> **Ordenamiento**: Por orden lógico de implementación (dependencias resueltas primero)

---

## Actores del Sistema

| Actor | Descripción |
|-------|-------------|
| **Jugador** | Usuario estándar. Juega partidos, acumula ELO y Trust Score, aparece en el ranking una vez validados 3 partidos. |
| **Capitán** | Jugador que asume el rol de cargar el resultado de un partido específico. Rol temporal, por partido. |
| **Moderador** | Referente de zona. Audita partidos y resuelve disputas dentro de su región (`region_id` scoped). No puede actuar fuera de su zona. |
| **SuperAdmin** | Acceso total al sistema: métricas, KPIs, baneos, creación de moderadores, recalibraciones ELO manuales. |
| **Sistema** | Procesos automáticos: auto-validación de resultados, cálculo ELO, recalculación de Trust Score, envío de push notifications. |

---

## Reglas de Negocio (Referencia Completa)

### Dominio: Auth (AU)

| ID | Regla | Historias Asociadas |
|----|-------|---------------------|
| AU-01 | El registro requiere email único, contraseña (min 8 chars, 1 mayúscula, 1 número) y datos básicos de perfil. | US-005 |
| AU-02 | El access token dura 1 hora. El refresh token dura 30 días con rotación en cada uso (refresh rotation). | US-006, US-007 |
| AU-03 | Rate limiting: máximo 5 intentos de login fallidos por IP en 15 minutos → bloqueo temporal. | US-008 |
| AU-04 | RBAC: SuperAdmin puede crear Moderadores. Los Moderadores tienen scope de `region_id`. Los Jugadores solo acceden a endpoints públicos y propios. | US-009, US-046 |
| AU-05 | El token de refresh invalidado no puede reutilizarse (token family invalidation ante robo detectado). | US-007 |

### Dominio: Player (PL)

| ID | Regla | Historias Asociadas |
|----|-------|---------------------|
| PL-01 | Los jugadores no pueden elegir su propia categoría al registrarse. El nivel inicial se determina por el cuestionario de onboarding. | US-010, US-011 |
| PL-02 | Un jugador está en estado "Nivel en Calibración" hasta completar 3 partidos validados. Durante calibración no aparece en el ranking global. | US-011, US-012, US-028 |
| PL-03 | El cuestionario de onboarding evalúa: frecuencia de juego, participación en torneos, tipo de paleta usada, y autoevaluación cualitativa. El ELO inicial se asigna algorítmicamente, no manualmente. | US-011 |
| PL-04 | El avatar se almacena en filesystem local. Formatos permitidos: JPG, PNG, WebP. Tamaño máximo: 5MB. | US-013 |
| PL-05 | Un jugador con Trust Score < 70 queda oculto del radar y matchmaking de jugadores con Trust Score ≥ 70. | US-022, US-035 |
| PL-06 | El perfil público muestra: rank, ELO exacto, Trust Score, últimos 10 partidos con gráfico de evolución. | US-041 |

### Dominio: Match (MA)

| ID | Regla | Historias Asociadas |
|----|-------|---------------------|
| MA-01 | Un partido tiene exactamente 4 jugadores: 2 equipos de 2. Uno de los capitanes carga el resultado. | US-023 |
| MA-02 | El resultado se expresa como sets ganados y games por set (ej: 6-4, 7-5). El margen de victoria afecta el multiplicador M del ELO. | US-023, US-018 |
| MA-03 | Cross-validation: el Capitán A carga el resultado → push notification al Capitán B → ventana de 6 horas para objetar → si no hay objeción, el resultado se sella automáticamente. | US-024, US-025, US-026 |
| MA-04 | Si el Capitán B objeta, el partido entra en estado "disputa". Ambos jugadores pierden Trust Score. El Moderador de zona audita. | US-025, US-027 |
| MA-05 | Disputas sistemáticas (≥ 2 disputas en 30 días para el mismo jugador) → freeze del ELO de ambos jugadores involucrados. | US-027 |
| MA-06 | Un partido puede crearse con estado "abierto" (buscando rivales) o "cerrado" (4 jugadores confirmados, esperando resultado). | US-033 |
| MA-07 | El resultado de un partido en calibración (K=60) solo afecta ELO cuando el partido está sellado y validado. | US-017, US-026 |

### Dominio: Ranking (RK)

| ID | Regla | Historias Asociadas |
|----|-------|---------------------|
| RK-01 | Fórmula ELO: `ELO_new = ELO_current + K * (R - E) * M`. K=60 para los primeros 5 partidos (calibración), K=20 a partir del 6to. | US-017 |
| RK-02 | E (probabilidad esperada) = `1 / (1 + 10^((ELO_rival - ELO_propio) / 400))`. Se calcula sobre el promedio ELO del equipo rival vs equipo propio. | US-017 |
| RK-03 | M (multiplicador por margen) = 1.0 si diferencia ≤ 2 games totales, 1.2 si 3-4 games, 1.5 si ≥ 5 games. | US-018 |
| RK-04 | El ranking global solo muestra jugadores con ≥ 3 partidos validados. Los jugadores en calibración aparecen como "Por confirmar". | US-028 |
| RK-05 | Las tablas hiperlocales se generan por zona geográfica (PostGIS, radio configurable). | US-038 |
| RK-06 | La proyección de puntos muestra el delta ELO esperado (+/-) antes de confirmar un partido, basado en ELOs actuales. | US-039 |

### Dominio: Trust (TR)

| ID | Regla | Historias Asociadas |
|----|-------|---------------------|
| TR-01 | Trust Score inicial: 80/100. | US-011 |
| TR-02 | Cancelación con menos de 2 horas de anticipación: -10 puntos de Trust Score. | US-020 |
| TR-03 | Reporte de mala conducta validado por Moderador: -15 puntos de Trust Score. | US-021, US-047 |
| TR-04 | Disputa sistemática (segunda disputa en 30 días): -20 puntos de Trust Score para ambos jugadores. | US-027 |
| TR-05 | Trust Score < 70: el jugador queda oculto del radar y matchmaking de jugadores serios (Trust ≥ 70). | US-022, US-035 |
| TR-06 | Recuperación de Trust Score: +2 puntos por cada partido completado sin incidentes, con cap de recuperación de 10 puntos/mes. | US-022 |

### Dominio: Admin (AD)

| ID | Regla | Historias Asociadas |
|----|-------|---------------------|
| AD-01 | El SuperAdmin puede banear jugadores (soft ban: oculto del ranking; hard ban: acceso revocado). | US-046 |
| AD-02 | El SuperAdmin puede recalibrar el ELO de un jugador con justificación auditada en log. | US-048 |
| AD-03 | El SuperAdmin puede crear Moderadores asignándoles una `region_id`. | US-046 |
| AD-04 | El Moderador solo puede auditar partidos y resolver disputas dentro de su región. | US-047 |
| AD-05 | El panel de Admin expone KPIs: partidos/día, tasa de disputas, distribución de Trust Scores, jugadores activos por zona. | US-049 |

### Dominio: Notification (NO)

| ID | Regla | Historias Asociadas |
|----|-------|---------------------|
| NO-01 | Push notification al Capitán B cuando el Capitán A carga un resultado. Incluye detalles del partido y deep link. | US-050 |
| NO-02 | Recordatorio push si el Capitán B no valida/objeta en 4 horas (quedan 2 horas antes del cierre automático). | US-051 |
| NO-03 | Push notification cuando el ELO de un jugador cambia significativamente (±50 puntos). | US-052 |
| NO-04 | Push cuando el Trust Score cae por debajo de 70 (umbral crítico). | US-053 |
| NO-05 | Push cuando hay un partido abierto en el radar dentro del radio configurado del jugador. | US-054 |

---

## HISTORIAS DE USUARIO

---

### EPIC 00 — Infraestructura y Setup (Sprint 0)

#### US-001: Setup Docker Compose con servicios base

- **Título**: Levantar stack completo con Docker Compose
- **Historia**: Como **Sistema**, quiero que todos los servicios (API, base de datos, proxy) estén orquestados con Docker Compose, para que el entorno de desarrollo y producción sean reproducibles y consistentes.
- **Prioridad**: Alta
- **Dependencias**: Ninguna

**Criterios de Aceptación**:
- [ ] GIVEN el repositorio clonado WHEN se ejecuta `docker compose up` THEN todos los servicios (api, postgres, caddy) levantan sin errores
- [ ] GIVEN el stack levantado WHEN se consulta `GET /health` THEN retorna `{"status": "ok", "db": "connected"}` con HTTP 200
- [ ] GIVEN el stack levantado WHEN se apaga con `docker compose down` THEN los volúmenes de PostgreSQL persisten los datos
- [ ] GIVEN cualquier servicio que falla WHEN Docker lo detecta THEN ejecuta `restart: unless-stopped` automáticamente

**Reglas de Negocio**: N/A

**Notas Técnicas**: `docker-compose.yml` con servicios: `api` (Go), `postgres:16-alpine` con extensión PostGIS, `caddy:2-alpine`. Variables de entorno via `.env` file. Health check en Go usando `database/sql` ping. Volúmenes nombrados para datos de postgres y avatars.

---

#### US-002: Configurar PostgreSQL con extensión PostGIS

- **Título**: Habilitar PostGIS para geolocalización
- **Historia**: Como **Sistema**, quiero que la base de datos tenga PostGIS habilitado, para poder calcular distancias y filtrar partidos por zona geográfica en Mendoza.
- **Prioridad**: Alta
- **Dependencias**: US-001

**Criterios de Aceptación**:
- [ ] GIVEN la base de datos iniciada WHEN se ejecuta `SELECT PostGIS_Version()` THEN retorna la versión sin error
- [ ] GIVEN la extensión habilitada WHEN se crea una columna `GEOGRAPHY(Point, 4326)` THEN la tabla se crea correctamente
- [ ] GIVEN dos puntos geográficos WHEN se ejecuta `ST_DWithin` THEN retorna si están dentro del radio especificado en metros

**Reglas de Negocio**: N/A

**Notas Técnicas**: `CREATE EXTENSION IF NOT EXISTS postgis;` en migration inicial. Usar `GEOGRAPHY` (metros) en lugar de `GEOMETRY` (grados). Índice GIST en columnas de ubicación. sqlc con soporte de tipos PostGIS via `pgx/v5`.

---

#### US-003: Estructura del proyecto Go con Chi y sqlc

- **Título**: Bootstrapear proyecto Go con router y generación de queries
- **Historia**: Como **Sistema**, quiero una estructura de proyecto Go bien definida con Chi como router y sqlc para queries type-safe, para que el desarrollo sea consistente y mantenible.
- **Prioridad**: Alta
- **Dependencias**: US-001

**Criterios de Aceptación**:
- [ ] GIVEN el proyecto inicializado WHEN se ejecuta `go build ./...` THEN compila sin errores
- [ ] GIVEN una query SQL definida en `/sql/queries/` WHEN se ejecuta `sqlc generate` THEN genera código Go type-safe en `/internal/db/`
- [ ] GIVEN el router Chi configurado WHEN se registra un handler THEN responde en el path correcto con el método HTTP correcto
- [ ] GIVEN una petición con `Content-Type: application/json` inválido WHEN llega al router THEN retorna HTTP 400 con mensaje de error estructurado

**Reglas de Negocio**: N/A

**Notas Técnicas**: Estructura: `cmd/api/`, `internal/{handler,service,db,middleware}/`, `sql/{schema,queries}/`, `sqlc.yaml`. Middleware base: logging (zerolog), recovery, request-id. Chi con `r.Use()` para middleware global.

---

#### US-004: Pipeline CI básico

- **Título**: Configurar GitHub Actions para lint, test y build
- **Historia**: Como **Sistema**, quiero un pipeline de CI que valide el código en cada push, para detectar regresiones antes de que lleguen a producción.
- **Prioridad**: Media
- **Dependencias**: US-003

**Criterios de Aceptación**:
- [ ] GIVEN un push a cualquier branch WHEN GitHub Actions se ejecuta THEN corre `golangci-lint`, `go test ./...` y `go build ./...`
- [ ] GIVEN un test que falla WHEN el pipeline corre THEN el CI falla y no continúa al siguiente step
- [ ] GIVEN el pipeline en verde WHEN se hace push a `main` THEN se construye la imagen Docker y se publica en el registry configurado

**Reglas de Negocio**: N/A

**Notas Técnicas**: `.github/workflows/ci.yml`. Usar `actions/setup-go@v5`. Cache de módulos Go con `actions/cache`. Service container de Postgres para tests de integración. `golangci-lint` con config `.golangci.yml`.

---

#### US-005: Sistema de migraciones con golang-migrate

- **Título**: Gestionar el schema de la DB con migraciones versionadas
- **Historia**: Como **Sistema**, quiero que los cambios al schema de la base de datos estén versionados con migraciones, para poder aplicar y revertir cambios de forma controlada en todos los entornos.
- **Prioridad**: Alta
- **Dependencias**: US-002, US-003

**Criterios de Aceptación**:
- [ ] GIVEN migraciones pendientes al iniciar la API WHEN arranca el servidor THEN las migraciones se aplican automáticamente antes de aceptar requests
- [ ] GIVEN una migración con error de SQL WHEN se intenta aplicar THEN la migración falla, se hace rollback y la API no arranca
- [ ] GIVEN el schema en versión N WHEN se ejecuta `migrate down 1` THEN el schema vuelve al estado N-1 sin pérdida de estructura base

**Reglas de Negocio**: N/A

**Notas Técnicas**: `golang-migrate/migrate` embebido en el binario. Archivos en `sql/migrations/NNNN_descripcion.{up,down}.sql`. Primer migration incluye PostGIS extension y tablas base: `users`, `regions`.

---

### EPIC 01 — Autenticación y RBAC (Sprint 1)

#### US-006: Registro de jugador

- **Título**: Crear cuenta de jugador nuevo
- **Historia**: Como **Jugador**, quiero registrarme con mi email y una contraseña segura, para poder acceder a BlendPadel y comenzar el proceso de onboarding.
- **Prioridad**: Alta
- **Dependencias**: US-005

**Criterios de Aceptación**:
- [ ] GIVEN un email no registrado WHEN envío `POST /auth/register` con email, contraseña y nombre THEN se crea la cuenta y retorna HTTP 201 con el perfil básico (sin token)
- [ ] GIVEN un email ya registrado WHEN envío `POST /auth/register` THEN retorna HTTP 409 con mensaje `"email ya registrado"`
- [ ] GIVEN una contraseña de menos de 8 caracteres WHEN envío el registro THEN retorna HTTP 422 con detalle del error de validación
- [ ] GIVEN una contraseña sin mayúsculas o sin números WHEN envío el registro THEN retorna HTTP 422 indicando el requisito faltante
- [ ] GIVEN un registro exitoso WHEN consulto la DB THEN la contraseña está hasheada con bcrypt (cost ≥ 12) y nunca en texto plano

**Reglas de Negocio**: AU-01, PL-01, PL-02, TR-01

**Notas Técnicas**: `POST /auth/register`. Hash con `bcrypt` cost 12. Trust Score inicial 80. Estado inicial `calibration`. No se asigna `category` — queda nulo hasta completar onboarding (US-011). No retornar tokens en registro, forzar flujo de login.

---

#### US-007: Login y emisión de JWT

- **Título**: Autenticarse y obtener tokens de acceso
- **Historia**: Como **Jugador**, quiero iniciar sesión con mi email y contraseña, para obtener un token de acceso y poder usar la app de forma autenticada.
- **Prioridad**: Alta
- **Dependencias**: US-006

**Criterios de Aceptación**:
- [ ] GIVEN credenciales válidas WHEN envío `POST /auth/login` THEN retorna HTTP 200 con `access_token` (JWT, 1h) y `refresh_token` (opaco, 30d)
- [ ] GIVEN credenciales inválidas WHEN envío `POST /auth/login` THEN retorna HTTP 401 con mensaje genérico (no revelar cuál campo falló)
- [ ] GIVEN un access token válido WHEN lo incluyo en `Authorization: Bearer {token}` THEN el middleware lo verifica y inyecta el claim del usuario
- [ ] GIVEN un access token expirado WHEN lo uso en cualquier endpoint protegido THEN retorna HTTP 401 con código `"token_expired"`

**Reglas de Negocio**: AU-02

**Notas Técnicas**: `POST /auth/login`, `POST /auth/refresh`. JWT firmado con RS256 (par de claves RSA). Claims: `sub` (user_id), `role`, `region_id` (para moderadores), `exp`. Refresh token almacenado en tabla `refresh_tokens` (hash SHA-256, user_id, expires_at, revoked). Middleware Chi `jwtMiddleware`.

---

#### US-008: Renovación de tokens con refresh rotation

- **Título**: Renovar access token sin necesidad de re-login
- **Historia**: Como **Jugador**, quiero que mi sesión se renueve automáticamente cuando el access token vence, para no tener que iniciar sesión cada hora.
- **Prioridad**: Alta
- **Dependencias**: US-007

**Criterios de Aceptación**:
- [ ] GIVEN un refresh token válido WHEN envío `POST /auth/refresh` THEN retorna un nuevo `access_token` y un nuevo `refresh_token`, e invalida el anterior
- [ ] GIVEN un refresh token ya usado WHEN intento usarlo nuevamente THEN retorna HTTP 401 con código `"token_reused"` e invalida toda la familia de tokens del usuario (logout forzado)
- [ ] GIVEN un refresh token expirado (> 30 días) WHEN lo uso THEN retorna HTTP 401 con código `"token_expired"`
- [ ] GIVEN el usuario hace `POST /auth/logout` WHEN con su refresh token THEN el token queda marcado como revocado y no puede usarse más

**Reglas de Negocio**: AU-02, AU-05

**Notas Técnicas**: Token family invalidation: guardar `family_id` en cada refresh token. Al detectar reuso (token revocado usado), marcar toda la familia como revocada. `POST /auth/logout` requiere `Authorization: Bearer` + body con `refresh_token`.

---

#### US-009: Rate limiting en endpoints de autenticación

- **Título**: Proteger login contra fuerza bruta
- **Historia**: Como **Sistema**, quiero limitar los intentos de login fallidos por IP, para proteger las cuentas de ataques de fuerza bruta.
- **Prioridad**: Alta
- **Dependencias**: US-007

**Criterios de Aceptación**:
- [ ] GIVEN una IP que realiza 5 intentos de login fallidos en 15 minutos WHEN intenta el sexto THEN retorna HTTP 429 con header `Retry-After` indicando los segundos restantes
- [ ] GIVEN una IP bloqueada WHEN pasan los 15 minutos THEN puede volver a intentar login normalmente
- [ ] GIVEN un login exitoso WHEN ocurre THEN el contador de intentos fallidos de esa IP se resetea

**Reglas de Negocio**: AU-03

**Notas Técnicas**: Rate limiter en memoria (sync.Map o similar) con ventana deslizante. Para producción con múltiples instancias considerar Redis. Solo en `POST /auth/login` y `POST /auth/register`. Header `X-RateLimit-Remaining` en todas las respuestas del endpoint.

---

#### US-010: Middleware RBAC

- **Título**: Controlar acceso a endpoints según rol
- **Historia**: Como **Sistema**, quiero que cada endpoint valide el rol del usuario autenticado, para que los Jugadores no puedan acceder a funciones de Moderador o SuperAdmin.
- **Prioridad**: Alta
- **Dependencias**: US-007

**Criterios de Aceptación**:
- [ ] GIVEN un Jugador autenticado WHEN accede a `GET /admin/users` THEN retorna HTTP 403 con código `"forbidden"`
- [ ] GIVEN un Moderador WHEN accede a un endpoint de disputa de otra región THEN retorna HTTP 403 con código `"region_mismatch"`
- [ ] GIVEN un SuperAdmin WHEN accede a cualquier endpoint THEN tiene acceso sin restricción de región
- [ ] GIVEN un token sin claim de rol WHEN accede a endpoint protegido THEN retorna HTTP 401

**Reglas de Negocio**: AU-04

**Notas Técnicas**: Middleware Chi `RequireRole(roles ...string)` y `RequireRegion()`. El claim `region_id` en el JWT solo se incluye para Moderadores. Helpers: `IsAdmin(ctx)`, `IsModerator(ctx)`, `GetRegionID(ctx)`.

---

#### US-011: Cambio de contraseña autenticado

- **Título**: Actualizar contraseña desde perfil
- **Historia**: Como **Jugador**, quiero poder cambiar mi contraseña estando autenticado, para mantener la seguridad de mi cuenta.
- **Prioridad**: Media
- **Dependencias**: US-007

**Criterios de Aceptación**:
- [ ] GIVEN un usuario autenticado WHEN envía `PUT /auth/password` con `current_password` y `new_password` válidos THEN retorna HTTP 200 y la contraseña queda actualizada
- [ ] GIVEN `current_password` incorrecto WHEN envía el cambio THEN retorna HTTP 401 con `"contraseña actual incorrecta"`
- [ ] GIVEN `new_password` que no cumple requisitos de seguridad WHEN envía el cambio THEN retorna HTTP 422
- [ ] GIVEN cambio de contraseña exitoso WHEN ocurre THEN todos los refresh tokens del usuario quedan revocados (sesión única en el nuevo dispositivo)

**Reglas de Negocio**: AU-01, AU-05

**Notas Técnicas**: `PUT /auth/password`. Revocar todos los refresh tokens del usuario via `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`. No revocar el access token actual (es short-lived).

---

### EPIC 02 — Jugador y Onboarding (Sprint 1)

#### US-012: Cuestionario de onboarding anti-smoke

- **Título**: Determinar ELO inicial mediante cuestionario
- **Historia**: Como **Jugador** recién registrado, quiero completar un cuestionario sobre mi nivel de juego, para que el sistema me asigne un ELO inicial justo sin que yo pueda manipularlo.
- **Prioridad**: Alta
- **Dependencias**: US-006

**Criterios de Aceptación**:
- [ ] GIVEN un jugador recién registrado WHEN accede a la app THEN es redirigido al cuestionario antes de poder explorar cualquier otra sección
- [ ] GIVEN el cuestionario WHEN el jugador responde las 5 preguntas (frecuencia, torneos, tipo de paleta, nivel percibido, años jugando) THEN `POST /onboarding/questionnaire` retorna el ELO asignado y el estado `calibration`
- [ ] GIVEN respuestas inconsistentes (ej: "juego todos los días" + "nunca jugué torneos" + "nivel básico") WHEN el algoritmo las procesa THEN asigna el ELO conservadoramente (no el más alto posible)
- [ ] GIVEN el cuestionario completado WHEN se consulta el perfil THEN muestra `status: "calibration"` y ELO inicial asignado, sin aparecer en el ranking global

**Reglas de Negocio**: PL-01, PL-02, PL-03, TR-01

**Notas Técnicas**: `POST /onboarding/questionnaire`. Algoritmo de scoring: tabla de puntaje por respuesta → ELO_inicial = 1000 + delta (rango: 800–1400). No exponer el algoritmo al cliente. El estado `calibration` dura hasta 3 partidos validados (US-028).

---

#### US-013: Completar perfil de jugador

- **Título**: Actualizar datos personales del perfil
- **Historia**: Como **Jugador**, quiero actualizar mi perfil con nombre, ubicación y datos de contacto, para que otros jugadores puedan conocerme y el sistema pueda geolocalizar mis partidos.
- **Prioridad**: Alta
- **Dependencias**: US-006

**Criterios de Aceptación**:
- [ ] GIVEN un jugador autenticado WHEN envía `PUT /players/me` con nombre, apellido y coordenadas de ubicación THEN el perfil se actualiza y retorna HTTP 200
- [ ] GIVEN coordenadas geográficas válidas (lat/lng en rango de Mendoza) WHEN se guardan THEN se almacenan como `GEOGRAPHY(Point, 4326)` en la DB
- [ ] GIVEN coordenadas fuera de Argentina WHEN se intentan guardar THEN retorna HTTP 422 con `"ubicación fuera de zona de servicio"`
- [ ] GIVEN `GET /players/{id}` WHEN el perfil es público THEN retorna datos del jugador incluyendo zona aproximada (no coordenadas exactas) y Trust Score

**Reglas de Negocio**: PL-06

**Notas Técnicas**: `PUT /players/me`, `GET /players/{id}`. Validar bounds de coordenadas para Mendoza: lat [-35.5, -32.0], lng [-70.5, -67.5]. Para perfiles públicos, retornar zona (barrio/región) pero no coordenadas exactas. PostGIS para almacenamiento.

---

#### US-014: Upload de avatar

- **Título**: Subir foto de perfil
- **Historia**: Como **Jugador**, quiero subir una foto de perfil, para que los demás jugadores puedan reconocerme en el radar y el matchmaking.
- **Prioridad**: Media
- **Dependencias**: US-013

**Criterios de Aceptación**:
- [ ] GIVEN un jugador autenticado WHEN envía `POST /players/me/avatar` con un archivo JPG/PNG/WebP ≤ 5MB THEN el archivo se guarda en filesystem, se genera una URL pública y retorna HTTP 200 con la URL
- [ ] GIVEN un archivo mayor a 5MB WHEN se intenta subir THEN retorna HTTP 413 con mensaje de error
- [ ] GIVEN un formato de archivo no permitido (ej: PDF, GIF) WHEN se intenta subir THEN retorna HTTP 415
- [ ] GIVEN un avatar previo existente WHEN se sube uno nuevo THEN el anterior se elimina del filesystem

**Reglas de Negocio**: PL-04

**Notas Técnicas**: `POST /players/me/avatar`. Multipart form-data. Validar MIME type real (magic bytes), no solo extensión. Generar nombre único: `{user_id}_{timestamp}.{ext}`. Servir via Caddy con path `/static/avatars/`. Considerar redimensionar a 256x256 con `imaging` lib.

---

#### US-015: Consultar propio perfil completo

- **Título**: Ver panel de perfil personal
- **Historia**: Como **Jugador**, quiero ver mi propio perfil completo con ELO, Trust Score, historial de partidos y gráfico de evolución, para entender cómo estoy progresando en el ranking.
- **Prioridad**: Alta
- **Dependencias**: US-012, US-013

**Criterios de Aceptación**:
- [ ] GIVEN un jugador autenticado WHEN consulta `GET /players/me` THEN retorna: ELO exacto, Trust Score, rank posicional (si aplica), estado de calibración, zona geográfica
- [ ] GIVEN un jugador con ≥ 1 partido validado WHEN consulta su perfil THEN incluye historial de últimos 10 partidos con resultado, ELO antes/después y oponentes
- [ ] GIVEN un jugador en calibración WHEN consulta su perfil THEN muestra `"rank": null` y `"calibration_matches_remaining": N`
- [ ] GIVEN el perfil WHEN incluye historial THEN cada partido muestra delta ELO (ej: +12, -8)

**Reglas de Negocio**: PL-02, PL-06, RK-04

**Notas Técnicas**: `GET /players/me`. Incluir subconsulta para últimos 10 partidos con JOIN a `match_players` y `matches`. Calcular rank via `RANK()` window function o query separada. ELO graph data: array de `{match_id, date, elo_after}`.

---

### EPIC 03 — Motor ELO y Trust Score (Sprint 2)

#### US-016: Cálculo de probabilidad esperada E

- **Título**: Calcular probabilidad esperada de victoria entre equipos
- **Historia**: Como **Sistema**, quiero calcular la probabilidad esperada de victoria de cada equipo basándome en los ELOs promedios, para que el ajuste de puntos sea justo independientemente del nivel de los rivales.
- **Prioridad**: Alta
- **Dependencias**: US-012

**Criterios de Aceptación**:
- [ ] GIVEN equipo A con ELO promedio 1200 y equipo B con ELO promedio 1200 WHEN se calcula E THEN E = 0.50 para ambos equipos
- [ ] GIVEN equipo A con ELO 1400 y equipo B con ELO 1000 WHEN se calcula E THEN E_A ≈ 0.909, E_B ≈ 0.091
- [ ] GIVEN cualquier par de ELOs WHEN se calcula E THEN E_A + E_B = 1.0 (suma exacta)
- [ ] GIVEN cálculo de E en un partido de 4 jugadores WHEN se ejecuta THEN usa el promedio ELO de cada pareja como representación del equipo

**Reglas de Negocio**: RK-02

**Notas Técnicas**: Función pura Go: `CalcExpected(eloOwn, eloRival float64) float64`. ELO del equipo = promedio de los 2 jugadores. Formula: `1.0 / (1.0 + math.Pow(10, (eloRival-eloOwn)/400))`. Cubrir con unit tests exhaustivos (tabla de casos).

---

#### US-017: Cálculo del multiplicador por margen de victoria M

- **Título**: Aplicar bonus por margen de victoria al cálculo ELO
- **Historia**: Como **Sistema**, quiero multiplicar el delta ELO según la diferencia de games, para que una victoria amplia valga más que una victoria ajustada.
- **Prioridad**: Alta
- **Dependencias**: US-016

**Criterios de Aceptación**:
- [ ] GIVEN diferencia de games ≤ 2 WHEN se calcula M THEN M = 1.0
- [ ] GIVEN diferencia de games entre 3 y 4 WHEN se calcula M THEN M = 1.2
- [ ] GIVEN diferencia de games ≥ 5 WHEN se calcula M THEN M = 1.5
- [ ] GIVEN un partido 6-4, 6-3 (diferencia total: 5 games) WHEN se calcula M THEN M = 1.5
- [ ] GIVEN un partido 7-6, 6-5 (diferencia total: 2 games) WHEN se calcula M THEN M = 1.0

**Reglas de Negocio**: RK-03, MA-02

**Notas Técnicas**: Función pura: `CalcMarginMultiplier(setsWon, setsLost int, gamesWon, gamesLost int) float64`. Diferencia = (games_ganados - games_perdidos) sobre todos los sets. Cubrir con tests de tabla.

---

#### US-018: Cálculo y aplicación del ELO post-partido

- **Título**: Actualizar ELO de los 4 jugadores al sellar un partido
- **Historia**: Como **Sistema**, quiero calcular y aplicar el nuevo ELO a los 4 jugadores cuando un partido es validado o auto-sellado, para que el ranking refleje el resultado real.
- **Prioridad**: Alta
- **Dependencias**: US-016, US-017

**Criterios de Aceptación**:
- [ ] GIVEN un partido sellado WHEN el sistema procesa el resultado THEN calcula nuevo ELO para los 4 jugadores aplicando `ELO_new = ELO_current + K * (R - E) * M`
- [ ] GIVEN un jugador con menos de 5 partidos validados WHEN se calcula su ELO THEN usa K=60
- [ ] GIVEN un jugador con 5 o más partidos validados WHEN se calcula su ELO THEN usa K=20
- [ ] GIVEN el ELO calculado WHEN se aplica THEN se guarda en `players.elo` y se registra en `elo_history` con el `match_id` y `delta`
- [ ] GIVEN un jugador en freeze (disputa sistemática) WHEN se procesa el resultado de otro partido THEN su ELO NO se actualiza

**Reglas de Negocio**: RK-01, RK-02, RK-03, MA-05, MA-07

**Notas Técnicas**: Función `ApplyELO(matchID uuid.UUID)` en `elo_service.go`. Transacción DB: update `players.elo` + insert `elo_history`. Tabla `elo_history`: `(id, player_id, match_id, elo_before, elo_after, delta, created_at)`. Check de freeze en `players.elo_frozen`.

---

#### US-019: Cálculo del Trust Score — penalización por cancelación

- **Título**: Penalizar cancelaciones tardías en el Trust Score
- **Historia**: Como **Sistema**, quiero reducir el Trust Score de un jugador que cancela con menos de 2 horas de anticipación, para que los jugadores comprometidos no sean perjudicados por cancelaciones de último momento.
- **Prioridad**: Alta
- **Dependencias**: US-012

**Criterios de Aceptación**:
- [ ] GIVEN un jugador confirmado en un partido WHEN cancela con más de 2 horas de anticipación THEN Trust Score no se modifica
- [ ] GIVEN un jugador confirmado en un partido WHEN cancela con menos de 2 horas de anticipación THEN Trust Score -10 puntos
- [ ] GIVEN el Trust Score en 15 WHEN ocurre una penalización de 10 THEN queda en 5 (no puede ser negativo, mínimo 0)
- [ ] GIVEN la penalización aplicada WHEN se consulta el historial de Trust Score del jugador THEN aparece el evento con tipo `"late_cancellation"`, timestamp y puntos descontados

**Reglas de Negocio**: TR-02

**Notas Técnicas**: Tabla `trust_events`: `(id, player_id, event_type, delta, reason, created_at)`. Calcular Trust Score como suma de `players.trust_score_base + SUM(trust_events.delta)` o mantener desnormalizado. Al cancelar, verificar `now() > match.scheduled_at - 2h`.

---

#### US-020: Cálculo del Trust Score — penalización por disputa

- **Título**: Penalizar disputas sistemáticas en el Trust Score
- **Historia**: Como **Sistema**, quiero penalizar a los jugadores que generan disputas repetidas, para desincentivar la impugnación maliciosa de resultados.
- **Prioridad**: Alta
- **Dependencias**: US-019

**Criterios de Aceptación**:
- [ ] GIVEN un jugador que disputa un resultado por primera vez en 30 días WHEN ocurre THEN Trust Score -5 puntos (primera disputa, menos severa)
- [ ] GIVEN un jugador que ya disputó en los últimos 30 días WHEN disputa nuevamente THEN Trust Score -20 puntos para ambos jugadores involucrados y ELO freeze
- [ ] GIVEN un jugador que recibe un reporte de mala conducta validado WHEN el Moderador confirma THEN Trust Score -15 puntos
- [ ] GIVEN el Trust Score cayendo a 69 o menos WHEN ocurre THEN se emite evento `trust_threshold_crossed` (para trigger de push notification US-053)

**Reglas de Negocio**: TR-03, TR-04, TR-05, MA-04, MA-05

**Notas Técnicas**: Al sellar una disputa, verificar `COUNT(disputes WHERE player_id = X AND created_at > now()-30d) >= 1` para determinar si es sistemática. El freeze se implementa como `players.elo_frozen = true` + `players.elo_frozen_until` (ej: 7 días). Emitir evento interno para notificaciones.

---

#### US-021: Recuperación gradual del Trust Score

- **Título**: Recuperar Trust Score por buena conducta sostenida
- **Historia**: Como **Jugador**, quiero que mi Trust Score suba lentamente cuando completo partidos sin incidentes, para poder rehabilitarme si tuve un mal período y volver a aparecer en el radar de jugadores serios.
- **Prioridad**: Media
- **Dependencias**: US-019

**Criterios de Aceptación**:
- [ ] GIVEN un partido completado sin disputas ni cancelaciones WHEN es validado THEN el Trust Score del jugador sube +2 puntos
- [ ] GIVEN un jugador que ya recuperó 10 puntos en el mes calendario actual WHEN completa otro partido THEN el Trust Score NO sube (cap mensual alcanzado)
- [ ] GIVEN un Trust Score en 100 WHEN se intenta sumar puntos THEN queda en 100 (cap absoluto)
- [ ] GIVEN la recuperación aplicada WHEN se consulta historial THEN aparece evento `"match_completed"` con `delta: +2`

**Reglas de Negocio**: TR-06

**Notas Técnicas**: Hook post-validación de partido. Verificar cap mensual via `SUM(delta) WHERE event_type='match_completed' AND created_at >= inicio_del_mes`. Calcular `inicio_del_mes` como primer día del mes en UTC-3 (Mendoza, Argentina Standard Time).

---

#### US-022: Visibilidad condicionada por Trust Score

- **Título**: Ocultar jugadores con bajo Trust Score del radar y matchmaking
- **Historia**: Como **Jugador** con Trust Score ≥ 70, quiero que los jugadores poco confiables no aparezcan en mi radar ni en el matchmaking, para no perder tiempo coordinando partidos que van a cancelarse o disputarse.
- **Prioridad**: Alta
- **Dependencias**: US-020

**Criterios de Aceptación**:
- [ ] GIVEN un jugador con Trust Score 65 WHEN otro jugador con Trust Score 80 consulta el radar THEN el jugador con score 65 NO aparece en los resultados
- [ ] GIVEN un jugador con Trust Score 65 WHEN otro jugador con Trust Score 60 consulta el radar THEN el jugador con score 65 SÍ aparece (ambos por debajo del umbral)
- [ ] GIVEN un jugador que sube su Trust Score de 68 a 71 WHEN consulta el radar THEN puede ver jugadores con Trust ≥ 70 nuevamente
- [ ] GIVEN el filtro de visibilidad WHEN se aplica THEN es transparente: el jugador oculto no sabe que está oculto para ciertos usuarios

**Reglas de Negocio**: PL-05, TR-05

**Notas Técnicas**: Cláusula WHERE en queries de radar y matchmaking: `(trust_score >= 70 AND requester.trust_score >= 70) OR (requester.trust_score < 70)`. Equivalente: `LEAST(requester.trust_score, 70) <= player.trust_score`. Verificar con tests de integración.

---

### EPIC 04 — Partidos y Validación Cruzada (Sprint 2)

#### US-023: Crear partido

- **Título**: Registrar un partido con sus 4 jugadores
- **Historia**: Como **Capitán**, quiero crear un partido especificando los 4 jugadores, la cancha y el horario, para poder luego cargar el resultado y que el sistema actualice el ranking.
- **Prioridad**: Alta
- **Dependencias**: US-012, US-013

**Criterios de Aceptación**:
- [ ] GIVEN un jugador autenticado WHEN envía `POST /matches` con 4 `player_id`s, coordenadas de cancha, fecha/hora y `my_team` (indicando su pareja) THEN se crea el partido con estado `pending_result` y retorna HTTP 201 con `match_id`
- [ ] GIVEN `player_id`s duplicados en la misma petición WHEN se crea el partido THEN retorna HTTP 422 con `"no puede haber jugadores repetidos"`
- [ ] GIVEN algún `player_id` inexistente WHEN se crea el partido THEN retorna HTTP 404 indicando cuál jugador no existe
- [ ] GIVEN un partido creado WHEN se consulta THEN muestra: id, equipos, cancha (coordenadas), scheduled_at, estado, capitán (quien creó)

**Reglas de Negocio**: MA-01, MA-06

**Notas Técnicas**: `POST /matches`. Tabla `matches`: `(id, status, scheduled_at, location GEOGRAPHY(Point,4326), captain_a_id, captain_b_id, created_at)`. Tabla `match_players`: `(match_id, player_id, team [A/B])`. El creador es `captain_a`. `captain_b` es el capitán del equipo contrario (el primer jugador del equipo B).

---

#### US-024: Cargar resultado de partido

- **Título**: Registrar el marcador de un partido jugado
- **Historia**: Como **Capitán A**, quiero cargar el resultado del partido con los sets y games de cada equipo, para que el sistema pueda calcular el ELO y actualizar el ranking.
- **Prioridad**: Alta
- **Dependencias**: US-023

**Criterios de Aceptación**:
- [ ] GIVEN un partido en estado `pending_result` WHEN el Capitán A envía `POST /matches/{id}/result` con sets: `[{team_a: 6, team_b: 4}, {team_a: 7, team_b: 5}]` THEN el partido pasa a estado `awaiting_confirmation` y retorna HTTP 200
- [ ] GIVEN un resultado cargado WHEN el estado cambia a `awaiting_confirmation` THEN el sistema dispara notificación push al Capitán B (evento para US-050)
- [ ] GIVEN un jugador que NO es capitán del partido WHEN intenta cargar resultado THEN retorna HTTP 403
- [ ] GIVEN un formato de sets inválido (ej: sets incompletos, games negativos) WHEN se envía THEN retorna HTTP 422 con detalle del error
- [ ] GIVEN un partido ya en estado `sealed` o `disputed` WHEN se intenta cargar resultado THEN retorna HTTP 409 con `"resultado ya procesado"`

**Reglas de Negocio**: MA-02, MA-03

**Notas Técnicas**: `POST /matches/{id}/result`. Tabla `match_results`: `(match_id, sets JSONB, winner_team, total_games_a, total_games_b, submitted_by, submitted_at)`. Calcular `winner_team` y `game_diff` al momento de cargar. Trigger o job para auto-seal (US-026).

---

#### US-025: Validación cruzada — confirmación por Capitán B

- **Título**: Aceptar o disputar el resultado cargado por el Capitán A
- **Historia**: Como **Capitán B**, quiero poder confirmar o disputar el resultado dentro de las 6 horas, para asegurar que el resultado registrado sea el real y proteger mi ELO.
- **Prioridad**: Alta
- **Dependencias**: US-024

**Criterios de Aceptación**:
- [ ] GIVEN un partido en `awaiting_confirmation` WHEN el Capitán B envía `POST /matches/{id}/confirm` THEN el partido pasa a `sealed`, se dispara el cálculo ELO y retorna HTTP 200
- [ ] GIVEN un partido en `awaiting_confirmation` WHEN el Capitán B envía `POST /matches/{id}/dispute` con motivo THEN el partido pasa a `disputed`, ambos ELOs se freezan y retorna HTTP 200
- [ ] GIVEN el partido en `awaiting_confirmation` WHEN pasaron menos de 6 horas THEN el endpoint de confirmación/disputa está disponible
- [ ] GIVEN el partido en `awaiting_confirmation` WHEN pasaron más de 6 horas sin acción THEN el endpoint retorna HTTP 409 con `"ventana de validación cerrada, resultado sellado automáticamente"`

**Reglas de Negocio**: MA-03, MA-04

**Notas Técnicas**: `POST /matches/{id}/confirm`, `POST /matches/{id}/dispute`. Verificar `now() < result.submitted_at + 6h`. Al disputar: `UPDATE players SET elo_frozen = true WHERE id IN (captain_a_id, captain_b_id)`. Registrar en tabla `disputes`: `(match_id, raised_by, reason, status, created_at)`.

---

#### US-026: Auto-sellado de partidos sin objeción

- **Título**: Sellar automáticamente resultados no objetados tras 6 horas
- **Historia**: Como **Sistema**, quiero sellar automáticamente los resultados que no fueron objetados en 6 horas, para que el flujo de ranking no se bloquee por inacción del Capitán B.
- **Prioridad**: Alta
- **Dependencias**: US-024

**Criterios de Aceptación**:
- [ ] GIVEN un partido en `awaiting_confirmation` por más de 6 horas sin acción del Capitán B WHEN el job periódico corre THEN el partido pasa a `sealed` y se dispara el cálculo ELO
- [ ] GIVEN múltiples partidos pendientes WHEN el job corre THEN procesa todos los que cumplieron las 6 horas en esa ejecución
- [ ] GIVEN un partido ya `sealed` o `disputed` WHEN el job lo encuentra THEN lo ignora sin error
- [ ] GIVEN el auto-sellado WHEN ocurre THEN el evento queda registrado con `sealed_by: "auto"` en el partido

**Reglas de Negocio**: MA-03, MA-07

**Notas Técnicas**: Job con ticker en goroutine cada 5 minutos. Query: `SELECT * FROM matches WHERE status = 'awaiting_confirmation' AND result_submitted_at < now() - interval '6 hours'`. Llamar a `ApplyELO(matchID)` por cada partido encontrado. Loggear cada auto-sellado.

---

#### US-027: Resolución de disputa por Moderador

- **Título**: Auditar y resolver un partido en disputa
- **Historia**: Como **Moderador**, quiero revisar los detalles de una disputa y dictar el resultado definitivo, para que el ELO se aplique de forma justa y los jugadores de mala fe sean penalizados.
- **Prioridad**: Alta
- **Dependencias**: US-025, US-010

**Criterios de Aceptación**:
- [ ] GIVEN un partido en estado `disputed` en su región WHEN el Moderador consulta `GET /admin/disputes` THEN ve la lista de disputas pendientes de su región con detalles del partido y motivos
- [ ] GIVEN una disputa WHEN el Moderador envía `POST /admin/disputes/{id}/resolve` con el resultado correcto y `penalize_player_id` (opcional) THEN el partido pasa a `sealed`, se aplica ELO con el resultado auditado y el Trust Score del jugador penalizado baja -15
- [ ] GIVEN la resolución WHEN incluye penalización THEN la penalización queda registrada en `trust_events` con referencia al `dispute_id` y `moderated_by`
- [ ] GIVEN un Moderador intentando resolver una disputa fuera de su `region_id` WHEN envía la resolución THEN retorna HTTP 403 con `"region_mismatch"`

**Reglas de Negocio**: MA-04, MA-05, TR-03, AD-04

**Notas Técnicas**: `GET /admin/disputes?status=pending`, `POST /admin/disputes/{id}/resolve`. Desfreeze del ELO: `UPDATE players SET elo_frozen = false WHERE id IN (...)`. Registrar `resolved_by`, `resolved_at` en tabla `disputes`. Middleware `RequireRegion()` aplicado.

---

#### US-028: Egreso del estado de calibración

- **Título**: Publicar jugador en ranking global al completar calibración
- **Historia**: Como **Sistema**, quiero que un jugador salga del estado de calibración y aparezca en el ranking global una vez que complete 3 partidos validados, para asegurar que el ELO inicial sea representativo antes de exponerlo públicamente.
- **Prioridad**: Alta
- **Dependencias**: US-018, US-026

**Criterios de Aceptación**:
- [ ] GIVEN un jugador con 2 partidos validados WHEN se sella el tercer partido THEN el estado cambia de `calibration` a `active` y el jugador aparece en el ranking global
- [ ] GIVEN un jugador en calibración WHEN se consulta el ranking global `GET /rankings` THEN NO aparece en los resultados
- [ ] GIVEN el egreso de calibración WHEN ocurre THEN el jugador recibe una push notification informando que ya aparece en el ranking
- [ ] GIVEN un jugador activo WHEN se consulta el ranking THEN aparece con su ELO, zona y número de partidos jugados

**Reglas de Negocio**: PL-02, RK-04

**Notas Técnicas**: Al aplicar ELO post-partido, contar `validated_match_count` del jugador. Si llega a 3 y `status = 'calibration'` → `UPDATE players SET status = 'active'`. Emitir evento para notificación push (US-052). La query de ranking filtra `WHERE status = 'active'`.

---

#### US-029: Historial de partidos de un jugador

- **Título**: Consultar partidos jugados por un jugador
- **Historia**: Como **Jugador**, quiero consultar el historial de partidos de otro jugador antes de desafiarlo, para evaluar su nivel real más allá del ELO.
- **Prioridad**: Media
- **Dependencias**: US-023, US-018

**Criterios de Aceptación**:
- [ ] GIVEN el `player_id` de un jugador WHEN consulto `GET /players/{id}/matches?limit=10` THEN retorna sus últimos 10 partidos con: fecha, resultado, oponentes, delta ELO, estado del partido
- [ ] GIVEN un jugador en calibración WHEN consulto su historial THEN los partidos aparecen pero marcados como `"calibración"` en el contexto del ranking
- [ ] GIVEN paginación WHEN consulto con `?page=2&limit=10` THEN retorna los partidos 11-20 cronológicamente

**Reglas de Negocio**: PL-06

**Notas Técnicas**: `GET /players/{id}/matches`. JOIN entre `matches`, `match_players`, `match_results`, `elo_history`. Paginar con cursor o offset. Filtrar partidos `status = 'sealed'` (no mostrar disputados pendientes).

---

### EPIC 05 — Radar (Tab 1) (Sprint 3)

#### US-030: Mapa de partidos activos en zona

- **Título**: Ver partidos buscando jugadores cerca del usuario
- **Historia**: Como **Jugador**, quiero ver en un mapa los partidos incompletos de hoy que están cerca de mi ubicación, para sumarme rápidamente a un partido sin demasiada coordinación previa.
- **Prioridad**: Alta
- **Dependencias**: US-022, US-023

**Criterios de Aceptación**:
- [ ] GIVEN un jugador autenticado con ubicación configurada WHEN consulta `GET /radar/matches` THEN retorna partidos con estado `open` o `pending_players` a ≤ 10km, ordenados por distancia
- [ ] GIVEN la respuesta del radar WHEN se renderiza THEN cada partido incluye: coordenadas para el pin, número de jugadores faltantes, ELO promedio del partido y hora programada
- [ ] GIVEN un jugador con Trust Score < 70 WHEN consulta el radar THEN no ve partidos de jugadores con Trust ≥ 70 (filtro bidireccional)
- [ ] GIVEN radio configurable en el perfil WHEN el jugador lo cambia a 5km THEN el radar solo muestra partidos en ese radio

**Reglas de Negocio**: PL-05, TR-05, MA-06

**Notas Técnicas**: `GET /radar/matches?lat={}&lng={}&radius_km={}`. PostGIS: `ST_DWithin(matches.location::geography, ST_MakePoint($lng, $lat)::geography, $radius_m)`. Índice GIST en `matches.location`. Retornar GeoJSON o array con lat/lng para el frontend.

---

#### US-031: Alertas urgentes en el radar

- **Título**: Ver alertas de partidos que necesitan jugadores con urgencia
- **Historia**: Como **Jugador**, quiero ver alertas destacadas cuando un partido cercano necesita jugadores con menos de 1 hora para comenzar, para poder reaccionar rápido y completar el partido.
- **Prioridad**: Media
- **Dependencias**: US-030

**Criterios de Aceptación**:
- [ ] GIVEN partidos con estado `open` a ≤ 5km WHEN faltan ≤ 60 minutos para el horario THEN aparecen en la sección "Alertas Urgentes" del radar con badge rojo
- [ ] GIVEN una alerta urgente WHEN el jugador la toca THEN navega al detalle del partido con opción de unirse
- [ ] GIVEN que un partido ya completó sus 4 jugadores WHEN se refresca el radar THEN desaparece de las alertas urgentes
- [ ] GIVEN el endpoint de alertas WHEN se consulta THEN está limitado a los 5 partidos más urgentes más cercanos

**Reglas de Negocio**: MA-06

**Notas Técnicas**: `GET /radar/alerts`. Query: partidos `open` con `scheduled_at BETWEEN now() AND now() + interval '1 hour'` y `ST_DWithin` para radio 5km. LIMIT 5, ORDER BY scheduled_at ASC. Polling del cliente cada 2 minutos o via WebSocket (futuro).

---

#### US-032: Filtrar radar por rango ELO

- **Título**: Limitar el radar a partidos de mi nivel
- **Historia**: Como **Jugador**, quiero filtrar los partidos del radar por rango ELO, para no aparecer en partidos donde el nivel de juego sea muy diferente al mío.
- **Prioridad**: Media
- **Dependencias**: US-030

**Criterios de Aceptación**:
- [ ] GIVEN un jugador con ELO 1200 WHEN consulta el radar sin filtros THEN ve todos los partidos en su zona
- [ ] GIVEN el filtro por defecto WHEN no se especifica rango THEN el backend aplica ±200 ELO como rango sugerido
- [ ] GIVEN el jugador ajusta el filtro a `elo_min=1000&elo_max=1300` WHEN consulta THEN solo ve partidos cuyo ELO promedio esté en ese rango
- [ ] GIVEN el filtro activo WHEN no hay resultados THEN retorna array vacío con mensaje `"No hay partidos en tu zona para este rango ELO"`

**Reglas de Negocio**: RK-01

**Notas Técnicas**: Parámetros opcionales `elo_min` y `elo_max` en `GET /radar/matches`. ELO promedio del partido calculado al crearlo y almacenado en `matches.avg_elo`. Si no se envían parámetros, aplicar `player.elo ± 200` por defecto.

---

### EPIC 06 — Matchmaking (Tab 2) (Sprint 3)

#### US-033: Crear flare de desafío en el muro de matchmaking

- **Título**: Publicar búsqueda de rivales en el muro
- **Historia**: Como **Jugador**, quiero publicar una búsqueda de partido en el muro de matchmaking con mi disponibilidad horaria y zona, para que otros jugadores del nivel adecuado me encuentren y desafíen.
- **Prioridad**: Alta
- **Dependencias**: US-013, US-022

**Criterios de Aceptación**:
- [ ] GIVEN un jugador activo WHEN envía `POST /matchmaking/flares` con fecha, hora, zona y tipo de partido (singles imposible, siempre dobles) THEN se crea el flare y retorna HTTP 201
- [ ] GIVEN un flare creado WHEN se publica THEN es visible para jugadores a ≤ 15km con ELO ±300 del autor
- [ ] GIVEN un jugador que ya tiene un flare activo WHEN intenta crear otro THEN retorna HTTP 409 con `"ya tenés un flare activo"`
- [ ] GIVEN un flare sin respuesta después de 24 horas WHEN el sistema lo revisa THEN se archiva automáticamente con estado `expired`

**Reglas de Negocio**: PL-05, MA-01

**Notas Técnicas**: `POST /matchmaking/flares`. Tabla `matchmaking_flares`: `(id, player_id, scheduled_at, location, message, status, expires_at, created_at)`. Status: `active`, `matched`, `expired`. Job de expiración similar al de auto-sellado. Filtros en `GET /matchmaking/flares`: geolocalización + ELO range.

---

#### US-034: Consultar muro de desafíos filtrado

- **Título**: Ver flares de matchmaking disponibles según nivel y distancia
- **Historia**: Como **Jugador**, quiero ver el muro de desafíos filtrado automáticamente por mi ELO y distancia, para encontrar rivales adecuados sin tener que configurar filtros manualmente.
- **Prioridad**: Alta
- **Dependencias**: US-033

**Criterios de Aceptación**:
- [ ] GIVEN un jugador autenticado WHEN consulta `GET /matchmaking/flares` THEN retorna flares de jugadores a ≤ 15km con ELO ±300, ordenados por proximidad
- [ ] GIVEN flares en el muro WHEN se muestran THEN incluyen: nombre del jugador, ELO, zona, horario propuesto, Trust Score del jugador (icono de confianza)
- [ ] GIVEN el filtro de Trust Score activo WHEN el jugador tiene Trust ≥ 70 THEN no ve flares de jugadores con Trust < 70
- [ ] GIVEN filtros manuales adicionales `?elo_min=&elo_max=&radius_km=` WHEN se aplican THEN sobreescriben los defaults

**Reglas de Negocio**: PL-05, TR-05

**Notas Técnicas**: `GET /matchmaking/flares`. Combinar filtro PostGIS + filtro ELO + filtro Trust Score. Incluir avatar_url en respuesta. Paginación con cursor por `created_at`.

---

#### US-035: Aceptar desafío y coordinar partido

- **Título**: Responder un flare y convertirlo en partido
- **Historia**: Como **Jugador**, quiero responder a un flare de desafío para proponer mi pareja y armar el partido de 4, para que el sistema registre el partido y luego podamos cargar el resultado.
- **Prioridad**: Alta
- **Dependencias**: US-033, US-034, US-023

**Criterios de Aceptación**:
- [ ] GIVEN un flare activo WHEN envío `POST /matchmaking/flares/{id}/respond` con `partner_id` y confirmación de horario THEN se crea el partido automáticamente con los 4 jugadores y el flare pasa a `matched`
- [ ] GIVEN una respuesta exitosa WHEN ocurre THEN ambos creadores del flare reciben push notification con los detalles del partido
- [ ] GIVEN `partner_id` igual al jugador que responde WHEN se envía THEN retorna HTTP 422 con `"no podés ser tu propia pareja"`
- [ ] GIVEN el creador del flare WHEN quiere cancelar antes de recibir respuesta THEN puede enviar `DELETE /matchmaking/flares/{id}` y el flare se archiva

**Reglas de Negocio**: MA-01, MA-06

**Notas Técnicas**: `POST /matchmaking/flares/{id}/respond`. Transacción: crear partido (`matches`) + actualizar flare status. El creador del flare es `captain_a`, el respondedor es `captain_b`. Validar que ninguno de los 4 jugadores tenga partido activo solapado en el mismo horario.

---

### EPIC 07 — Rankings (Tab 3) (Sprint 3)

#### US-036: Ranking global por zona

- **Título**: Ver tabla de posiciones hiperlocal
- **Historia**: Como **Jugador**, quiero ver el ranking de los mejores jugadores en mi zona, para saber mi posición relativa y descubrir con quién competir para subir.
- **Prioridad**: Alta
- **Dependencias**: US-018, US-028

**Criterios de Aceptación**:
- [ ] GIVEN un jugador autenticado WHEN consulta `GET /rankings?zone_id=zona_este&limit=10` THEN retorna los top 10 jugadores de esa zona con: posición, nombre, ELO, partidos jugados y Trust Score icon
- [ ] GIVEN el ranking WHEN se consulta THEN solo incluye jugadores con `status = 'active'` (≥ 3 partidos validados)
- [ ] GIVEN el propio jugador en el ranking WHEN aparece THEN su fila está destacada (campo `is_current_user: true` en la respuesta)
- [ ] GIVEN un jugador que no está en el top 10 WHEN consulta el ranking THEN la respuesta incluye su posición exacta en un campo `current_user_rank`

**Reglas de Negocio**: PL-02, RK-04, RK-05

**Notas Técnicas**: `GET /rankings`. Parámetros: `zone_id` (región PostGIS), `limit`, `offset`. Query con `RANK() OVER (ORDER BY elo DESC)` o materializar ranking en tabla `ranking_snapshots` actualizada cada 5 minutos. Incluir siempre la posición del usuario autenticado aunque no esté en el top N.

---

#### US-037: Definir zonas hiperlocales de Mendoza

- **Título**: Configurar regiones geográficas del ranking
- **Historia**: Como **SuperAdmin**, quiero definir las zonas del ranking (Zona Este, Zona Oeste, Gran Mendoza, etc.) como polígonos en la base de datos, para que los rankings reflejen la comunidad local de cada barrio.
- **Prioridad**: Alta
- **Dependencias**: US-005, US-010

**Criterios de Aceptación**:
- [ ] GIVEN el SuperAdmin autenticado WHEN envía `POST /admin/regions` con nombre, descripción y polígono GeoJSON THEN se crea la región y retorna HTTP 201
- [ ] GIVEN una ubicación de jugador WHEN se actualiza THEN se asocia automáticamente a la región cuyo polígono la contiene via `ST_Contains`
- [ ] GIVEN un jugador en la frontera entre regiones WHEN se asigna THEN se asocia a la región más pequeña que lo contiene
- [ ] GIVEN `GET /regions` WHEN se consulta sin autenticación THEN retorna la lista de regiones públicas con nombre y GeoJSON simplificado

**Reglas de Negocio**: AD-03, RK-05

**Notas Técnicas**: Tabla `regions`: `(id, name, description, boundary GEOGRAPHY(Polygon, 4326), created_by, created_at)`. `ST_Contains(region.boundary, player.location)`. Si un jugador cae en múltiples regiones, elegir la de menor área: `ORDER BY ST_Area(boundary) ASC LIMIT 1`. Datos seed de regiones de Mendoza incluidos en migración.

---

#### US-038: Proyección de puntos antes de aceptar un partido

- **Título**: Ver cuánto ELO se gana o pierde antes de confirmar
- **Historia**: Como **Jugador**, quiero ver la proyección de puntos ELO que ganaría o perdería si juego contra un equipo específico, para tomar una decisión informada sobre si acepto el desafío.
- **Prioridad**: Media
- **Dependencias**: US-016, US-017

**Criterios de Aceptación**:
- [ ] GIVEN los IDs de los 4 jugadores WHEN consulto `GET /matches/projection?team_a={id1},{id2}&team_b={id3},{id4}` THEN retorna delta ELO proyectado para cada jugador en caso de victoria y en caso de derrota
- [ ] GIVEN la proyección WHEN se calcula THEN usa los ELOs actuales y calcula E con la fórmula estándar, asumiendo M=1.0 (sin margen conocido)
- [ ] GIVEN la proyección WHEN se muestra THEN incluye: `if_win: +X`, `if_lose: -Y` para cada jugador
- [ ] GIVEN un jugador en calibración (K=60) WHEN se proyecta THEN los deltas reflejan el K=60 correcto

**Reglas de Negocio**: RK-01, RK-02, RK-03, RK-06

**Notas Técnicas**: `GET /matches/projection`. Endpoint público (requiere autenticación). Cálculo en memoria, sin tocar DB de ELOs (solo lectura). Retornar: `{player_id, current_elo, if_win, if_lose}` para cada jugador. Documentar que M=1.0 es asumido en proyección.

---

#### US-039: Ranking histórico personal (evolución de ELO)

- **Título**: Ver la curva de progresión de ELO propia
- **Historia**: Como **Jugador**, quiero ver cómo evolucionó mi ELO a lo largo del tiempo en un gráfico, para entender si estoy mejorando, estancado, o en caída.
- **Prioridad**: Media
- **Dependencias**: US-018, US-015

**Criterios de Aceptación**:
- [ ] GIVEN el jugador autenticado WHEN consulta `GET /players/me/elo-history` THEN retorna array de `{date, elo_after, match_id, opponent_names}` cronológico
- [ ] GIVEN el historial WHEN contiene ≥ 1 entrada THEN el primer punto muestra el ELO inicial post-onboarding
- [ ] GIVEN un rango de fechas `?from=&to=` WHEN se aplica THEN retorna solo las entradas en ese período
- [ ] GIVEN el gráfico en la app WHEN se renderiza THEN muestra línea temporal con puntos clickeables que llevan al detalle del partido

**Reglas de Negocio**: RK-01, PL-06

**Notas Técnicas**: `GET /players/me/elo-history`. Query sobre tabla `elo_history` con JOIN a `matches` y `match_players`. Incluir nombres de oponentes para contexto. Máximo 100 puntos por request, paginar hacia atrás con cursor.

---

### EPIC 08 — Perfil (Tab 4) (Sprint 3)

#### US-040: Ver perfil público de otro jugador

- **Título**: Consultar el perfil completo de un rival
- **Historia**: Como **Jugador**, quiero ver el perfil público de otro jugador antes de desafiarlo, para evaluar su ELO real, Trust Score y resultados recientes.
- **Prioridad**: Alta
- **Dependencias**: US-015, US-029

**Criterios de Aceptación**:
- [ ] GIVEN el ID de un jugador WHEN consulto `GET /players/{id}` THEN retorna: nombre, ELO, posición en ranking zonal, Trust Score (icono/nivel), zona aproximada, últimos 5 partidos con resultados
- [ ] GIVEN un jugador en calibración WHEN se consulta su perfil THEN muestra `"rank": "En calibración"` en lugar de posición numérica
- [ ] GIVEN un jugador baneado (soft ban) WHEN se consulta su perfil por un Jugador normal THEN retorna HTTP 404 (invisible)
- [ ] GIVEN el campo Trust Score WHEN se muestra en el perfil público THEN es un ícono/etiqueta (Excelente/Bueno/Bajo) sin el número exacto, para no estigmatizar

**Reglas de Negocio**: PL-02, PL-05, PL-06, AD-01

**Notas Técnicas**: `GET /players/{id}`. Trust Score público: ≥ 90 → "Excelente", 70-89 → "Bueno", < 70 → "Bajo". Número exacto solo visible en perfil propio. Filtro de bans: `WHERE status != 'banned'` para queries públicas. Coordenadas: retornar solo `region_name`, no lat/lng exactos.

---

#### US-041: Editar preferencias de matchmaking

- **Título**: Configurar radio de búsqueda y rangos ELO preferidos
- **Historia**: Como **Jugador**, quiero configurar mis preferencias de matchmaking (radio máximo, rango ELO aceptado, horarios preferidos), para que el radar y el muro me muestren solo lo que es relevante para mí.
- **Prioridad**: Baja
- **Dependencias**: US-013

**Criterios de Aceptación**:
- [ ] GIVEN el jugador autenticado WHEN envía `PUT /players/me/preferences` con `radar_radius_km`, `elo_range`, `preferred_schedule` THEN las preferencias quedan guardadas y retorna HTTP 200
- [ ] GIVEN preferencias guardadas WHEN el jugador consulta radar o matchmaking THEN los defaults de los filtros reflejan sus preferencias
- [ ] GIVEN `radar_radius_km` fuera del rango permitido (1-50km) WHEN se intenta guardar THEN retorna HTTP 422

**Reglas de Negocio**: PL-05

**Notas Técnicas**: `PUT /players/me/preferences`. Columna JSONB `preferences` en tabla `players`. Schema: `{radar_radius_km: int, elo_min_delta: int, elo_max_delta: int, preferred_days: [string]}`. Valores default: radio 10km, ±200 ELO.

---

#### US-042: Reportar mala conducta de un jugador

- **Título**: Denunciar comportamiento inapropiado post-partido
- **Historia**: Como **Jugador**, quiero reportar la mala conducta de un rival (agresividad, lenguaje ofensivo, trampas) después de un partido, para que el Moderador pueda investigar y mantener la calidad de la comunidad.
- **Prioridad**: Media
- **Dependencias**: US-023, US-010

**Criterios de Aceptación**:
- [ ] GIVEN un partido sellado en el que participé WHEN envío `POST /matches/{id}/report` con motivo y descripción THEN el reporte queda registrado y retorna HTTP 201
- [ ] GIVEN un jugador reportando a alguien que no participó en ese partido WHEN envía el reporte THEN retorna HTTP 403 con `"solo podés reportar a jugadores de este partido"`
- [ ] GIVEN el reporte creado WHEN el Moderador de la zona lo ve THEN aparece en `GET /admin/reports` con todos los detalles
- [ ] GIVEN múltiples reportes del mismo jugador en 7 días WHEN el Moderador lo ve THEN aparece flaggeado como "reportes frecuentes"

**Reglas de Negocio**: TR-03, AD-04

**Notas Técnicas**: `POST /matches/{id}/report`. Tabla `conduct_reports`: `(id, match_id, reported_by, reported_player_id, reason, description, status, created_at)`. Status: `pending`, `validated`, `dismissed`. Validar que `reported_by` esté en `match_players` para ese partido.

---

### EPIC 09 — Panel Admin / Tribunal (Sprint 4)

#### US-043: Dashboard de KPIs para SuperAdmin

- **Título**: Ver métricas clave del sistema en tiempo real
- **Historia**: Como **SuperAdmin**, quiero ver un dashboard con las métricas más importantes del sistema, para monitorear la salud de la plataforma y detectar anomalías en la actividad de los jugadores.
- **Prioridad**: Alta
- **Dependencias**: US-010, US-018, US-025

**Criterios de Aceptación**:
- [ ] GIVEN el SuperAdmin autenticado WHEN consulta `GET /admin/kpis` THEN retorna: partidos jugados hoy/semana/mes, tasa de disputas (% sobre partidos totales), distribución de Trust Scores (histograma), jugadores activos por zona
- [ ] GIVEN la tasa de disputas WHEN supera el 5% en los últimos 7 días THEN aparece flaggeada con alerta en la respuesta
- [ ] GIVEN los KPIs WHEN se calculan THEN están cacheados por 5 minutos (no recalcular en cada request)
- [ ] GIVEN el admin panel React WHEN muestra los KPIs THEN actualiza automáticamente cada 60 segundos

**Reglas de Negocio**: AD-05

**Notas Técnicas**: `GET /admin/kpis`. Queries agregadas sobre `matches`, `disputes`, `players`, `trust_events`. Cache con `sync.Map` o header `Cache-Control: max-age=300`. Incluir comparación con período anterior para tendencia. Admin panel: React + Vite + TailwindCSS, fetch con SWR.

---

#### US-044: Gestión de moderadores por SuperAdmin

- **Título**: Crear y administrar moderadores con región asignada
- **Historia**: Como **SuperAdmin**, quiero crear cuentas de Moderadores y asignarles una región geográfica, para distribuir la moderación de disputas de forma escalable en Mendoza.
- **Prioridad**: Alta
- **Dependencias**: US-010, US-037

**Criterios de Aceptación**:
- [ ] GIVEN el SuperAdmin WHEN envía `POST /admin/moderators` con email, nombre y `region_id` THEN crea el usuario con rol `moderator`, lo asocia a la región y retorna HTTP 201
- [ ] GIVEN un Moderador creado WHEN se le asigna otra región THEN `PUT /admin/moderators/{id}` actualiza la región y el JWT del moderador se invalida (debe re-loguear)
- [ ] GIVEN `GET /admin/moderators` WHEN se consulta THEN lista todos los moderadores con su región, cantidad de disputas resueltas y última actividad
- [ ] GIVEN un Moderador removido (`DELETE /admin/moderators/{id}`) WHEN ocurre THEN su cuenta queda con rol `player` y sus tokens revocados

**Reglas de Negocio**: AU-04, AD-03

**Notas Técnicas**: `POST/GET/PUT/DELETE /admin/moderators`. Al crear: hash bcrypt + enviar email de bienvenida con contraseña temporal (o link de set-password). Al cambiar región: invalidar todos los refresh tokens del moderador. No eliminar usuario, solo degradar rol.

---

#### US-045: Banear y desbanear jugadores

- **Título**: Aplicar sanciones de acceso a jugadores problemáticos
- **Historia**: Como **SuperAdmin**, quiero poder aplicar soft o hard ban a un jugador con justificación auditada, para proteger a la comunidad de participantes de mala fe sin perder el historial de datos.
- **Prioridad**: Alta
- **Dependencias**: US-010

**Criterios de Aceptación**:
- [ ] GIVEN el SuperAdmin WHEN envía `POST /admin/players/{id}/ban` con tipo (`soft`/`hard`), razón y duración opcional THEN el jugador queda baneado y retorna HTTP 200
- [ ] GIVEN un jugador con soft ban WHEN otro jugador lo busca en el ranking o radar THEN no aparece, pero sus datos históricos siguen en la DB
- [ ] GIVEN un jugador con hard ban WHEN intenta hacer login THEN retorna HTTP 403 con `"cuenta suspendida"` y sus tokens son invalidados
- [ ] GIVEN un ban aplicado WHEN se consulta el audit log THEN está registrado con: admin_id, player_id, ban_type, reason, timestamp
- [ ] GIVEN el SuperAdmin WHEN envía `POST /admin/players/{id}/unban` THEN el ban queda removido y el jugador puede acceder nuevamente

**Reglas de Negocio**: AD-01, AU-04

**Notas Técnicas**: Campo `ban_status` en `players`: `none`, `soft`, `hard`. Tabla `admin_audit_log` para todas las acciones admin. Al hard ban: `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`. Middleware de login: verificar `ban_status != 'hard'`.

---

#### US-046: Recalibración manual de ELO por SuperAdmin

- **Título**: Ajustar ELO de un jugador con justificación auditada
- **Historia**: Como **SuperAdmin**, quiero poder recalibrar el ELO de un jugador en casos excepcionales (bug detectado, manipulación comprobada), con trazabilidad completa, para mantener la integridad del ranking.
- **Prioridad**: Media
- **Dependencias**: US-018, US-043

**Criterios de Aceptación**:
- [ ] GIVEN el SuperAdmin WHEN envía `POST /admin/players/{id}/elo-adjust` con `new_elo` y `reason` THEN el ELO del jugador se actualiza, se registra en `elo_history` con tipo `manual_adjustment` y retorna HTTP 200
- [ ] GIVEN el ajuste WHEN se registra THEN incluye: `admin_id`, `previous_elo`, `new_elo`, `reason`, `timestamp` en `elo_history` y en `admin_audit_log`
- [ ] GIVEN `new_elo` fuera del rango permitido (500-2500) WHEN se intenta guardar THEN retorna HTTP 422
- [ ] GIVEN el jugador afectado WHEN consulta su historial de ELO THEN ve el ajuste manual marcado con icono especial y la razón pública (sin detalles de la investigación)

**Reglas de Negocio**: AD-02

**Notas Técnicas**: `POST /admin/players/{id}/elo-adjust`. Campo `type` en `elo_history`: `match_result` | `manual_adjustment`. El `reason` en el historial público es una versión sanitizada. El detalle completo solo en `admin_audit_log`. Recalcular posición en ranking después del ajuste.

---

#### US-047: Vista de disputas pendientes por región (Moderador)

- **Título**: Panel de gestión de disputas para Moderador
- **Historia**: Como **Moderador**, quiero ver en un panel todas las disputas activas de mi zona con su contexto completo, para priorizarlas y resolverlas de forma eficiente.
- **Prioridad**: Alta
- **Dependencias**: US-027, US-010

**Criterios de Aceptación**:
- [ ] GIVEN el Moderador autenticado WHEN consulta `GET /admin/disputes?status=pending` THEN retorna solo disputas de su `region_id` con: partido, capitanes, resultado en disputa, motivo, antigüedad
- [ ] GIVEN una disputa con más de 24 horas pendiente WHEN el Moderador la ve THEN aparece flaggeada como urgente
- [ ] GIVEN el Moderador abre una disputa `GET /admin/disputes/{id}` THEN ve el detalle completo: historial ELO de ambos capitanes, partidos anteriores entre sí, Trust Scores
- [ ] GIVEN `GET /admin/disputes?status=resolved` WHEN el Moderador lo consulta THEN ve el historial de disputas que él mismo resolvió, con sus decisiones

**Reglas de Negocio**: AD-04

**Notas Técnicas**: `GET /admin/disputes`. Middleware `RequireRegion()` filtra automáticamente. JOIN con `matches`, `match_players`, `players`. Campo `urgency_flag: true` si `created_at < now() - interval '24 hours'`. Índice en `disputes.region_id` + `disputes.status`.

---

### EPIC 10 — Notificaciones Push (Sprint 2-4)

#### US-048: Infraestructura de notificaciones FCM

- **Título**: Configurar Firebase Cloud Messaging en el backend
- **Historia**: Como **Sistema**, quiero una integración con FCM para enviar notificaciones push a dispositivos Android e iOS, para mantener a los jugadores informados sin que tengan que estar activos en la app.
- **Prioridad**: Alta
- **Dependencias**: US-006

**Criterios de Aceptación**:
- [ ] GIVEN un jugador que instala la app WHEN registra su device token THEN `POST /players/me/device-token` guarda el token FCM asociado a su cuenta
- [ ] GIVEN el backend queriendo enviar una notificación WHEN llama al servicio FCM THEN la notificación llega al dispositivo en ≤ 10 segundos en condiciones normales
- [ ] GIVEN un token FCM inválido (device desregistrado) WHEN FCM retorna `404/UNREGISTERED` THEN el backend elimina el token de la DB y no reintenta
- [ ] GIVEN un jugador con múltiples dispositivos WHEN se le envía una notificación THEN llega a todos sus devices registrados

**Reglas de Negocio**: NO-01

**Notas Técnicas**: `POST /players/me/device-token`. Tabla `device_tokens`: `(id, player_id, token, platform [ios/android], created_at, last_used_at)`. Usar `firebase-admin-go` SDK. Servicio `NotificationService` con método `Send(playerID, title, body, data)`. Manejar errores FCM: `UNREGISTERED` → delete, `QUOTA_EXCEEDED` → retry con backoff.

---

#### US-049: Notificación de resultado a validar (Capitán B)

- **Título**: Avisar al Capitán B que tiene un resultado pendiente de validación
- **Historia**: Como **Capitán B**, quiero recibir una notificación push cuando el Capitán A carga el resultado de nuestro partido, para no perder la ventana de 6 horas para objetar si el resultado es incorrecto.
- **Prioridad**: Alta
- **Dependencias**: US-024, US-048

**Criterios de Aceptación**:
- [ ] GIVEN el Capitán A carga un resultado WHEN el estado cambia a `awaiting_confirmation` THEN el Capitán B recibe push con: "Resultado pendiente: [Nombre A] cargó [X]-[Y]. Tenés 6h para confirmar o disputar."
- [ ] GIVEN la notificación WHEN el Capitán B la toca THEN abre directamente la pantalla del partido con las opciones de confirmar/disputar (deep link)
- [ ] GIVEN que pasaron 4 horas sin acción WHEN el recordatorio corre THEN el Capitán B recibe push con: "¡Te quedan 2 horas! El resultado se sella automáticamente."
- [ ] GIVEN el partido ya sellado o confirmado WHEN el recordatorio intenta enviarse THEN no se envía (verificación de estado previa)

**Reglas de Negocio**: NO-01, NO-02, MA-03

**Notas Técnicas**: Hook post-carga de resultado: llamar `NotificationService.Send(captainB, ...)`. Recordatorio: job cada 5 minutos, query `WHERE status='awaiting_confirmation' AND result_submitted_at BETWEEN now()-4h AND now()-3h59m`. Deep link: `blendpadel://matches/{id}`.

---

#### US-050: Notificación de cambio significativo de ELO

- **Título**: Avisar al jugador cuando su ELO cambia considerablemente
- **Historia**: Como **Jugador**, quiero recibir una notificación cuando mi ELO sube o baja más de 50 puntos en un partido, para celebrar victorias importantes o revisar qué pasó en derrotas grandes.
- **Prioridad**: Baja
- **Dependencias**: US-018, US-048

**Criterios de Aceptación**:
- [ ] GIVEN un partido sellado WHEN el delta ELO de un jugador supera +50 THEN recibe push con: "¡Subiste [+N] puntos de ELO! Ahora tenés [total]."
- [ ] GIVEN un partido sellado WHEN el delta ELO de un jugador es inferior a -50 THEN recibe push con: "Bajaste [-N] puntos de ELO. Ahora tenés [total]. ¡Dale para adelante!"
- [ ] GIVEN delta entre -50 y +50 WHEN el partido se sella THEN NO se envía notificación de ELO (para no saturar)
- [ ] GIVEN el jugador que toca la notificación WHEN lo hace THEN abre su perfil con el gráfico de ELO centrado en ese partido

**Reglas de Negocio**: NO-03

**Notas Técnicas**: Hook post-`ApplyELO`: calcular `abs(delta)`. Si `abs(delta) > 50` → `NotificationService.Send(playerID, ...)`. Deep link: `blendpadel://profile/elo-history?highlight={matchID}`.

---

#### US-051: Notificación de Trust Score crítico

- **Título**: Alertar al jugador cuando su Trust Score cae bajo el umbral
- **Historia**: Como **Jugador**, quiero recibir una notificación inmediata si mi Trust Score cae por debajo de 70, para entender la consecuencia y tomar acciones para recuperarme.
- **Prioridad**: Media
- **Dependencias**: US-020, US-048

**Criterios de Aceptación**:
- [ ] GIVEN el Trust Score de un jugador cayendo a 69 o menos WHEN el evento `trust_threshold_crossed` se emite THEN el jugador recibe push con: "Tu Trust Score bajó a [N]. Por debajo de 70, quedás oculto del radar de jugadores serios. Completá partidos sin incidentes para recuperarlo."
- [ ] GIVEN el Trust Score ya estaba bajo 70 WHEN baja aún más THEN NO se envía la notificación de umbral nuevamente (solo en el cruce inicial)
- [ ] GIVEN el Trust Score subiendo de 69 a 70 WHEN ocurre THEN el jugador recibe push de rehabilitación: "¡Tu Trust Score volvió a [70]+! Ya sos visible en el radar nuevamente."

**Reglas de Negocio**: NO-04, TR-05

**Notas Técnicas**: En la función de actualización de Trust Score: `if (old_score >= 70 && new_score < 70) → emit trust_threshold_crossed`. Si `(old_score < 70 && new_score >= 70) → emit trust_rehabilitated`. Manejar como eventos en canal interno Go o llamada directa al `NotificationService`.

---

#### US-052: Notificación de partido abierto en la zona

- **Título**: Alertar a jugadores disponibles sobre partidos urgentes cercanos
- **Historia**: Como **Jugador**, quiero recibir una notificación cuando hay un partido abierto urgente a menos de 5km en mi zona, para poder sumarme sin tener que revisar el radar manualmente.
- **Prioridad**: Media
- **Dependencias**: US-031, US-048

**Criterios de Aceptación**:
- [ ] GIVEN un partido con estado `open` a ≤ 5km de un jugador WHEN faltan ≤ 90 minutos para comenzar THEN el jugador elegible recibe push con: "¡Partido urgente cerca! [Zona], hoy [hora]. ELO promedio: [N]. ¿Te sumás?"
- [ ] GIVEN un jugador con Trust Score < 70 WHEN hay un partido de jugadores con Trust ≥ 70 THEN NO recibe la notificación (filtro de visibilidad aplicado)
- [ ] GIVEN el jugador que toca la notificación WHEN lo hace THEN abre el radar centrado en ese partido
- [ ] GIVEN el mismo partido WHEN ya tiene 4 jugadores confirmados THEN no se envían más notificaciones para ese partido

**Reglas de Negocio**: NO-05, PL-05, TR-05

**Notas Técnicas**: Job cada 15 minutos: buscar partidos `open` con `scheduled_at BETWEEN now() AND now() + 1.5h`. Para cada partido, buscar jugadores elegibles via PostGIS en radio 5km + filtro ELO ±300 + filtro Trust Score. FCM envío masivo con `SendMulticast` para eficiencia. Evitar enviar a jugadores que ya recibieron notificación de ese partido (tabla `notification_log`).
