# Tablas de la BD y procesos que las ocupan

> Análisis de las tablas PostgreSQL y los procesos (repositorios, servicios,
> endpoints, crons) que las leen y escriben.
> **Generado: 2026-06-10.** Complementa a [ARCHITECTURE.md](ARCHITECTURE.md)
> (estructura de capas) con una vista **centrada en la tabla**.

## Metodología y alcance

- **Parte estática (código):** completa. Mapeo extraído del código real —
  `FROM/INTO/UPDATE/DELETE/JOIN "TABLA"` en `src/repositories`, imports
  `services → repositories`, endpoints `/api/cron/*`, y accesos SQL fuera de
  la capa repositorio.
- **Parte en vivo (métricas reales de la BD):** **pendiente — bloqueada por red.**
  El puerto `25060` de la BD managed no es alcanzable desde el entorno actual
  (`Test-NetConnection → TcpTestSucceeded: False`; el host resuelve y responde
  ping, pero el firewall *Trusted Sources* de DigitalOcean no incluye esta IP).
  Ver [§7](#7-métricas-en-vivo-pendiente) para desbloquear y rellenar.
- **Datos de diagnóstico reales disponibles:** los números de `pg_stat_statements`
  citados en [§6](#6-rendimiento--tablas-calientes-datos-reales-de-diagnóstico)
  provienen de mediciones en vivo registradas en el historial git (sesión
  2026-06-09), no de estimaciones.

---

## 1. Inventario de tablas (25 reales)

> ⚠️ **Hallazgo:** ARCHITECTURE.md documenta **21 tablas**, pero ese conteo se
> mide con `grep src/repositories/*.ts`. Hay **4 tablas más** que se acceden
> **fuera de la capa repositorio** (audit logs + healthcheck) y por eso no se
> contaban. El total real es **25**.

| # | Tabla | Capa de acceso | Naturaleza |
|---|---|---|---|
| 1 | `PEOPLE` | repo `people` | Núcleo — titulares + beneficiarios |
| 2 | `ACADEMICA` | repo `academica` | Núcleo — perfil académico |
| 3 | `ACADEMICA_BOOKINGS` | repo `booking` | Núcleo — inscripciones (🔥 ~165k filas) |
| 4 | `CALENDARIO` | repo `calendar` | Núcleo — eventos/sesiones |
| 5 | `FINANCIEROS` | repo `financial` (solo lectura) + **rutas API** (escritura) | Contrato financiero |
| 6 | `PAGOS_TITULARES` | repo `pagos-titulares` | Recaudos |
| 7 | `COMENTARIOS` | repo `comments` | Comentarios de estudiante |
| 8 | `ACADEMICA_BOOKING_EVALUATIONS` | repo `evaluations` | Valoración de sesiones (encuesta) |
| 9 | `STEP_OVERRIDES` | repo `niveles` (`StepOverridesRepository`) | Overrides manuales de step |
| 10 | `COMPLEMENTARIA_ATTEMPTS` | repo `complementaria` | Quizzes AI |
| 11 | `JUMP_EVALUATIONS` | repo `jump-evaluation` | Evaluación de salto de nivel |
| 12 | `NIVELES` | repo `niveles` | Catálogo de niveles pedagógicos |
| 13 | `ADVISORS` | repo `advisor` | Advisors (profesores) |
| 14 | `ADVISOR_EVENT_LOG` | repo `advisor-event-log` | Log histórico de eventos (append-only) |
| 15 | `ADVISOR_NOTES_AUDIT` | repo `advisor-notes-audit` | Audit de notas (append-only) |
| 16 | `ADMIN_EVENTS` | repo `admin-events` | Eventos administrativos (training/sup) |
| 17 | `LIBROS_INTERACTIVOS` | repo `libros-interactivos` | Material interactivo |
| 18 | `USUARIOS_ROLES` | repo `roles` (+ `dblgs` lectura) | Cuentas + credenciales |
| 19 | `ROL_PERMISOS` | repo `roles` | Matriz de permisos (RBAC) |
| 20 | `APP_CONFIG` | repo `config` | Feature flags / banner / ticker |
| 21 | `MESSAGE_TEMPLATES` | repo `message-templates` | Plantillas WhatsApp |
| 22 | `CRON_RUNS` | **`src/lib/cron-runs.ts`** (fuera de repo) | Healthcheck de jobs |
| 23 | `auditautoaprov` | **ruta** `consent/[id]/auto-approve` | Audit de auto-aprobación |
| 24 | `PURGE_LOG` | **ruta** `admin/contratos-prueba/purge` | Audit de purga de pruebas |
| 25 | `MATERIAL_AUDIT` | **ruta** `postgres/materials/manage` | Audit de cambios de material |

---

## 2. Análisis por tabla — quién la ocupa

Leyenda CRUD: **C**=insert · **R**=select · **U**=update · **D**=delete.

### Núcleo académico (las más calientes)

#### `PEOPLE` — la tabla más consumida
- **Repo dueño:** `people.repository` — **CRUD** completo.
- **Servicios consumidores (9):** `student`, `contract`, `consent`, `progress`,
  `panel-estudiante`, `pagos-titulares`, `search`, `usuarios-pegados`, `dashboard`.
- **Procesos que la ocupan:**
  - Crear/editar contrato (titular + beneficiarios) → `contract.service`.
  - Detalle y perfil del estudiante → `student.service`.
  - Consentimiento declarativo (OTP, hash) → `consent.service` (campo JSONB `consentimientoDeclarativo`).
  - Crons `reactivate-onhold` y `expire-contracts` (campos JSONB `onHoldHistory`, `extensionHistory`).
  - Búsqueda global → `search.service`.
- **JSONB:** `onHoldHistory`, `extensionHistory`, `consentimientoDeclarativo`.

#### `ACADEMICA_BOOKINGS` — la tabla más caliente (🔥 ~165k filas)
- **Repo dueño:** `booking.repository` — **CRUD** completo. Hace JOINs a
  `PEOPLE`, `ACADEMICA`, `CALENDARIO`, `ADVISORS`.
- **Servicios consumidores (8):** `enrollment`, `student`, `student-booking`,
  `panel-estudiante`, `complementaria`, `jump-tutor`, `calendar`, `dashboard`.
- **Procesos que la ocupan:**
  - Inscribir/desinscribir estudiantes (individual y masivo) → `enrollment.service`.
  - Asistencia y evaluación de sesión → `student.service`.
  - Historial académico del estudiante (`/student/[id]`) → **query más cara del sistema** (ver §6).
  - Agendamiento self-service → `student-booking.service`.
- **JSONB:** `evaluacion` (calificación + comentarios).

#### `CALENDARIO` — eventos/sesiones
- **Repo dueño:** `calendar.repository` — **CRUD**. JOINs a `ADVISORS`, `ACADEMICA_BOOKINGS`.
- **Servicios consumidores (4):** `calendar`, `enrollment`, `student-booking`, `dashboard`.
  (También lo lee `admin-events.repository` por JOIN.)
- **Procesos que la ocupan:**
  - Agenda mensual/semanal, crear/editar/eliminar eventos → `calendar.service`.
  - **Eventos compartidos entre niveles** (transacción `withTransaction`) — campo `eventoCompartidoId`.
  - Calendario del panel-advisor (badge 🔗).
- **Índices:** `idx_calendario_compartido (eventoCompartidoId) WHERE NOT NULL`.

#### `ACADEMICA` — perfil académico
- **Repo dueño:** `academica.repository` — **R / U / C** (lee `PEOPLE` por JOIN).
- **Servicios consumidores (6):** `student`, `progress`, `panel-estudiante`,
  `search`, `usuarios-pegados`, `dashboard`.
- **Procesos:** progreso "¿Cómo voy?", gestión de steps, cron `reconcile-pegados`,
  creación de perfiles para beneficiarios sin registro.
- **Índices críticos:** `idx_academica_lower_email (LOWER(email))` — creado para
  el fix N+1 (§6).

#### `STEP_OVERRIDES` / `NIVELES` — `niveles.repository`
- `NIVELES`: **R** (catálogo); recibe **U** desde `libros-interactivos` (binding libro↔nivel).
- `STEP_OVERRIDES`: **CRUD** completo vía `StepOverridesRepository`.
- **Servicios:** `complementaria`, `progress`, `jump-tutor`, `panel-estudiante`, `student-booking`.
- **Procesos:** overrides manuales de step (prioridad absoluta), auto-detección de nivel paralelo (ESS).
- **JSONB:** `STEP_OVERRIDES.notaoverrideHistory` (audit append-only).

### Advisors y evaluación

| Tabla | Repo | CRUD | Servicios | Procesos |
|---|---|---|---|---|
| `ADVISORS` | `advisor` | R, C | (JOINs de `calendar`, `admin-events`, `advisor-event-log`) | Lista de advisors, crear advisor (`/nuevo-advisor`) |
| `ADVISOR_EVENT_LOG` | `advisor-event-log` | C, R (append-only) | `advisor-event-log`, `calendar` | KPIs del AdvisorDashboard / Ctrl Horas, log de cierres |
| `ADVISOR_NOTES_AUDIT` | `advisor-notes-audit` | C, R (append-only) | `advisor-event-log` | Auditoría de ediciones a notas |
| `ADMIN_EVENTS` | `admin-events` | CRUD | `admin-events` | Eventos no académicos (Training/Sup), KPI Administrative Hours |
| `ACADEMICA_BOOKING_EVALUATIONS` | `evaluations` | C, R | `evaluations` | Encuesta "Valoración de Sesiones" del estudiante |
| `JUMP_EVALUATIONS` | `jump-evaluation` | CRUD | `jump-tutor` | Evaluación de salto/promoción de nivel |
| `COMPLEMENTARIA_ATTEMPTS` | `complementaria` | CRUD | `complementaria` | Quizzes generados por IA |

### Comercial y recaudos

| Tabla | Repo | CRUD | Procesos / notas |
|---|---|---|---|
| `FINANCIEROS` | `financial` (**solo R**) | R en repo; **C/U/D en rutas** | ⚠️ Escrituras fuera de repo: INSERT en `postgres/financial`, `postgres/contracts`, `admin/migrar-contrato`; DELETE en purga; UPDATE de `saldo` en `pagos-titulares.service` (`syncFinancieroSaldo`) |
| `PAGOS_TITULARES` | `pagos-titulares` | CRUD | Centro de Validación de Pagos; lee `PEOPLE` y `FINANCIEROS` por JOIN. Índices: `idPeople`, `numeroId`, `fechaPago`, `validado` |
| `COMENTARIOS` | `comments` | C, R | Comentarios del estudiante (consumido directo por rutas, no por un service) |

### Auth, mantenimiento e infraestructura

| Tabla | Capa | CRUD | Procesos / notas |
|---|---|---|---|
| `USUARIOS_ROLES` | `roles` + `dblgs` (R) | R, U | Login (NextAuth), gestión de usuarios, "Crea UserRol" |
| `ROL_PERMISOS` | `roles` | CRUD | Matriz de permisos RBAC (caché 5 min en `middleware-permissions`) |
| `APP_CONFIG` | `config` | R, upsert | Feature flags, banner, ticker; consumido por `libros-interactivos.service` |
| `MESSAGE_TEMPLATES` | `message-templates` | CRUD | Plantillas WhatsApp (placeholders). Índices: `slug`, `activo` |
| `CRON_RUNS` | `lib/cron-runs.ts` | C, U, R | Healthcheck de cada ejecución de cron. Índice: `(cronName, startedAt DESC)` |
| `auditautoaprov` | ruta consent | C | Audit de auto-aprobación de consentimiento |
| `PURGE_LOG` | ruta purge | C | Audit de purga de contratos de prueba |
| `MATERIAL_AUDIT` | ruta materials | C | Audit de cambios en material interactivo |

---

## 3. Procesos automáticos (cron jobs)

Worker separado `scripts/cron-worker.js` (deploy como Worker en DO App Platform).
Llama a endpoints `/api/cron/*` con header `CRON_SECRET`. Cada corrida registra en `CRON_RUNS`.

| Cron | Endpoint | Horario UTC | Tablas que ocupa | Qué hace |
|---|---|---|---|---|
| `reconcile-pegados` | `/api/cron/reconcile-pegados` | 02:00 | `ACADEMICA`, `PEOPLE`, `STEP_OVERRIDES` | Reconcilia steps de estudiantes "pegados" (solo casos limpios sin overrides) |
| `reactivate-onhold` | `/api/cron/reactivate-onhold` | 03:00 | `PEOPLE` (`onHoldHistory`) | Reactiva contratos cuyo OnHold expiró |
| `expire-contracts` | `/api/cron/expire-contracts` | 04:00 | `PEOPLE` | Marca contratos vencidos como FINALIZADA |
| `health-check` | `/api/cron/health-check` | — | `CRON_RUNS` | Healthcheck de jobs |

---

## 4. Mapa inverso: servicios → tablas que tocan

Servicios ordenados por amplitud de acceso (cuántas tablas tocan vía sus repos):

| Servicio | Tablas (vía repos) |
|---|---|
| `dashboard` | PEOPLE, ACADEMICA, CALENDARIO, ACADEMICA_BOOKINGS |
| `student` | ACADEMICA, PEOPLE, ACADEMICA_BOOKINGS |
| `panel-estudiante` | PEOPLE, ACADEMICA, ACADEMICA_BOOKINGS, NIVELES |
| `progress` | PEOPLE, ACADEMICA, STEP_OVERRIDES |
| `complementaria` | COMPLEMENTARIA_ATTEMPTS, NIVELES, ACADEMICA_BOOKINGS |
| `jump-tutor` | NIVELES, JUMP_EVALUATIONS, ACADEMICA_BOOKINGS |
| `calendar` | CALENDARIO, ACADEMICA_BOOKINGS, ADVISOR_EVENT_LOG |
| `student-booking` | CALENDARIO, ACADEMICA_BOOKINGS, STEP_OVERRIDES |
| `advisor-event-log` | ADVISOR_EVENT_LOG, ADVISOR_NOTES_AUDIT |
| `pagos-titulares` | PAGOS_TITULARES, PEOPLE (+ FINANCIEROS write) |
| `usuarios-pegados` | ACADEMICA, PEOPLE |
| `enrollment` | CALENDARIO, ACADEMICA_BOOKINGS |
| `search` | PEOPLE, ACADEMICA |
| `contract` / `consent` | PEOPLE (+ FINANCIEROS write en ruta) |
| `admin-events` | ADMIN_EVENTS |
| `evaluations` | ACADEMICA_BOOKING_EVALUATIONS |
| `libros-interactivos` | LIBROS_INTERACTIVOS, NIVELES, APP_CONFIG |
| `dblgs` | (visor genérico — lectura arbitraria) |

**Tablas más demandadas:** `PEOPLE` (9 servicios), `ACADEMICA_BOOKINGS` (8),
`ACADEMICA` (6), `NIVELES`/`CALENDARIO` (4–5). Tocar su esquema impacta a casi todo el sistema.

---

## 5. Hallazgos arquitectónicos

1. **4 tablas acceden SQL fuera de la capa repositorio** (`CRON_RUNS`,
   `auditautoaprov`, `PURGE_LOG`, `MATERIAL_AUDIT`). Son audit/infra y de bajo
   riesgo, pero rompen la regla "el service nunca ejecuta SQL / todo pasa por un repo".
2. **`FINANCIEROS` tiene escrituras dispersas en 4+ rutas API** mientras su
   repositorio es solo-lectura. Si algún día cambia el esquema de `FINANCIEROS`,
   hay que tocar `financial.repository`, `postgres/financial`, `postgres/contracts`,
   `admin/migrar-contrato`, la purga y `pagos-titulares.service`. Candidato a
   consolidar en `financial.repository`.
3. **El conteo "21 tablas" de ARCHITECTURE.md está desactualizado** — el método de
   medición no ve las tablas accedidas fuera de `src/repositories`. Real: **25**.
4. **`ACADEMICA_BOOKINGS` es el cuello de botella** (§6): la tabla más grande y la
   query más cara del sistema pasan por ella.

---

## 6. Rendimiento — tablas calientes (datos reales de diagnóstico)

Medido en vivo con `pg_stat_statements` (sesión 2026-06-09, commit `81f1bef`):

- **Query más cara del sistema:** `findByStudentId` en `booking.repository`
  (historial de `/student/[id]`) — **7,277 calls × 9.7 s promedio ≈ 19.6 horas**
  de tiempo de BD acumuladas.
- **Causa raíz:** `COALESCE(b.eventoId, b.idEvento)` en el `JOIN ON CALENDARIO`
  bloqueaba los índices → **Seq Scan completo de ~165k bookings por estudiante**;
  más una subquery anidada `PEOPLE → ACADEMICA` que corría dentro del Seq Scan (O(n²)).
- **Fixes aplicados:** reescritura del JOIN + 2 índices `CREATE INDEX CONCURRENTLY`:
  `idx_academica_lower_email (LOWER(email))` y `idx_bookings_fechaevento (fechaEvento)`.
- **Contexto de infraestructura:** BD **basic `db-s-1vcpu-1gb`**, `max_connections ≈ 22`.
  El pool de la app se bajó de `max=25` a **`max=8`** para no saturarla con 2+ réplicas
  (ver `src/lib/postgres.ts`).

> Estos números son la línea base. Para el estado **actual** de tamaños, dead tuples
> e índices sin uso, correr la recolección de §7.

---

## 7. Métricas en vivo (PENDIENTE)

La conexión directa a la BD está bloqueada desde este entorno (firewall *Trusted
Sources* de DigitalOcean). Para completar esta sección con tamaños reales,
filas vivas/muertas, índices sin uso y top queries:

1. **Habilitar acceso:** en el panel de DigitalOcean → Databases → `lgs-db` →
   Settings → *Trusted Sources*, agregar la IP desde la que se corre el script
   (o correrlo desde el droplet/App Platform que ya está en la lista).
2. **Correr el recolector** (ya incluido en el repo):
   ```bash
   node scripts/db-metrics.js
   ```
   Imprime un resumen y escribe `scripts/_db-metrics-out.json` con: tamaño por
   tabla, `n_live_tup`/`n_dead_tup`, `seq_scan` vs `idx_scan`, índices por tamaño,
   índices sin uso (`idx_scan = 0`) y top 25 de `pg_stat_statements`.
3. **Pegar los resultados** aquí (tabla de tamaños + top queries + índices sin uso).

Alternativa sin firewall: usar el visor in-app `/dblgs` (DBA-light) o
`/admin/diagnostico` (mide TTFB por endpoint), que corren desde la app ya whitelisted.

---

## 8. Cómo regenerar este análisis

```bash
# Tabla → repositorio (operaciones SQL por tabla)
grep -hoE '(FROM|INTO|UPDATE|JOIN|DELETE FROM) "[A-Z_]+"' src/repositories/*.ts | sort | uniq -c

# Servicios → repositorios
grep -hE "from '@/repositories/" src/services/*.ts

# Tablas accedidas fuera de la capa repo
grep -rloE '(FROM|INTO|UPDATE|DELETE FROM) "[A-Z_a-z]+"' src/app src/lib

# Crons
ls src/app/api/cron/*/route.ts

# Métricas en vivo (requiere IP whitelisted)
node scripts/db-metrics.js
```
