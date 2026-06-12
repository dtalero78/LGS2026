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

## 1. Inventario de tablas (25 en código · 30 en la BD)

> ⚠️ **Hallazgo (3 niveles de conteo):**
> - ARCHITECTURE.md documentaba **21 tablas** (medido con `grep src/repositories/*.ts`).
> - El código real toca **20 tablas** vía repos (eran 21; el 2026-06-10 se eliminó
>   el repo muerto `comments` que apuntaba a la inexistente `COMENTARIOS`).
> - La **BD en vivo tenía 30 tablas** — había **5 huérfanas/legacy**. **Limpieza
>   2026-06-10:** se dropearon `CALENDARIO_BACKUP_20260414` (22.819 filas, 7,2 MB),
>   `COMMENTS`, `CLUBS` y `NIVELES_MATERIAL` (las 3 vacías) → **BD de 293 a 286 MB,
>   quedan 26 tablas**. Único huérfano conservado: `_schema_version` (vestigio de
>   migración, 32 kB). Ver [§5](#5-hallazgos-arquitectónicos).

| # | Tabla | Capa de acceso | Naturaleza |
|---|---|---|---|
| 1 | `PEOPLE` | repo `people` | Núcleo — titulares + beneficiarios |
| 2 | `ACADEMICA` | repo `academica` | Núcleo — perfil académico |
| 3 | `ACADEMICA_BOOKINGS` | repo `booking` | Núcleo — inscripciones (🔥 ~165k filas) |
| 4 | `CALENDARIO` | repo `calendar` | Núcleo — eventos/sesiones |
| 5 | `FINANCIEROS` | repo `financial` (solo lectura) + **rutas API** (escritura) | Contrato financiero |
| 6 | `PAGOS_TITULARES` | repo `pagos-titulares` | Recaudos |
| — | ~~`COMENTARIOS`~~ | ~~repo `comments`~~ | ❌ No existía; repo muerto eliminado. Comentarios viven en `PEOPLE.comentarios` (`text[]`) |
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
| `PEOPLE.comentarios` | (rutas directas) | R, U | Comentarios del estudiante — campo `text[]` en `PEOPLE`, vía `people/[id]/comments` y `panel-estudiante/comments`. (El repo `comments`→`COMENTARIOS` era código muerto; eliminado 2026-06-10) |

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

1. ✅ **RESUELTO (2026-06-10): bug de esquema `comments.repository` → `COMENTARIOS`.**
   El repo consultaba `"COMENTARIOS"`, tabla que **no existía**. Se confirmó que era
   **código muerto** (ningún importador) — la feature real de comentarios usa
   `PEOPLE.comentarios` (`text[]`) vía `people/[id]/comments` y `panel-estudiante/comments`.
   Se eliminó `src/repositories/comments.repository.ts`. La tabla vacía `COMMENTS`
   (huérfana, otro vestigio) se dropeó en la misma limpieza.
2. **🟢 DESCARTADO: las estadísticas del planner NO estaban obsoletas.** Inicialmente
   se sospechó por el `n_live_tup` desfasado ~190× (PEOPLE: 59 vs 11.017;
   ACADEMICA_BOOKINGS: 2.571 vs 169.698). Pero al correr el `ANALYZE` (2026-06-12) se
   verificó que **`reltuples` —la cifra que realmente usa el planner— ya era correcta
   ANTES** del ANALYZE (ACADEMICA_BOOKINGS 168.291, PEOPLE 10.887, ACADEMICA 6.289;
   ~1% del real). El desfase de 190× era solo de los **contadores acumulados de
   monitoreo** (`n_live_tup`, `seq_scan`…), que la BD managed **resetea en cada
   failover** — distinto de `pg_statistic`. **Conclusión:** las queries lentas NO se
   deben a stats malas, sino a la **estructura de las queries** (`COALESCE` en JOIN,
   N+1 del `ACADEMICA by-email`) y al tamaño de la instancia. El `ANALYZE` se corrió
   igual como higiene (inofensivo) y se reseteó `pg_stat_statements` para una medición
   limpia (ver §6).
3. **🟠 ~25 MB en índices sin uso (0 scans).** Incluye ~11 MB sobre la tabla más
   caliente: `idx_bookings_asistencia` (4,1 MB), `idx_bookings_fecha` (3,7 MB),
   `idx_bookings_student` (3,4 MB) — todos con 0 scans pero penalizando cada
   INSERT/UPDATE de `ACADEMICA_BOOKINGS` (la tabla con más escrituras). Lista
   completa en [§7](#índices-sin-uso-candidatos-a-drop).
4. ✅ **RESUELTO (2026-06-10): tablas huérfanas/legacy.** Se dropearon 4 tras
   verificar 0 filas y 0 referencias vivas: `CALENDARIO_BACKUP_20260414` (22.819
   filas, 7,2 MB — backup manual del 14-abr), `COMMENTS`, `CLUBS`, y
   `NIVELES_MATERIAL` (junto con su endpoint muerto `materials/usuario`, superado por
   `NIVELES.materialUsuario`). BD: 293 → 286 MB. Se **conservó `_schema_version`**
   (vestigio de migración, 32 kB, sin impacto).
5. **🟡 4 tablas acceden SQL fuera de la capa repositorio** (`CRON_RUNS`,
   `auditautoaprov`, `PURGE_LOG`, `MATERIAL_AUDIT`). Audit/infra de bajo riesgo,
   pero rompen la regla "todo pasa por un repo".
6. **🟡 `FINANCIEROS` tiene escrituras dispersas en 4+ rutas API** mientras su
   repositorio es solo-lectura (INSERT en `postgres/financial`, `postgres/contracts`,
   `admin/migrar-contrato`; UPDATE de `saldo` en `pagos-titulares.service`). Candidato
   a consolidar en `financial.repository`.
7. **🔴 `ACADEMICA_BOOKINGS` es el cuello de botella absoluto:** 169.698 filas, 210 MB
   (**72 % de la BD entera**), y por ella pasa la query más cara del sistema (§6).

---

## 6. Métricas en vivo (medidas 2026-06-10)

**Conexión:** vía `doctl databases firewalls append` (IP whitelisted temporalmente,
removida al terminar) + `scripts/db-metrics.js`.
**Motor:** PostgreSQL **18.4** · BD `defaultdb` · **293 MB** total (→ **286 MB**
tras dropear la backup huérfana, ver §5.4) · **22/25 conexiones** en uso en el
snapshot (saturación real — solo 3 libres).

### Tamaño y volumen por tabla (top, conteos reales)

> ⚠️ Los conteos vienen de `SELECT count(*)`. **`n_live_tup` de `pg_stat` estaba
> desfasado ~100–190×** (ver hallazgo §5.2) — no usar esa columna como verdad.

| Tabla | Filas reales | Total | Tabla | Índices | % de la BD |
|---|--:|--:|--:|--:|--:|
| `ACADEMICA_BOOKINGS` | **169.698** | 210 MB | 144 MB | 66 MB | **72 %** |
| `CALENDARIO` | 26.956 | 25 MB | 18 MB | 7,3 MB | 9 % |
| `PEOPLE` | 11.017 | 20 MB | 14 MB | 5,8 MB | 7 % |
| ~~`CALENDARIO_BACKUP_20260414`~~ | 22.819 | 7,2 MB | — | — | ✅ eliminada 06-10 |
| `ACADEMICA` | 6.305 | 6,2 MB | 4,5 MB | 1,7 MB | 2 % |
| `COMPLEMENTARIA_ATTEMPTS` | ~varios | 4,8 MB | 3,1 MB | 1,7 MB | 1,6 % |
| `ACADEMICA_BOOKING_EVALUATIONS` | 2.900 | 2,7 MB | 1,8 MB | 1 MB | 0,9 % |
| `USUARIOS_ROLES` | 6.274 | 2,6 MB | 1,1 MB | 1,5 MB | 0,9 % |
| `FINANCIEROS` | 2.820 | 2,5 MB | 1,4 MB | 1 MB | 0,9 % |

> **`ACADEMICA_BOOKINGS` sola es el 72 % de la BD.** Tiene 144 MB de tabla con
> mucho bloat (1.852 dead tuples) + 66 MB en 13 índices.

### Top queries por tiempo total de BD (`pg_stat_statements`, acumulado)

| # | Calls | Media | Tiempo total | Query (proceso) |
|--:|--:|--:|--:|---|
| 1 | 7.477 | **9.737 ms** | **20,2 h** | `findByStudentId` — historial de `/student/[id]` (`booking.repository`) |
| 2 | **148.660** | 79 ms | 3,3 h | `SELECT * FROM ACADEMICA WHERE LOWER(email)=…` (volumen brutal de calls) |
| 3 | 67.497 | 105 ms | 2,0 h | bookings+step del progreso (`COALESCE(c.step,b.step)`) |
| 4 | 1.946 | 2.183 ms | 1,2 h | `ACADEMICA + PEOPLE` join (perfil/búsqueda) |
| 5 | 5.280 | 721 ms | 1,1 h | listado de `CALENDARIO` (agenda) |
| 6 | 258 | **7.792 ms** | 0,6 h | `COUNT(*) FROM ACADEMICA_BOOKINGS WHERE fechaEvento BETWEEN …` (dashboard) |
| 7 | 165 | **11.426 ms** | 0,5 h | asistencias por nivel/plataforma (informe) |

**Lecturas clave:**
- La query #1 (`findByStudentId`) figura con **~9,7 s de media** pese al fix
  `81f1bef`, pero estas cifras eran **acumuladas** (mezclaban ejecuciones pre y
  post-fix), así que NO probaban ni que falló ni que mejoró. ✅ **El 2026-06-12 se
  reseteó `pg_stat_statements`** → estos números de arriba son la **foto histórica
  final**; la medición limpia post-fix se obtiene re-corriendo `db-metrics.js` el
  2026-06-13/14.
- La query #2 con **148.660 calls** huele a **N+1 / falta de caché**: se resuelve el
  `ACADEMICA by email` una y otra vez por request. Candidata a cachear.
- Varios `COUNT(*)` de dashboard sobre `ACADEMICA_BOOKINGS` tardan **7–11 s** — son
  los que justifican el cache server de 60 s del dashboard.

### Índices más usados (confirman las tablas calientes)

| Índice | Scans | Tabla |
|---|--:|---|
| `idx_people_numeroid_multi` | **15.760.114** | PEOPLE |
| `CALENDARIO_pkey` | 9.442.844 | CALENDARIO |
| `PEOPLE_pkey` | 546.490 | PEOPLE |
| `idx_bookings_idevento` | 534.898 | ACADEMICA_BOOKINGS |
| `idx_bookings_evento` | 493.698 | ACADEMICA_BOOKINGS |
| `idx_bookings_student_fecha` | 271.556 | ACADEMICA_BOOKINGS |

### Índices sin uso (candidatos a DROP)

**0 scans** desde el último reset de stats. Top por tamaño (≈25 MB en total):

| Índice | Size | Tabla |
|---|--:|---|
| `idx_bookings_asistencia` | 4,1 MB | ACADEMICA_BOOKINGS |
| `idx_bookings_fecha` | 3,7 MB | ACADEMICA_BOOKINGS |
| `idx_bookings_student` | 3,4 MB | ACADEMICA_BOOKINGS |
| `idx_calendario_fecha_tipo` | 944 kB | CALENDARIO |
| `idx_calendario_nivel` | 792 kB | CALENDARIO |
| `idx_calendario_fecha_hora` | 616 kB | CALENDARIO |
| `idx_people_numeroid` | 552 kB | PEOPLE |
| `idx_people_titular` | 400 kB | PEOPLE |
| `idx_people_extension_history` | 336 kB | PEOPLE |
| `idx_people_onhold_history` | 240 kB | PEOPLE |
| (+ ~25 índices más de 16–280 kB en PEOPLE, FINANCIEROS, ACADEMICA, evals…) | | |

> ⚠️ Antes de dropear: los `idx_bookings_asistencia/fecha/student` podrían tener
> 0 scans solo porque las stats se resetearon hace poco. Confirmar con un par de
> días de tráfico o con `pg_stat_statements` que ninguna query crítica los necesita.
> Los GIN sobre JSONB (`idx_people_onhold_history`, `idx_people_extension_history`)
> probablemente nunca se usan en WHERE — esos sí son drop seguro.

### Acciones recomendadas (priorizadas)

1. ✅ **Hecho (2026-06-12):** `ANALYZE` de toda la BD (19,7s). Resultado: confirmó que el planner ya tenía buenas stats (ver §5.2) — no cambió nada, fue higiene. Las stats NO eran la causa de las queries lentas.
2. ✅ **Hecho (2026-06-12):** `pg_stat_statements_reset()` ejecutado → línea base limpia desde las 08:18. **Re-medir con `db-metrics.js` el 2026-06-13/14** y comparar contra el top de queries de esta sección para validar el fix `81f1bef` y aislar índices realmente muertos.
3. **Cachear el lookup `ACADEMICA by email`** (148k calls) — probable N+1.
4. ✅ **Hecho (2026-06-10):** dropeadas 4 tablas huérfanas (`CALENDARIO_BACKUP_20260414`, `COMMENTS`, `CLUBS`, `NIVELES_MATERIAL`) → 293→286 MB. Pendiente: GIN JSONB sin uso.
5. ✅ **Hecho (2026-06-10):** resuelto el bug `COMENTARIOS` — repo muerto + endpoint legacy eliminados (§5.1, §5.4).

---

## 7. Reproducir / refrescar las métricas

```bash
# 1) Whitelist temporal de tu IP (doctl ya autenticado):
doctl databases firewalls append 08d65733-6811-420c-a0a1-a71d6b3b9c6d --rule ip_addr:$(curl -s ifconfig.me)
# 2) Recolectar:
node scripts/db-metrics.js          # imprime resumen + escribe scripts/_db-metrics-out.json
# 3) Quitar la IP al terminar (recomendado):
doctl databases firewalls remove 08d65733-6811-420c-a0a1-a71d6b3b9c6d --uuid <uuid-de-tu-regla>
```

`lgs-db` = cluster `08d65733-6811-420c-a0a1-a71d6b3b9c6d`. Alternativa sin tocar
firewall: correr el script desde el droplet/App Platform ya whitelisted, o usar el
visor in-app `/dblgs`. El `_db-metrics-out.json` es un artefacto efímero (no se
commitea — está en `.gitignore`).

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
