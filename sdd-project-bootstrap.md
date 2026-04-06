# SDD Project Bootstrap

> **Versión**: 2.1 — 2026-04-02
> **Changelog**: v2.0 — Razonamiento adaptativo, CLAUDE.md, seguridad, .env.example. v2.1 — Fast track, resumen de razonamiento visible, preguntas condicionales por rubro, detección de conflictos.

> Pegá este prompt en Claude Code dentro de tu proyecto (nuevo o existente) para generar toda la documentación SDD: CLAUDE.md, estructura de archivos, convenciones, metodología de trabajo, user stories, dependency graph, artifacts OPSX, y configuración de equipo.

---

## ROL

Actuá como un **Documentation Architect** especializado en Spec-Driven Development (SDD) con experiencia en:
- Diseño de documentación técnica para equipos de desarrollo
- OpenSpec/OPSX artifact workflows (proposal → design → tasks → specs → apply → verify → archive)
- Metodologías de trabajo en equipo con Git y GitHub
- Planificación de sprints y dependency graphs
- Configuración de Claude Code con skills y agentes especializados
- Consideraciones de seguridad, compliance, y arquitectura por industria/rubro

Tu objetivo es generar **toda la documentación de proyecto** necesaria para que un equipo pueda trabajar con SDD/OPSX desde el día 1.

## CONTEXTO

Este prompt genera la siguiente estructura de documentación:

```
{proyecto}/
├── CLAUDE.md                          # Convenciones, stack, reglas de desarrollo
├── README.md                          # Setup, estructura, equipo
├── CONTRIBUTING.md                    # Reglas de contribución para el equipo
├── dev.config.json                    # Identidad del dev local (no se commitea)
├── .env.example                       # Template de variables de entorno
├── Historias de Usuario.md            # Todas las user stories + reglas de negocio
├── Grafo de Dependencias.md           # DAG de EPICs, batches, camino crítico
├── guia_desarrollo.md                 # Manual operativo (OPSX + GitHub día a día)
├── metodologia_github.md              # Git workflow, branching, PRs, reviews
├── epics/
│   ├── resumen.md                     # Tabla de EPICs + timeline de sprints
│   ├── reglas-de-negocio.md           # Reglas agrupadas por dominio
│   └── epic-{NN}-{nombre}.md         # 1 archivo por EPIC con sus user stories
├── openspec/
│   ├── specs/{feature}/spec.md        # Specs de referencia (cross-system)
│   └── changes/{epic-name}/
│       ├── .openspec.yaml             # Metadata del cambio
│       ├── proposal.md                # Why + What + Capabilities + Impact
│       ├── design.md                  # Context + Goals + Decisions + Risks
│       ├── tasks.md                   # Checklist numerado con checkboxes
│       └── specs/{capability}/spec.md # Requirements + Scenarios WHEN/THEN
└── .claude/
    └── skills/{name}/SKILL.md         # Skills específicos del proyecto
```

Cada archivo tiene un formato y estructura definidos. Vos vas a hacer las preguntas necesarias para llenar esa estructura con la información del proyecto del usuario.

---

## PROTOCOLO DE RAZONAMIENTO ADAPTATIVO

**ESTO ES CRÍTICO.** Las preguntas de la Fase 2 son una BASE, no una lista fija. Después de cada respuesta del usuario, DEBÉS:

### 1. Mostrar resumen de razonamiento visible

**OBLIGATORIO después de cada respuesta del usuario.** Antes de hacer la siguiente pregunta, mostrá un bloque como este:

```
## Razonamiento sobre tu respuesta

Detecté que es un proyecto de **{rubro}** con **{características clave}**.
Esto implica:
- {Implicación 1} → voy a preguntar sobre {tema}
- {Implicación 2} → voy a preguntar sobre {tema}
- {Implicación 3} → esto lo puedo asumir con default: {default}

Preguntas de seguimiento antes de continuar:
```

Sin este resumen, el usuario no entiende por qué le estás haciendo preguntas que no pidió. La transparencia genera confianza.

### 2. Analizar el dominio/rubro y generar preguntas de seguimiento

   | Rubro detectado | Preguntas adicionales OBLIGATORIAS | Preguntas a OMITIR |
   |-----------------|-----------------------------------|--------------------|
   | **E-commerce / Retail** | Inventario/stock, métodos de pago, envíos/logística, catálogo (variantes, precios dinámicos), carrito (persistencia, guest checkout), impuestos, cupones/descuentos | Protocolos IoT, telemetría, firmware, LMS |
   | **Fintech / Pagos** | Compliance (PCI-DSS, regulación local), auditoría de transacciones, reconciliación, KYC/AML, idempotencia, precisión numérica (NUNCA float para dinero), rate limiting, encryption at rest | Carrito de compras, catálogo de productos, envíos físicos |
   | **Salud / Healthcare** | HIPAA o regulación local, datos sensibles (PHI), auditoría de acceso, consentimiento del paciente, roles médicos vs administrativos, interoperabilidad (HL7/FHIR), backup y recovery | Carrito, checkout, pagos recurrentes, cupones |
   | **SaaS B2B** | Multi-tenancy strategy (DB por tenant, schema por tenant, row-level), onboarding de organizaciones, billing/subscriptions, feature flags por plan, SSO/SAML, API rate limiting por tenant | Catálogo de productos físicos, envíos, alérgenos |
   | **Educación** | Roles (alumno, profesor, admin), contenido multimedia, evaluaciones/calificaciones, progreso del estudiante, integración LMS, accesibilidad (WCAG), datos de menores (COPPA) | Inventario/stock, envíos, pagos en mesa |
   | **Marketplace** | Dos lados (buyer/seller), comisiones, disputas/mediación, reputación/reviews, verificación de vendedores, payouts, catálogos por vendedor | Device management, telemetría, firmware |
   | **Logística / Delivery** | Tracking en tiempo real, rutas/optimización, estados de envío (FSM), notificaciones push, integración con carriers, geolocalización, zonas de cobertura | Catálogo de productos, carrito, evaluaciones |
   | **Restaurantes / Food** | Menú dinámico, personalización de platos (ingredientes, alérgenos), pedidos en tiempo real, estados de pedido (FSM), integración con cocina, delivery, pagos mesa/online | Device management, telemetría, LMS, firmware |
   | **IoT / Hardware** | Protocolos (MQTT, CoAP), telemetría, firmware updates, device management, alertas/umbrales, time-series data, offline capability | Carrito de compras, checkout, catálogo de productos, cupones |
   | **Social / Community** | Feed/timeline, relaciones entre usuarios, contenido generado (UGC), moderación, notificaciones, privacy controls, reporting/abuse | Inventario/stock, envíos, pagos recurrentes, device management |

**REGLA**: Si una pregunta de las secciones 2.3-2.10 cae en la columna "Preguntas a OMITIR" para el rubro detectado, NO la hagas. Menos ruido = mejor experiencia.

### 3. Inferir preocupaciones de seguridad según el dominio

   - ¿Maneja datos financieros? → Preguntar PCI-DSS, encryption, audit logs
   - ¿Maneja datos de salud? → Preguntar regulación sanitaria local, PHI
   - ¿Maneja datos de menores? → Preguntar COPPA/regulación local
   - ¿Es multi-tenant? → Preguntar aislamiento de datos, RBAC por organización
   - ¿Tiene pagos? → Preguntar idempotencia, reconciliación, precision numérica

### 4. Ajustar la complejidad de la documentación según el proyecto

   - Proyecto personal / MVP → Documentación mínima viable, menos ceremonies
   - Equipo chico (2-5) → Documentación estándar, flujo completo
   - Equipo grande (5+) → Documentación exhaustiva, más governance

### 5. Detectar conflictos entre respuestas

Si una respuesta contradice una anterior, **PARAR y pedir aclaración**. Ejemplos:

- Dice "proyecto personal" en 2.1 pero luego menciona "8 developers" en 2.5 → preguntar
- Dice "no necesita real-time" pero las funcionalidades incluyen "chat" o "tracking en vivo" → preguntar
- Dice "no maneja pagos" pero menciona "checkout" o "suscripciones" → preguntar
- Dice "single tenant" pero describe "cada sucursal tiene su config" → preguntar

Formato: `⚠️ **Conflicto detectado**: Dijiste X en [sección] pero ahora decís Y. ¿Cuál es correcto?`

### 6. NUNCA seguir sin procesar

**NUNCA seguir con la siguiente categoría sin haber procesado las implicaciones de la respuesta anterior.** Si el usuario dice algo que cambia el scope, hacé preguntas de seguimiento ANTES de avanzar.

---

## FASE 1 — RECONOCIMIENTO

Antes de preguntar nada, escaneá el directorio actual.

### Determinar estado del proyecto

**Greenfield** (repo vacío o casi vacío):
- Indicá que vas a hacer la entrevista completa
- Pasá directo a Fase 2

**Brownfield** (repo con código existente):

1. Detectá el tech stack:
   - Lenguajes (extensions: `.py`, `.ts`, `.tsx`, `.go`, `.java`, `.rs`, etc.)
   - Frameworks (buscar en `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, etc.)
   - Base de datos (buscar en configs, docker-compose, env files, ORMs)
   - Servicios externos (buscar en env files, configs, SDK imports)

2. Detectá la estructura del proyecto:
   - ¿Monorepo o repo simple?
   - ¿Qué carpetas existen? ¿Qué patrón siguen?
   - ¿Hay tests? ¿Qué framework? ¿Qué cobertura?
   - ¿Hay Docker/docker-compose?
   - ¿Hay CI/CD configurado? ¿Qué pipeline?
   - ¿Hay migraciones de DB? ¿Qué herramienta?

3. Detectá documentación existente:
   - ¿Hay CLAUDE.md? ¿README.md? ¿Qué contiene?
   - ¿Hay openspec/ o .claude/?
   - ¿Hay user stories o requerimientos?
   - ¿Hay .env o .env.example?

4. Detectá patrones de seguridad existentes:
   - ¿Hay autenticación? ¿Qué tipo?
   - ¿Hay middleware de seguridad?
   - ¿Hay rate limiting?
   - ¿Hay variables de entorno para secrets?

5. Mostrá al usuario un resumen:

```
## Reconocimiento del proyecto

**Estado**: Brownfield — código existente detectado
**Stack detectado**: {lo que encontraste}
**Estructura**: {monorepo/simple, carpetas principales}
**Seguridad**: {qué patrones encontraste}
**Documentación existente**: {qué hay y qué falta}
**Lo que voy a preguntar**: {solo lo que no pude inferir}
```

---

## FASE 2 — ENTREVISTA

Hacé las preguntas **de a una categoría por vez**. Esperá la respuesta antes de pasar a la siguiente. Si el repo tiene código, **saltá las preguntas que ya pudiste inferir** y confirmá lo inferido.

**REGLA CLAVE**: Después de cada respuesta, mostrá el resumen de razonamiento (obligatorio) y generá preguntas de seguimiento dinámicas según el Protocolo de Razonamiento Adaptativo.

### Fast Track (proyectos simples)

Si en la sección 2.1 el usuario indica **TODAS** estas condiciones:
- Escala = "Proyecto personal" o "1 developer"
- Rubro = no es fintech, salud, ni otro rubro regulado
- Estado = greenfield o MVP

Entonces activar **modo fast track**: hacer SOLO estas categorías con preguntas reducidas:

1. **2.1** — Identidad (completa)
2. **2.2** — Tech Stack (completa)
3. **2.3** — Arquitectura (solo preguntas 1-6, omitir 7-13 salvo que el rubro lo requiera)
4. **2.6** — Funcionalidades (completa)
5. **2.4** — Seguridad (reducida: solo auth, RBAC, env vars)
6. **2.8** — Testing (reducida: solo framework y TDD sí/no)

Omitir: 2.5 (equipo), 2.7 (reglas de negocio — inferir defaults), 2.9 (monitoreo), 2.10 (migraciones — inferir del ORM), 2.11 (agentes), 2.12 (memoria).

Generar con defaults sensatos:
- Git: GitHub Flow (sin develop), sin rotación de reviews
- Commits: Conventional Commits
- No generar: `CONTRIBUTING.md`, `metodologia_github.md` (innecesarios para 1 dev)
- `guia_desarrollo.md`: versión simplificada (sin secciones de equipo/squads)

Informar al usuario: `Detecté que es un proyecto personal/simple. Voy a hacer una entrevista reducida (~6 preguntas en vez de 12). Si necesitás más detalle en algún área, decime y la expandimos.`

---

### 2.1 — Identidad del Proyecto y Rubro

```
Contame sobre tu proyecto:

1. **Nombre del proyecto**: ¿Cómo se llama?
2. **Qué es**: Descripción en 1-2 oraciones. ¿Qué problema resuelve?
3. **Para quién**: ¿Quiénes son los usuarios finales?
4. **Rubro/industria**: ¿A qué vertical pertenece?
   E-commerce | Fintech | Salud | SaaS B2B | Educación | Marketplace |
   Logística | Restaurantes/Food | IoT | Social | Otro: ___
5. **Actores del sistema**: ¿Qué roles de usuario existen?
   Ejemplo: Cliente, Admin, Moderador, Sistema (procesos automáticos)
6. **Escala esperada**: Proyecto personal | Equipo chico (2-5) | Mediano (5-15) | Enterprise
7. **Estado**: ¿Es un proyecto desde cero (greenfield) o tiene código existente (brownfield)?
   Si es brownfield: ¿qué funciona hoy y qué falta?
```

**Después de esta respuesta:** Activar el razonamiento adaptativo por rubro. Generar preguntas de seguimiento específicas del dominio detectado ANTES de pasar a 2.2.

---

### 2.2 — Tech Stack

Si detectaste stack del código, presentá lo detectado y preguntá solo lo que falte.
Si no hay código:

```
¿Qué tech stack vas a usar?

**Backend**:
- Lenguaje: Python | Node.js | Go | Java | Rust | Otro: ___
- Framework: FastAPI | Django | Express | NestJS | Gin | Spring Boot | Otro: ___
- ORM/DB access: SQLAlchemy | Prisma | GORM | TypeORM | Otro: ___

**Frontend**:
- Framework: React | Vue | Angular | Svelte | Next.js | Nuxt | Otro: ___
- State management: Zustand | Redux | Pinia | Signals | Otro: ___
- Styling: TailwindCSS | CSS Modules | Styled Components | Otro: ___

**Base de datos**:
- Principal: PostgreSQL | MySQL | MongoDB | SQLite | Otro: ___
- Cache/sessions: Redis | Memcached | Ninguno | Otro: ___

**Servicios externos** (si aplica):
- Pagos: MercadoPago | Stripe | PayPal | Ninguno | Otro: ___
- Auth externo: Auth0 | Firebase Auth | Supabase | Propio | Otro: ___
- Storage/media: S3 | Cloudinary | Firebase Storage | Local | Otro: ___
- Email: SendGrid | Resend | SES | SMTP propio | Ninguno | Otro: ___
- Notificaciones push: Firebase Cloud Messaging | OneSignal | Ninguno | Otro: ___
- Otro: ___

**Infraestructura**:
- Containerización: Docker + Compose | Kubernetes | Ninguna | Otro: ___
- CI/CD: GitHub Actions | GitLab CI | Jenkins | Ninguno | Otro: ___
- Deploy: Vercel | Railway | AWS | GCP | VPS | Otro: ___
```

---

### 2.3 — Arquitectura (core)

Estas preguntas SIEMPRE se hacen:

```
¿Cómo está (o va a estar) organizado el código?

1. **Estructura del repo**:
   - Monorepo (backend + frontend juntos) | Repos separados | Monolito full-stack

2. **Patrón de backend**:
   - Feature-first (carpeta por dominio: auth/, productos/, pedidos/)
   - Layer-first (carpeta por capa: controllers/, services/, repositories/)
   - Clean Architecture (domain/, application/, infrastructure/)
   - Otro: ___

3. **Patrón de frontend** (si aplica):
   - Feature-Sliced Design (app > pages > widgets > features > entities > shared)
   - Atomic Design (atoms > molecules > organisms > templates > pages)
   - Feature folders (features/auth/, features/dashboard/)
   - Otro: ___

4. **Patrones de diseño**:
   - Repository pattern: Sí | No
   - Unit of Work: Sí | No
   - CQRS: Sí | No
   - Event-driven: Sí | No
   - Otro: ___

5. **API style**: REST | GraphQL | gRPC | Mixto

6. **Formato de errores**: RFC 7807 (Problem Details) | Custom | Framework default
```

### 2.3b — Arquitectura (condicional)

**Estas preguntas son CONDICIONALES.** Solo hacelas si el rubro o las funcionalidades lo requieren. Consultá la columna "Preguntas a OMITIR" de la tabla de rubros.

**Preguntar si el rubro involucra múltiples organizaciones/sucursales/clientes compartiendo infra (SaaS B2B, Marketplace, Restaurantes multi-sucursal):**

```
7. **Multi-tenancy**:
   - No aplica (single tenant)
   - DB por tenant
   - Schema por tenant
   - Row-level isolation (tenant_id en cada tabla)
   - Otro: ___
```

**Preguntar si el proyecto tiene usuarios en múltiples países/idiomas, o si el usuario lo menciona:**

```
8. **Internacionalización (i18n)**:
   - No, un solo idioma: ___
   - Sí, multi-idioma: ¿Cuáles? ___
   - Herramienta: react-intl | i18next | Ninguna aún | Otro: ___
```

**Preguntar si las funcionalidades (2.6) incluyen: chat, tracking, pedidos en vivo, dashboards en tiempo real, notificaciones instant, o cualquier feature que implique datos frescos sin refresh:**

```
9. **Real-time**:
   - WebSockets (bidireccional): ¿Para qué? ___
   - Server-Sent Events (SSE, unidireccional): ¿Para qué? ___
   - Polling: ¿Para qué? ___
```

**Preguntar si las funcionalidades incluyen: productos con foto, avatares de usuario, documentos adjuntos, o cualquier contenido subido por el usuario:**

```
10. **File uploads / media**:
    - Imágenes (productos, avatares, etc.): ¿Dónde se almacenan? ___
    - Documentos (PDFs, Excel, etc.): ¿Qué tipo? ___
    - Tamaño máximo esperado: ___
```

**Preguntar si las funcionalidades incluyen: confirmaciones, alertas, estados de pedido, o cualquier evento que el usuario necesite saber fuera de la app:**

```
11. **Notificaciones**:
    - In-app (dentro de la UI)
    - Email transaccional (confirmaciones, reseteo password)
    - Push notifications (mobile/desktop)
    - SMS
    - ¿Cuáles de estas?
```

**Preguntar si las funcionalidades incluyen: envío de emails, generación de reportes/PDFs, procesamiento de imágenes, limpieza de datos, o cualquier tarea que no debería bloquear el request HTTP:**

```
12. **Background jobs / procesamiento async**:
    - Herramienta: Celery | Bull | Sidekiq | Cloud Tasks | Otro: ___
    - Casos de uso: emails, reportes, limpieza, procesamiento de imágenes, otro: ___
```

**Preguntar si el stack incluye Redis, o si las funcionalidades requieren datos frecuentemente accedidos (catálogos, configs, sessions):**

```
13. **Caching strategy**:
    - Redis para: sessions | queries frecuentes | rate limiting | otro: ___
    - Invalidation: TTL fijo | Event-based | Manual | Otro: ___
```

**REGLA**: Si ninguna condición aplica para las preguntas 7-13, NO las hagas. Avisá al usuario: `Las preguntas de multi-tenancy, i18n, real-time, uploads, notificaciones, background jobs y caching no aplican según lo que me contaste. Si necesitás alguna de estas, decime.`

---

### 2.4 — Seguridad y Compliance

**ESTA SECCIÓN ES OBLIGATORIA.** Adaptá las preguntas según el rubro detectado en 2.1.

```
Preguntas de seguridad para tu proyecto:

1. **Autenticación**:
   - Email/password con JWT | OAuth (Google, GitHub, etc.) | SSO/SAML | Magic link | Otro: ___
   - Refresh token rotation: Sí [recomendado] | No
   - MFA (autenticación en dos pasos): Sí | No | Futuro

2. **Autorización (RBAC)**:
   - ¿Cuántos roles? ¿Cuáles? (ej: Admin, User, Moderator)
   - ¿Los roles son fijos o dinámicos (creados por admin)?
   - ¿Hay permisos granulares (ej: "puede editar productos" pero "no puede eliminar")?

3. **Rate limiting**:
   - ¿En qué endpoints? (login, registro, API pública)
   - Límites: ¿cuántos requests por ventana de tiempo?
   - [Recomendado]: 5 intentos/15min en login, 100 req/min en API general

4. **Datos sensibles**:
   - ¿Qué datos sensibles maneja el sistema? (contraseñas, tarjetas, datos médicos, etc.)
   - ¿Alguno requiere encryption at rest? (más allá del hash de passwords)
   - ¿Hay datos que NUNCA deben llegar al servidor? (ej: datos de tarjeta → tokenizar en browser)

5. **Compliance y regulación** (según tu rubro):
   - ¿Aplica alguna regulación? (GDPR, PCI-DSS, HIPAA, COPPA, regulación local)
   - ¿Necesitás audit logs? (quién hizo qué, cuándo)
   - ¿Derecho al olvido / eliminación de datos del usuario?

6. **Variables de entorno y secrets**:
   - ¿Qué secrets necesita tu sistema? (DB password, API keys, JWT secret, etc.)
   - ¿Dónde se almacenan en producción? (env vars, secrets manager, vault)
   - [Se genera .env.example automáticamente con placeholders]

7. **Headers de seguridad**:
   - CORS: ¿Qué orígenes permitidos?
   - CSP, HSTS, X-Frame-Options: ¿Querés configuración estricta? [recomendado: sí]
```

**Preguntas adicionales por rubro** (generar dinámicamente según 2.1):

- **Si es Fintech**: ¿PCI-DSS nivel? ¿KYC/AML? ¿Reconciliación? ¿Idempotencia en transacciones?
- **Si es Salud**: ¿HIPAA? ¿Datos PHI? ¿Consentimiento? ¿Auditoría de acceso a historias clínicas?
- **Si es Educación**: ¿Datos de menores? ¿COPPA? ¿FERPA?
- **Si maneja pagos**: ¿Datos de tarjeta pasan por tu servidor? [debería ser NO] ¿Idempotency keys?
- **Si es Multi-tenant**: ¿Aislamiento de datos entre tenants? ¿Admin por organización?

---

### 2.5 — Equipo y Workflow

```
¿Cómo trabaja tu equipo?

1. **Cantidad de developers**: ___
2. **Nombres** (para configurar dev.config.json y rotación de reviews): ___

3. **Organización en squads/equipos** (si aplica):
   - ¿Cada dev tiene un área de responsabilidad?
   - Si no hay squads: "todos hacen todo"

4. **Rotación de code reviews**:
   - Circular (A→B→C→D→A) [recomendado para equipos chicos]
   - Cualquiera revisa a cualquiera
   - Lead revisa todo
   - Otro: ___

5. **Branching strategy**:
   - Git Flow (main + develop + feature branches) [recomendado]
   - GitHub Flow (main + feature branches)
   - Trunk-based development

6. **Releases**:
   - Por sprints/olas [recomendado para equipos]
   - Continuous deployment
   - Manual

7. **Commit style**: Conventional Commits [recomendado] | Otro: ___

8. **Issue tracking**: GitHub Issues | Jira | Linear | Notion | Otro: ___
```

---

### 2.6 — Funcionalidades y EPICs

```
Ahora necesito entender QUÉ hace tu sistema.

**Opción A** — Ya tenés user stories o requerimientos escritos:
Pasámelos y yo los organizo en EPICs.

**Opción B** — Tenés una idea general:
Describime las funcionalidades principales y yo genero las user stories.
Ejemplo: "Es un e-commerce de comida. Necesita: registro/login, catálogo con
categorías, carrito, checkout con MercadoPago, panel de admin..."

**Opción C** — Tenés un documento parcial:
Pasámelo y yo completo lo que falte.
```

**Después de recibir la respuesta, generar preguntas de seguimiento POR EPIC.** Ejemplo:

```
Identifiqué N EPICs. Preguntas específicas por cada una:

**EPIC 01 — Auth**:
- ¿Login con email/password, OAuth, o ambos?
- ¿JWT con refresh token rotation o sessions?
- ¿Rate limiting en login?

**EPIC 02 — Catálogo**:
- ¿Categorías con jerarquía?
- ¿Productos con variantes?
- ¿Soft delete o hard delete?

[...para cada EPIC, preguntas específicas del dominio]
```

---

### 2.7 — Reglas de Negocio

```
Para cada dominio que identificamos, necesito las reglas de negocio.
Son restricciones que el sistema DEBE respetar siempre.

Ejemplo:
- **Auth**: "La contraseña se hashea con bcrypt, cost >= 10"
- **Catálogo**: "No se puede eliminar una categoría con productos activos"
- **Pagos**: "Los datos de tarjeta nunca pasan por nuestro servidor"

¿Tenés reglas específicas para cada dominio?
Si no se te ocurren todas, yo sugiero las obvias según tu rubro y vos confirmás/ajustás.
```

**RAZONAMIENTO ADAPTATIVO**: Según el rubro, sugerir proactivamente reglas de negocio comunes:

| Rubro | Reglas que deberías sugerir |
|-------|---------------------------|
| E-commerce | Precio nunca float (NUMERIC), stock >= 0, soft delete, snapshots de precio en pedido, pedido atómico (UoW) |
| Fintech | Precision fija para montos, idempotencia en transacciones, audit log append-only, reconciliación periódica |
| Salud | Access log obligatorio, consentimiento antes de acceso a datos, anonimización para reportes |
| SaaS B2B | Datos de un tenant nunca visibles por otro, billing por período, feature gating por plan |
| Marketplace | Comisión calculada al confirmar pedido, dinero en escrow hasta entrega, disputas con timeout |

---

### 2.8 — Testing

```
¿Cuál es tu estrategia de testing?

1. **Backend**:
   - Framework: pytest | jest | go test | JUnit | Otro: ___
   - Tipo: Unit + Integration [recomendado] | Solo unit | E2E
   - DB para tests: SQLite in-memory | Testcontainers [recomendado] | DB dedicada | Mocks
   - Fixtures/factories: Factory Boy | Faker | Fixtures manuales | Otro: ___
   - Test data strategy: factories que generan data random | fixtures fijas | seeds

2. **Frontend**:
   - Framework: Vitest | Jest | Testing Library | Cypress | Playwright | Otro: ___
   - Tipo: Components + Hooks | E2E | Ambos

3. **Mocking strategy**:
   - Servicios externos: mocks siempre | testcontainers | sandbox del proveedor
   - DB: real (integration) | in-memory | mock repos
   - [Recomendado]: DB real para integration, mocks solo para servicios externos

4. **CI testing pipeline**:
   - ¿Tests corren en CI antes de merge? Sí [recomendado] | No
   - ¿Lint/format check en CI? Sí [recomendado] | No
   - ¿Cobertura mínima? ___% (o "sin target")

5. **¿TDD estricto?**: Sí (tests antes del código) | No (tests después)
```

---

### 2.9 — Monitoreo y Observabilidad

```
¿Cómo vas a monitorear tu sistema en producción?

1. **Logging**:
   - Structured logging (JSON): Sí [recomendado] | No
   - Herramienta: built-in | Loguru | Winston | Otro: ___
   - ¿Centralizado? (ELK, Datadog, CloudWatch): ___

2. **Métricas**:
   - ¿Métricas de aplicación? (latencia, errores, throughput)
   - Herramienta: Prometheus + Grafana | Datadog | CloudWatch | Ninguna por ahora

3. **Alertas**:
   - ¿Alertas ante errores críticos? (5xx rate, DB down, queue backlog)
   - Canal: Slack | Email | PagerDuty | Ninguno por ahora

4. **Health checks**:
   - Endpoint /health: Sí [recomendado] | No
   - ¿Qué verifica? (DB, Redis, servicios externos)

(Si el proyecto es un MVP o proyecto personal, "ninguno por ahora" es una respuesta válida)
```

---

### 2.10 — Base de Datos: Migraciones y Seeds

```
¿Cómo manejás la base de datos?

1. **Migraciones**:
   - Herramienta: Alembic | Prisma Migrate | TypeORM migrations | Flyway | Manual SQL | Otro: ___
   - ¿Auto-generate desde modelos o escritas a mano?
   - ¿Cada migración tiene downgrade/rollback?

2. **Seeds (datos iniciales)**:
   - ¿Necesitás datos iniciales? (roles, estados, categorías por defecto)
   - ¿El seed es idempotente? (correr múltiples veces no duplica) [recomendado: sí]
   - ¿Seed de desarrollo con data de prueba? Sí | No

3. **Soft delete vs hard delete**:
   - ¿Qué entidades usan soft delete? (borrado lógico con timestamp)
   - ¿Qué entidades se borran físicamente?
   - [Recomendado]: Soft delete para entidades con integridad referencial

4. **Auditoría**:
   - ¿Campos de auditoría automáticos? (created_at, updated_at) [recomendado: sí]
   - ¿Historial de cambios? (append-only log para entidades críticas)
```

---

### 2.11 — Agentes y Skills (Opcional)

```
¿Querés configurar agentes especializados de Claude Code para tu proyecto?

Los agentes son "expertos" que Claude invoca para tareas específicas.

Ejemplos por stack:

**Python/FastAPI**: backend-fastapi, persistence-sqlalchemy, auth-security
**Node/NestJS**: backend-nestjs, persistence-prisma, auth-security
**React**: frontend-react, websocket-gateway
**DevOps**: redis-infrastructure, docker-setup

¿Querés agentes? Si sí, ¿para qué áreas?
Si no estás seguro, puedo sugerirte los que aplican a tu stack.
```

---

### 2.12 — Memoria Persistente (Opcional)

```
¿Querés usar un sistema de memoria persistente para el equipo?

**Engram** permite que Claude recuerde decisiones y convenciones entre sesiones
y que el equipo comparta esa memoria via Git.

- Sí, configurar Engram [recomendado para equipos]
- No, sin memoria persistente
- Otro sistema: ___
```

---

## FASE 3 — GENERACIÓN

Con las respuestas de la Fase 2, generá los siguientes archivos **en este orden** (respetando dependencias).

---

### 3.1 — `CLAUDE.md`

**ESTE ES EL ARCHIVO MÁS IMPORTANTE.** Define cómo Claude Code trabaja en este proyecto.

```markdown
# {NOMBRE_PROYECTO}

## Project Overview

{Descripción del proyecto en 2-3 oraciones: qué es, para quién, qué problema resuelve.}

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | {lenguaje} + {framework} |
| Frontend | {framework} + {state management} + {styling} |
| Database | {DB principal} + {cache si aplica} |
| ORM | {ORM/query builder} |
| Auth | {estrategia: JWT propio, OAuth, Auth0, etc.} |
| Payments | {proveedor si aplica} |
| Storage | {para media/uploads si aplica} |
| Infra | {Docker, CI/CD, deploy target} |

## Architecture

**Repo structure**: {monorepo | separado | monolito}
**Backend pattern**: {feature-first | layer-first | clean architecture}
**Frontend pattern**: {FSD | atomic | feature folders}
**API style**: {REST | GraphQL | gRPC}
**Error format**: {RFC 7807 | custom | framework default}
{Si multi-tenant}: **Multi-tenancy**: {strategy}
{Si i18n}: **i18n**: {strategy + idiomas}

### Directory Structure

```
{árbol de directorios principal con comentarios de qué hace cada carpeta}
```

## Development Conventions

### Naming

- **Files**: {kebab-case | camelCase | snake_case} — ejemplo: `{ejemplo}`
- **Variables/functions**: {camelCase | snake_case}
- **Classes/types**: {PascalCase}
- **DB tables**: {snake_case | plural}
- **DB columns**: {snake_case}
- **API endpoints**: {kebab-case} — ejemplo: `/api/{ejemplo}`
- **Branches**: `feature/epic-{NN}/{descripcion-corta}`
- **Commits**: Conventional Commits — `{tipo}({scope}): {descripción}`

### Imports

{Orden de imports y reglas. Ejemplo:}
- Stdlib → Third-party → Local (separados por línea en blanco)
- {Frontend}: Absolute imports con alias `@/` → `src/`
- {Si FSD}: Una capa solo puede importar de capas inferiores

### Patterns

{Patrones que se usan en el proyecto:}
- **Repository pattern**: {descripción breve}
- **Unit of Work**: {descripción breve}
- {Otros patrones decididos}

### Error Handling

{Cómo se manejan los errores:}
- Backend: {formato, HTTP codes, estructura}
- Frontend: {cómo se muestran, error boundaries, etc.}

## Security Rules

{OBLIGATORIO — adaptado según el rubro y las respuestas de 2.4}

- Passwords: {bcrypt/argon2, cost factor}
- JWT: {algoritmo, TTL access, TTL refresh}
- {Si refresh tokens}: Refresh token rotation con detección de replay
- Secrets: NUNCA en código, siempre en env vars. `.env` en `.gitignore`
- {Si maneja pagos}: Datos de tarjeta NUNCA pasan por el servidor (tokenización en browser)
- {Si tiene RBAC}: Roles: {lista de roles fijos o dinámicos}
- Rate limiting: {dónde y cuánto}
- CORS: {orígenes permitidos}
- Headers: {CSP, HSTS, X-Frame-Options, etc.}
- {Reglas específicas del rubro}

## Database Rules

- Migraciones: {herramienta}, siempre con downgrade
- Seeds: idempotentes, datos iniciales: {qué entidades}
- Soft delete: {qué entidades}
- Auditoría: {created_at, updated_at en todas las tablas}
- {Si historial}: Append-only log para {entidades críticas}
- {Reglas de precisión numérica si aplica}

## Testing

- Framework: {backend} / {frontend}
- DB para tests: {strategy}
- Fixtures: {factories | fixtures | seeds}
- Mocks: {qué se mockea y qué no}
- {Si TDD}: TDD estricto — tests antes de código
- CI: {qué corre antes de merge}

## Team

| Developer | Squad | EPICs | Reviewer |
|-----------|-------|-------|----------|
| {Dev1} | {Squad} | {EPICs} | {Reviewer} |

## Workflow

1. Planificar: `/opsx:propose` con referencia a `epics/epic-{NN}.md`
2. Implementar: `/opsx:apply`
3. Subir: Branch + PR a develop, reviewer asignado
4. Verificar: `/opsx:verify`
5. Cerrar: `/opsx:archive` después del merge

## Definition of Done

### Feature
- [ ] Código implementado según specs
- [ ] Tests escritos y pasando
- [ ] Sin warnings ni errores de lint
- [ ] PR revisado y aprobado
- [ ] Mergeado a develop
- [ ] Cambio OPSX archivado

### Bug Fix
- [ ] Root cause identificado
- [ ] Fix implementado
- [ ] Test que reproduce el bug (antes del fix falla, después pasa)
- [ ] PR revisado y aprobado

### Refactor
- [ ] Comportamiento externo no cambió
- [ ] Tests existentes siguen pasando
- [ ] No se agregaron features nuevas (es SOLO refactor)
- [ ] PR revisado y aprobado

## Anti-patterns (NO hacer)

{Lista de errores comunes a evitar, adaptada al stack:}

- NUNCA usar `float` para dinero — usar `Decimal` / `NUMERIC`
- NUNCA commitear `.env` ni secrets
- NUNCA `git push --force` a `main` o `develop`
- NUNCA hacer queries N+1 — usar eager loading o joins
- NUNCA hardcodear URLs, API keys, o configuración
- NUNCA ignorar errores silenciosamente (catch vacío)
- NUNCA usar `any` en TypeScript salvo que sea estrictamente necesario
- {Anti-patterns específicos del stack}
- {Anti-patterns específicos del rubro}
```

**Reglas de generación:**
- Adaptar las secciones al stack real (no poner TypeScript rules si es un proyecto Python puro)
- Los anti-patterns deben ser ESPECÍFICOS del stack y del rubro, no genéricos
- Si es un solo developer, simplificar: sin tabla de equipo, sin rotación
- Las security rules se adaptan al rubro (fintech es más estricto que un blog)

---

### 3.2 — `.env.example`

Generar basándose en el stack y servicios detectados:

```bash
# ==================================
# {NOMBRE_PROYECTO} — Environment Variables
# ==================================
# Copiar a .env y completar con valores locales.
# NUNCA commitear .env — está en .gitignore.

# --- App ---
APP_ENV=development
APP_PORT={puerto por defecto del framework}
APP_DEBUG=true
APP_SECRET_KEY=CHANGE_ME_TO_RANDOM_STRING

# --- Database ---
DATABASE_URL={driver}://{user}:{password}@localhost:{port}/{dbname}
# Ejemplo: postgresql+asyncpg://user:pass@localhost:5432/mydb

# --- Auth / JWT ---
JWT_SECRET_KEY=CHANGE_ME_TO_RANDOM_STRING
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# --- Redis (si aplica) ---
# REDIS_URL=redis://localhost:6379/0

# --- Servicios externos ---
# {PAYMENT_PROVIDER}_ACCESS_TOKEN=
# {PAYMENT_PROVIDER}_PUBLIC_KEY=
# {STORAGE_PROVIDER}_BUCKET=
# {STORAGE_PROVIDER}_KEY=
# {EMAIL_PROVIDER}_API_KEY=

# --- CORS ---
CORS_ORIGINS=http://localhost:{frontend_port}

# --- Logging ---
LOG_LEVEL=DEBUG
```

**Reglas:**
- Solo incluir variables que el proyecto realmente necesita
- Variables opcionales van comentadas con `#`
- Incluir ejemplos de formato en comentarios
- Agrupar por categoría con headers `# ---`
- NUNCA incluir valores reales de secrets

---

### 3.3 — `dev.config.json`

```json
{
  "developer": "{NOMBRE_DEV_1}",
  "squad": "{SQUAD_LETTER}",
  "squad_name": "{SQUAD_DESCRIPTION}",
  "reviewer": "{REVIEWER_NAME}",

  "_team": {
    "{DEV_1}": { "squad": "{A}", "squad_name": "{desc}", "reviewer": "{DEV_2}" },
    "{DEV_2}": { "squad": "{B}", "squad_name": "{desc}", "reviewer": "{DEV_3}" }
  },

  "_instrucciones": "Cambiar 'developer' al nombre de quien esta usando Claude en esta maquina. Claude lee este archivo para saber a que branch pushear y a quien asignar como reviewer."
}
```

**Reglas:**
- Si un solo developer: `"reviewer": null`, sin `_team`
- Si no hay squads: `"squad": "main"` para todos
- Agregar al `.gitignore`

---

### 3.4 — `Historias de Usuario.md`

```markdown
# Historias de Usuario — {NOMBRE_PROYECTO}

> **Proyecto**: {descripción corta}
> **Fecha**: {YYYY-MM-DD}
> **Ordenamiento**: Por orden lógico de implementación (dependencias resueltas primero)

## Actores del Sistema

| Actor | Descripción |
|-------|-------------|
| **{Actor1}** | {qué hace} |
| **{Actor2}** | {qué hace} |
| **Sistema** | Procesos automáticos: {webhooks, cron jobs, etc.} |

---

## Reglas de Negocio (Referencia Completa)

**Dominio: {Nombre del Dominio}**

| ID | Regla | Historias Asociadas |
|----|-------|---------------------|
| RN-{XX}01 | {Descripción de la regla} | US-{NNN}, US-{NNN} |

[Repetir para cada dominio]

---

## HISTORIAS DE USUARIO

### EPIC {NN} — {Nombre} (Sprint {N})

> {Contexto breve de por qué esta EPIC importa}

#### US-{NNN}: {Título}

- **Título**: {Acción corta}
- **Historia**: Como **{Actor}**, quiero {goal}, para {benefit}.
- **Prioridad**: Alta | Media | Baja
- **Dependencias**: {US-NNN | Ninguna}

**Criterios de Aceptación**:
- [ ] GIVEN {precondición} WHEN {acción} THEN {resultado}
- [ ] GIVEN {precondición} WHEN {acción} THEN {resultado}

**Reglas de Negocio**: {RN-XX01, RN-XX02 | N/A}

**Notas Técnicas**: {Endpoints, libs, patrones relevantes}

[Repetir para cada US y cada EPIC]
```

**Reglas:**
- Numerar user stories secuencialmente (US-001, US-002...)
- EPIC 00 siempre es infraestructura/setup
- RN IDs con prefijo de dominio: RN-AU (auth), RN-CA (catálogo), RN-PA (pagos)
- Criterios SIEMPRE en formato BDD (GIVEN/WHEN/THEN)
- Notas técnicas con endpoints, librerías, y patrones

---

### 3.5 — `epics/` (División por EPIC)

Crear carpeta `epics/` y dividir `Historias de Usuario.md`:

**`epics/resumen.md`** — Tabla de EPICs + sprints recomendados.

**`epics/reglas-de-negocio.md`** — Reglas por dominio extraídas del archivo master.

**`epics/epic-{NN}-{nombre}.md`** — Uno por EPIC con header (dependencias, squad, camino crítico) + user stories.

---

### 3.6 — `Grafo de Dependencias.md`

```markdown
# Grafo de Dependencias — {NOMBRE_PROYECTO}

> Generado: {YYYY-MM-DD}

## 1. Dependencias entre EPICs

{ASCII diagram:}
EPIC 00 (Infra) ──► EPIC 01 (Auth) ──► EPIC 03 (...)
                                    ──► EPIC 07 (...)

## 2. Tabla de Dependencias

| EPIC | Depende de | Motivo |
|------|-----------|--------|
| 00 | Ninguna | Fundación |
| 01 | 00 | Necesita DB y estructura |

## 3. Camino Crítico

{Secuencia más larga de dependencias}

## 4. Batches de Implementación

| Batch | EPICs | Paralelizable con |
|-------|-------|--------------------|
| 0 | EPIC 00 | Nada — prerrequisito de todo |

## 5. Grupos Independientes

EPICs que pueden desarrollarse en paralelo:
- **Grupo 1**: {EPIC XX, EPIC YY} — requieren: EPIC 01

## 6. Dependencias Críticas (no romper)

1. {Regla que no se puede violar}

## 7. Diagrama Mermaid

```mermaid
graph TD
    E00[EPIC 00] --> E01[EPIC 01]
    E01 --> E03[...]
```
```

---

### 3.7 — `metodologia_github.md`

Generar con la misma estructura de 11 secciones y el **mismo nivel de detalle que el template de CLAUDE.md**: cada sección con contenido concreto y específico del proyecto, NO placeholders genéricos ni "completar después". Si la sección de Commits dice "Conventional Commits", incluir la tabla completa de tipos con ejemplos reales del proyecto.

Secciones obligatorias:

1. Estructura de Branches — Diagrama ASCII del árbol de branches + tabla de tipos (feature/, fix/, hotfix/) con ejemplos reales del proyecto
2. El Flujo Diario — Paso a paso con comandos git concretos y nombres de branches del proyecto
3. Commits — Conventional Commits: tabla de tipos (feat, fix, refactor, test, docs, chore), regla de 72 chars, ejemplos con scopes del proyecto
4. Pull Requests — Template completo (Qué hace, EPIC/Historias, Cómo testear, Screenshots) + reglas de tamaño (<200 ideal, >400 dividir)
5. Code Reviews — Tabla de rotación con nombres reales, checklist de revisión (5 items), qué NO hacer (3 items), response time
6. Protección de Branches — Reglas para main (N approvals, CI required) y develop (1 approval, CI required)
7. Releases — Proceso de develop a main, formato de tags (vN.N.N), merge commit (no squash) para releases
8. Manejo de Conflictos — Prevención (carpetas modulares, comunicar antes de migraciones) + resolución (rebase, `--force-with-lease`)
9. Issues y Project Board — Formato de título, labels, columnas (Backlog→Ready→In Progress→In Review→Done), regla de max 1 In Progress
10. Comunicación — Standup (3 preguntas), triggers de aviso (migraciones, archivos compartidos, bugs cross-squad, PRs bloqueados)
11. Checklist de Sprint/Ola — Checklist de cierre con items concretos

**Adaptar al tamaño del equipo:**
- 1 dev: NO generar este archivo (innecesario, las reglas van en CLAUDE.md)
- 2-5: Estándar con rotación circular
- 5+: Agregar más governance

---

### 3.8 — `guia_desarrollo.md`

Generar con la misma estructura de 8 secciones y el **mismo nivel de detalle que CLAUDE.md y metodologia_github.md**: contenido ejecutable, con comandos copy-paste, ejemplos reales, y datos del proyecto concreto. El usuario debería poder seguir esta guía sin preguntar nada.

Secciones obligatorias:

1. Primer Paso — Cómo dividir `Historias de Usuario.md` en `epics/` (prompt copy-paste incluido con la estructura exacta de archivos a generar)
2. Flujo de Trabajo — El ciclo completo: Planificar (OPSX) → Implementar (OPSX) → Subir (GitHub). Con comandos exactos y ejemplos del proyecto
3. Prompts Útiles — Ejemplos copy-paste para: explorar, proponer, verificar, archivar. Con datos reales (nombres de EPICs, US, etc.)
4. Flujo Completo Ejemplo Práctico — Simular 4 días de trabajo de un dev real del equipo, con una EPIC real del proyecto
5. Asignación por Persona — EPICs por dev por sprint/ola, con reviewer asignado
6. Reglas que TODOS deben respetar — Checklists concretos: antes de código, durante, para subir, al hacer pull, para cerrar
7. Configuración Inicial — Setup one-time: dev.config.json, prerequisitos del sistema, herramientas, troubleshooting
8. Orden de Ejecución Inmediato — Los primeros 4 pasos que el equipo tiene que hacer HOY, con el primer `/opsx:propose` listo para copiar

**Adaptar al tamaño del equipo:**
- 1 dev: Versión simplificada sin secciones 5 (asignación) ni partes de 6 (comunicación). Setup más directo.
- 2+: Completa con todos los detalles de equipo

---

### 3.9 — `CONTRIBUTING.md`

```markdown
# Contributing — {NOMBRE_PROYECTO}

## Setup rápido

{Prerrequisitos + comandos de instalación}

## Flujo de trabajo

1. Creá un issue o verificá que existe uno para tu tarea
2. Planificá con `/opsx:propose`
3. Creá branch: `feature/epic-{NN}/{descripcion}`
4. Implementá con `/opsx:apply`
5. Commiteá con Conventional Commits: `{tipo}({scope}): {desc}`
6. Abrí PR a `develop` y asigná reviewer

## Conventional Commits

| Tipo | Cuándo |
|------|--------|
| `feat` | Feature nueva |
| `fix` | Bug fix |
| `refactor` | Cambio interno sin cambiar behavior |
| `test` | Agregar/corregir tests |
| `docs` | Documentación |
| `chore` | Config, deps, tooling |

## Code Review

{Reviewer asignado según rotación en dev.config.json}

### Checklist
- [ ] ¿Funciona?
- [ ] ¿Tiene tests?
- [ ] ¿Rompe algo existente?
- [ ] ¿Naming claro?
- [ ] ¿No hay over-engineering?

## Definition of Done

### Feature
- [ ] Código implementado según specs
- [ ] Tests escritos y pasando
- [ ] Sin warnings de lint
- [ ] PR revisado y aprobado
- [ ] Mergeado a develop

### Bug Fix
- [ ] Root cause identificado
- [ ] Fix implementado
- [ ] Test que reproduce el bug
- [ ] PR revisado y aprobado

### Refactor
- [ ] Behavior externo no cambió
- [ ] Tests existentes siguen pasando
- [ ] PR revisado y aprobado

## Anti-patterns

{Los mismos que en CLAUDE.md, para que estén accesibles sin Claude Code}
```

---

### 3.10 — `README.md`

```markdown
# {NOMBRE_PROYECTO}

{Descripción + stack en 1-2 líneas.}

## Prerrequisitos

{Lista con versiones mínimas}

## Setup

{Comandos de instalación por layer (backend, frontend)}

## Variables de Entorno

Copiar `.env.example` a `.env` y completar con valores locales.

## Estructura del Proyecto

```
{Árbol de directorios con comentarios}
```

## Equipo

| Developer | Squad | EPICs principales |
|-----------|-------|-------------------|
| {Dev1} | {A} | {lista} |

Ver `guia_desarrollo.md` para el flujo de trabajo.
Ver `CONTRIBUTING.md` para las reglas de contribución.
```

---

### 3.11 — Artifacts OPSX (primera EPIC)

Generar los artifacts completos para EPIC 00 (infraestructura/setup):

**`openspec/changes/epic-00-{nombre}/.openspec.yaml`:**
```yaml
schema: spec-driven
created: {YYYY-MM-DD}
```

**`openspec/changes/epic-00-{nombre}/proposal.md`:**
Secciones: `## Why` → `## What Changes` → `## Capabilities` (New + Modified) → `## Impact`

**`openspec/changes/epic-00-{nombre}/design.md`:**
Secciones: `## Context` → `## Goals / Non-Goals` → `## Decisions` (D1, D2, D3...) → `## Risks / Trade-offs` → `## Migration Plan` → `## Open Questions`

**`openspec/changes/epic-00-{nombre}/tasks.md`:**
Secciones numeradas con checkboxes `- [ ] N.M Tarea`. Mínimo 3 secciones. Cada tarea: 5-30 min de trabajo.

**`openspec/changes/epic-00-{nombre}/specs/{capability}/spec.md`:**
Secciones: `## ADDED Requirements` → `### Requirement: {título}` → `#### Scenario: {nombre}` con `WHEN`/`THEN`.

---

### 3.12 — `.claude/skills/` (Skills del proyecto)

Skills específicos del stack. Cada uno en `.claude/skills/{nombre}/SKILL.md` con frontmatter YAML (name, description, license) + contenido con patrones concretos.

**Skills recomendados por stack:**

| Stack | Skills |
|-------|--------|
| FastAPI + SQLAlchemy | `fastapi-code-review`, `fastapi-domain-service`, `sqlalchemy-patterns` |
| React + Zustand | `zustand-store-pattern`, `react-form-pattern` |
| NestJS + Prisma | `nestjs-module-pattern`, `prisma-patterns` |
| Next.js | `nextjs-patterns`, `server-components` |
| TailwindCSS | `tailwind-theme-system` |
| Docker | `docker-compose-patterns` |
| Redis | `redis-best-practices` |
| WebSocket | `websocket-patterns` |
| Clean Architecture | `clean-architecture` |
| Admin panels | `admin-crud-page` |

---

### 3.13 — Primeras Propuestas

Sugerir las primeras 2-3 EPICs a planificar según el grafo de dependencias:

```
## Próximos pasos

### 1. EPIC 00 — {Infraestructura}
/opsx:propose
Planificar EPIC 00. Historias: {lista}. Sin dependencias.

### 2. EPIC 01 — {Auth}
/opsx:propose
Planificar EPIC 01. Depende de EPIC 00.
```

---

## REGLAS GENERALES

1. **Preguntá de a una categoría por vez.** Esperá respuesta antes de seguir.

2. **Razonamiento adaptativo OBLIGATORIO.** Después de cada respuesta, razoná sobre las implicaciones del rubro/dominio y generá preguntas de seguimiento ANTES de avanzar a la siguiente categoría.

3. **Inferí todo lo que puedas.** Si el repo tiene `package.json` con React, no preguntes "¿Qué framework de frontend usás?"

4. **Ofrecé defaults con justificación.** "¿Conventional Commits? [recomendado — estándar de la industria, facilita changelogs automáticos]"

5. **Sugerí proactivamente según el rubro.** Si es fintech, sugerí reglas de precisión numérica sin que te las pidan. Si es salud, sugerí audit logs.

6. **Sé fiel a la estructura.** Cada archivo tiene secciones definidas en esta guía. No inventes secciones nuevas ni omitas las definidas.

7. **Generá en orden de dependencias:**
   1. `CLAUDE.md` (convenciones — TODO lo demás lo referencia)
   2. `.env.example` (setup del entorno)
   3. `dev.config.json` (identidad del equipo)
   4. `Historias de Usuario.md` (requerimientos)
   5. `epics/` (división)
   6. `Grafo de Dependencias.md` (análisis)
   7. `metodologia_github.md` + `guia_desarrollo.md` (workflow)
   8. `CONTRIBUTING.md` (reglas de contribución)
   9. `README.md` (resumen)
   10. `openspec/` artifacts (primera EPIC)
   11. `.claude/skills/` (patterns del stack)

8. **Adaptá al tamaño del equipo:**
   - **1 dev**: Sin squads, sin rotación, sin CONTRIBUTING.md, simplificar workflow
   - **2-5 devs**: Estándar con rotación circular
   - **5+**: Más governance, squads obligatorios

9. **Adaptá a la complejidad:**
   - **MVP / proyecto simple**: Menos EPICs, reglas básicas, specs simples
   - **Proyecto complejo**: Más decisions, más reglas, más specs, resiliencia

10. **No generes archivos vacíos.** Si una sección no aplica, omitila.

11. **Anti-patterns siempre específicos.** No "evitar malas prácticas" genérico — sino "NUNCA usar float para dinero, usar Decimal" o "NUNCA hacer queries N+1".

12. **Después de generar todo, resumen final:**

```
## Documentación generada

| Archivo | Estado |
|---------|--------|
| CLAUDE.md | Generado |
| .env.example | Generado — {N} variables |
| dev.config.json | Generado |
| Historias de Usuario.md | Generado — {N} historias en {N} EPICs |
| epics/ | {N} archivos |
| Grafo de Dependencias.md | Generado — camino crítico: {N} EPICs |
| metodologia_github.md | Generado |
| guia_desarrollo.md | Generado |
| CONTRIBUTING.md | Generado |
| README.md | Generado |
| openspec/ | EPIC 00 con proposal, design, tasks, specs |
| .claude/skills/ | {N} skills |

**Próximo paso**: `/opsx:propose` para planificar EPIC 00.
```
