# 01 — Auditoría de gates (handlers de escritura)

> Auditoría **read-only** de todos los handlers bajo `src/app/api/` que hacen `INSERT`/`UPDATE`/`DELETE`. Para cada uno: si está envuelto en `handlerWithAuth`/`requirePermission`, qué permiso exige, desde qué pantalla del inventario ([`00-inventario.md`](00-inventario.md)) se invoca, y una **bandera** cuando no tiene gate o cuando su permiso no coincide con el de la pantalla que lo llama.
>
> **Snapshot:** 2026-08-10. Cobertura: **115 handlers de escritura**. Metodología: 3 barridos read-only del árbol `src/app/api/` (`postgres/` core · financiero+`admin/` · legacy/público/consent/cron), cruzados con `ROUTE_PERMISSIONS` de [`src/middleware.ts`](../../src/middleware.ts) / [`src/lib/middleware-permissions.ts`](../../src/lib/middleware-permissions.ts) y con el snapshot de `ROL_PERMISOS`. **No se modificó código.**

---

## Causa raíz (leer primero)

El `matcher` del middleware **excluye `/api`** ([`src/middleware.ts` `config.matcher`](../../src/middleware.ts)). Por lo tanto **ningún handler de escritura está gateado por ruta**: cada `route.ts` se protege solo con lo que traiga adentro:

- `handlerWithAuth` → exige **solo que exista sesión** (cualquier rol, incluido `ESTUDIANTE`/`READONLY`).
- `requirePermission(...)` → exige un permiso concreto (defensa real en el servidor).
- `handler` → **público** (sin auth).
- chequeo inline `SUPER_ADMIN`/`ADMIN`, `CRON_SECRET`, `WIX_SECRET` → según el caso.

El permiso que se ve en la pantalla (`usePermissions` / `<PermissionGuard>`) es **visibilidad del cliente**; si el endpoint solo usa `handlerWithAuth`, ese permiso **no se revalida en el servidor** y una llamada directa lo salta.

## Resumen por severidad

| # | Categoría | Qué significa | Handlers |
|---|---|---|---|
| 🔴 A | **Escritura PÚBLICA** (sin auth) | Cualquiera dispara un write en BD | 3 |
| 🔴 B | **Escalación de privilegios** (`solo-sesión` sobre gestión de roles/cuentas) | Una sesión cualquiera crea roles / reescribe permisos / cambia roles / crea logins | 4 |
| 🟠 C | **Gap admin** (`solo-sesión` en pantalla admin) | Cualquier autenticado ejecuta acción restringida por la pantalla | 6 |
| 🟠 D | **Patrón sistémico** (API `solo-sesión`, gate **solo en cliente**) | La API no revalida el permiso `STUDENT.*/PERSON.*/ACADEMICO.AGENDA` | ~29 |
| 🟡 E | **API más estricta que el permiso** (SA/ADMIN inline vs permiso granular) | NO es hueco: el permiso granular de la pantalla no sirve para roles no-admin | 9 |
| 🌍 F | **Falta scope país** | Write masivo de Recaudos sin filtro de plataforma | 1 |

---

## 🔴 A — Escritura pública (crítico)

| Ruta (`src/app/api/`) | Métodos | Wrapper | Pantalla / permiso doc | Nota |
|---|---|---|---|---|
| `contracts/[id]/send-pdf` | POST | `handler` **público** | `/dashboard/comercial/contrato/[id]` → doc `COMERCIAL.CONTRATO.ENVIAR_PDF` | PDF (API2PDF) + **WhatsApp** + archiva Drive, sin auth. También MISMATCH vs su gate documentado. |
| `contracts/[id]/documents` | POST, DELETE | `handler` **público** | contrato admin / StudentGeneral / PersonGeneral / UploadDocButton | UPD `PEOPLE.documentacion` + **borra objeto en DO Spaces** sin auth. |
| `postgres/advisors/create` | POST | `handler` **público** | `/nuevo-advisor` (pública) | INS `ADVISORS` + **INS `USUARIOS_ROLES` login rol=ADVISOR** → cualquiera crea cuentas de advisor. |

## 🔴 B — Escalación de privilegios (`solo-sesión`, sin rol/permiso)

| Ruta | Métodos | Wrapper | Escribe | Nota |
|---|---|---|---|---|
| `postgres/roles` | POST | `handlerWithAuth` **solo-sesión** | INS `ROL_PERMISOS` | Crea roles. El equivalente **gateado** es `/api/roles/create` (SA/ADMIN inline); este duplicado no valida rol. |
| `postgres/roles/[rol]/permissions` | PUT | `handlerWithAuth` **solo-sesión** | UPD `ROL_PERMISOS.permisos` | **Reescribe los permisos de cualquier rol.** Duplicado sin gate de `/api/permissions/update` (SA/ADMIN). |
| `postgres/users/[email]/role` | PUT | `handlerWithAuth` **solo-sesión** | UPD `USUARIOS_ROLES.rol` | Cambia el rol de cualquier usuario. |
| `postgres/advisors/create` | POST | `handler` público | INS `USUARIOS_ROLES` | (también en A) crea login ADVISOR. |

## 🟠 C — Gap admin (cualquier sesión ejecuta acción restringida)

| Ruta | Wrapper | Pantalla / permiso documentado | Nota |
|---|---|---|---|
| `admin/bloqueo-contrato/execute` | **solo-sesión** (sin rol/permiso) | `MANTENIMIENTO.CONTRATOS.BLOQUEAR` | Inactiva contrato en `PEOPLE`+`ACADEMICA`+`USUARIOS_ROLES`. |
| `admin/migrar-contrato` | **solo-sesión** (sin rol/permiso) | `MANTENIMIENTO.CONTRATOS.MIGRAR` | Crea `PEOPLE`+`FINANCIEROS`+`PAGOS_TITULARES`. |
| `postgres/people/bulk-import` | solo-sesión | `/subir-lote` (pág. SUPER_ADMIN) | UPSERT masivo de `PEOPLE` (≤5000). |
| `postgres/students/[id]/change-password` | solo-sesión | StudentGeneral (sin gate específico) | Reescribe la clave de login de cualquier estudiante. |
| `postgres/financial` | solo-sesión | `sin-caller-UI` | INS `FINANCIEROS` huérfano (sin pantalla que lo llame). |
| `admin/sync-plataforma-bookings` | **sin wrapper propio** (delega a `sync-field`) | deprecated, sin caller | Verificar: la protección depende del delegado. |

## 🟠 D — Patrón sistémico: API `solo-sesión`, permiso solo en cliente

Todos escriben y **la pantalla exige un permiso que el endpoint no revalida** → una llamada directa (cualquier sesión) lo salta.

| Ruta | Métodos | Permiso que exige la pantalla (no la API) |
|---|---|---|
| `postgres/people/route` | POST | `PERSON.INFO.AGREGAR_BENEFICIARIO` |
| `postgres/people/[id]` | PATCH, DELETE | `PERSON.INFO.MODIFICAR` / `CAMBIAR_ESTADO` / `ELIMINAR` |
| `postgres/people/[id]/approve` | POST | `PERSON.ADMIN.APROBAR` (+ guard PRB para SUPER_ADMIN) |
| `postgres/students/[id]/update` | PUT | (gate de pantalla no confirmado) |
| `postgres/students/[id]/step` | PUT | `STUDENT.ACADEMIA.ASIGNAR_STEP` |
| `postgres/students/[id]/step-override` | POST, DELETE | `STUDENT.ACADEMIA.MARCAR_STEP` / `ASIGNAR_STEP` |
| `postgres/students/[id]/extend` · `postgres/students/contract` | POST · PUT | `STUDENT.CONTRATO.EXTENDER_VIGENCIA` |
| `postgres/students/onhold` | POST | `STUDENT.CONTRATO.ACTIVAR_HOLD` |
| `postgres/students/[id]/toggle-status` | POST | `PERSON.ADMIN.ACTIVAR_DESACTIVAR` |
| `postgres/students/[id]/inicializar-nivel` | POST | `STUDENT.ACADEMIA.INICIALIZAR_NIVEL` |
| `postgres/students/[id]/cambio-step-auditado` | POST | `STUDENT.ACADEMIA.ASIGNAR_STEP` |
| `postgres/students/[id]/sence` | POST | `STUDENT.GENERAL.FRANQUICIA_SENCE` |
| `postgres/contracts/route` · `postgres/contracts/[id]` | POST · PUT | acceso genérico COMERCIAL |
| `postgres/approvals/[id]` | PUT | acceso genérico APROBACIÓN (2.ª vía de aprobar) |
| `postgres/events/route` · `events/[id]` · `events/[id]/add-levels` | POST · PUT/DELETE · POST | `ACADEMICO.AGENDA.*` |
| `postgres/events/[id]/enroll/[bookingId]` | DELETE | `AGENDAR_CLASE` / `ACADEMICO.AGENDA` |
| `postgres/academic/evaluation` · `attendance` · `academic/[id]` · `academic-record` | POST/PUT/DELETE | `STUDENT.ACADEMIA.EVALUACION` / `ELIMINAR_EVENTO` |
| `postgres/academic/user` | POST | `ACADEMICO.AGENDA` |
| `postgres/materials/manage` | POST/DELETE/PATCH | `ACADEMICO.MATERIAL.ACTUALIZAR` (usa `getServerSession` crudo) |
| `postgres/servicio/exam-intern/aplicar-confirmacion` | POST | `SERVICIO.EXAM_INTERN.*_APLICAR_CONFIRMACION` (extiende/bloquea contrato + WhatsApp) |

## 🟡 E — API más estricta que el permiso (mismatch, NO es hueco)

Exigen **SUPER_ADMIN/ADMIN inline**, pero la pantalla/catálogo documenta un permiso granular → un rol que tenga ese permiso pero no sea SA/ADMIN **queda bloqueado** (bug funcional, no de seguridad).

| Ruta | Wrapper | Permiso granular de la pantalla |
|---|---|---|
| `postgres/config/banner` · `postgres/config/ticker` | SA inline | `MANTENIMIENTO.AVISOS.BANNER` / `TICKER` |
| `admin/clear-historic/student` | SA/ADMIN inline | `MANTENIMIENTO.USUARIOS.CLEAR_HISTORIC` |
| `admin/drive-mode` | SA/ADMIN inline | `MANTENIMIENTO.CONTRATOS.DRIVE_CONFIG` |
| `admin/scripts/usuarios-pegados/aplicar` | SA/ADMIN inline | `MANTENIMIENTO.SCRIPTS.USUARIOS_PEGADOS` |
| `admin/videos/{check-niveles,instructivos,migrate-static,sesiones}` | `getServerSession` SA/ADMIN | `ACADEMICO.MATERIAL.ACTUALIZAR` |

## 🌍 F — Falta scope país

| Ruta | Nota |
|---|---|
| `postgres/recaudos/asignar-masivo` (POST) | `UPDATE PEOPLE.gestorRecaudo` masivo **sin** `buildPlataformaWhereSql`, mientras el resto de Recaudos sí aplica el filtro de plataforma ([`src/lib/recaudos-scope.ts`](../../src/lib/recaudos-scope.ts)). |

---

## ✅ Correctamente gateados (sin bandera)

`pagos-titulares/*` (`PAGOS_*`), `pagos-titulares/validar-masivo` (`RECAUDOS.APROBACION_MASIVA`), `matriculas/delete` (`COMERCIAL.MATRICULAS.BORRAR`), `admin-events/*` (`ACADEMICO.ADMIN_EVENTS.*`), `proteccion-historial` (`PERSON.INFO.AGREGAR_BENEFICIARIO`), `people/[id]/{marca-opcional,cambio-cartera}`, `events/[id]/enroll` (`AGENDAR_CLASE`), `aprobacion/conversion-titular/convertir` (`CONVERSION_TITULAR_VER`), `jump-evaluaciones/[id]/review` (`JUMP_EVAL_REVISAR`), `consent/[id]/auto-approve` (`APROBACION_AUTONOMA`), `contracts/[id]/regenerate-drive` (`GENERAR_CONTRATO`), `admin/contratos-prueba/purge` (`CONTRATOS_PRUEBA`), `admin/plantillas*` (`PLANTILLAS.GESTION`), `admin/users/create-*` + `admin/filiales*` (`CREAR_ROL`), `admin/lgs-buckets/replace` (`LGS_BUCKETS.EDITAR`), `admin/libros-interactivos/*` (`MATERIAL.ACTUALIZAR`), `admin/sync-field`+`sync-steps`+`feature-flags/*` (SA/ADMIN), `dblgs/[table]` (assertAdmin), `advisors/[id]` (`LGS_BUCKETS_EDITAR`), `advisors/update-profile` + `panel-estudiante/*` (dueño de la sesión), `calendario/*` (ownership en el service), `roles/create` + `permissions/update` (SA/ADMIN inline), `cron/*` (`CRON_SECRET`), `wix/*` (`WIX_SECRET`|sesión), `consent/[id]/verify` + `auth/forgot-password/reset-password` + `nuevo-usuario/[id]` + `reagendar-welcome/[id]` (público intencional con identidad/OTP/token/HMAC).

## Notas

- **Escrituras públicas fuera de BD:** `contracts/[id]/upload-url`, `nuevo-usuario/[id]/upload-photo`, `nuevo-usuario/photo-presign` son POST públicos que escriben a DO Spaces (no a BD) sin auth.
- `internal/verify-credentials` fue confirmado **eliminado** (ya no existe la fuga histórica que devolvía credenciales).
- `nuevo-usuario/[id]` es público con el `id` como token (enviado por WhatsApp) — **sin OTP**; adecuado para el flujo de auto-registro, pero conviene tenerlo presente.

---

### Direcciones de la corrección (para cuando se aborde; fuera de alcance de esta auditoría)

1. **A/B/C** (huecos reales): agregar `requirePermission(...)` en el servidor con el permiso de la pantalla; quitar el `handler` público de `advisors/create`, `contracts/[id]/{documents,send-pdf}`; retirar o gatear los duplicados `postgres/roles*` / `postgres/users/[email]/role`.
2. **D** (sistémico): añadir `requirePermission(...)` a cada endpoint de mutación de `students`/`people`/`events`/`academic`/`materials`/`contracts`/`approvals`, replicando el permiso que ya usa el `<PermissionGuard>` de la pantalla (defensa en profundidad).
3. **E**: reemplazar el chequeo inline `SUPER_ADMIN/ADMIN` por `requirePermission(<permiso granular>)` (SA/ADMIN siguen pasando por bypass) para que el permiso de la matriz funcione.
4. **F**: aplicar `buildPlataformaWhereSql` en `recaudos/asignar-masivo`.
