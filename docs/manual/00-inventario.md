# 00 — Inventario de procesos

> Mapa único que cruza, para cada **proceso real** de la plataforma (respaldado siempre por una ruta o handler que existe en `src/app/`): **Módulo · Proceso · Ruta/pantalla · Roles con permiso · Modelos Prisma que escribe · ¿Efecto irreversible?**, cruzado con el sistema de permisos por país.
>
> **No se inventan procesos**: cada fila apunta a un `page.tsx` o `route.ts` real. Los procesos que solo *leen* datos (informes, consultas) se marcan con `— (lee)` en la columna de escritura.
>
> **Snapshot de roles:** los nombres de rol de la columna "Roles con permiso" se resolvieron de la tabla `ROL_PERMISOS` el **2026-08-10**. El mapeo permiso→rol es dinámico (editable en `/admin/permissions`); esta es una foto puntual. El/los **código(s) de permiso** que gatean cada proceso son la referencia estable.

---

## Cómo funciona el control de acceso

El middleware ([`src/middleware.ts`](../../src/middleware.ts)) resuelve el acceso a **pantallas** en 5 niveles (primero que aplica gana):

1. **Rutas públicas / estáticas** — se saltan por completo el middleware: `/contrato/*`, `/nuevo-usuario/*`, `/nuevo-advisor`, `/reagendar-welcome/*`, `/api/auth/*`, `_next`, y cualquier ruta con `.`.
2. **Bypass total `SUPER_ADMIN` / `ADMIN`** — acceso a todo, sin importar `ROL_PERMISOS`. Por eso aparecen como `SA/ADM (bypass)` en cada fila (aunque el rol no tenga el código listado en la BD).
3. **Always-allowed (cualquier autenticado)** — prefijos `/person`, `/student`, `/sesion`, `/advisor`, `/panel-estudiante`, `/advisor-setup`, `/student-setup`. La pantalla carga para cualquier sesión válida; **las acciones internas se gatean con `<PermissionGuard>`** por permiso.
4. **`ROUTE_PERMISSIONS` (match exacto)** — la ruta exige *alguno* de una lista de permisos (semántica OR). Fuente: [`src/lib/middleware-permissions.ts`](../../src/lib/middleware-permissions.ts).
5. **`GENERIC_ROUTE_ACCESS` (por prefijo padre)** — solo `/dashboard/academic`, `/dashboard/servicio`, `/dashboard/comercial`, `/dashboard/informes`: basta *cualquier* permiso del módulo.
6. **Default-permit** — una ruta que no cae en 1–5 (p. ej. varias `/admin/*` y `/dblgs`, `/subir-lote`) es **permitida por el middleware a cualquier autenticado**; su verdadero candado vive **en la página (`<PermissionGuard>`) y en el endpoint (`requirePermission`)**.

> ⚠️ **El matcher del middleware EXCLUYE `/api`** ([`middleware.ts` `config.matcher`](../../src/middleware.ts)). Por lo tanto **los handlers de escritura NO están gateados por el middleware**: cada `route.ts` se protege solo con `handlerWithAuth` (sesión) y/o `requirePermission(...)`. La columna "Roles con permiso" refleja el permiso efectivo del proceso (el de la pantalla de entrada o, cuando el handler exige uno más estricto, el del handler).

`pagePermissions` / `sectionPermissions` en [`DashboardLayout.tsx`](../../src/components/layout/DashboardLayout.tsx) solo controlan **visibilidad del sidebar**, no el acceso.

---

## Permisos por país (scope de plataforma) — 🌍

Origen: `USUARIOS_ROLES.plataforma`. Lógica en [`src/lib/recaudos-scope.ts`](../../src/lib/recaudos-scope.ts) (`computePlataformaScope`, `getSessionPlataforma`, `buildPlataformaWhereSql`).

| `plataforma` del usuario | Qué ve |
|---|---|
| `SUPER_ADMIN` / `ADMIN`, o `NULL`, o `Internacional` | **Todo** (sin filtro) |
| `Chile` | **Solo Chile** (aislado) |
| `Colombia` | **Todo excepto Chile** (incluye registros con plataforma `NULL`) |
| `Ecuador`, `Perú`, u otra | **Solo su propia plataforma** |

**Único módulo con scope por país** (marcado 🌍 en las tablas): **Recaudos** — `/dashboard/recaudos/{gestion,bancos,asignacion,aprobaciones}` y el **dropdown de gestores** del modal "Asignar Ejecutivo de Recaudos" en `/person/[id]` (endpoint `users/by-role`). El filtro se compone con el RBAC vía `AND` en el SQL. Ningún otro módulo aplica scope país.

---

## Leyenda

**Irreversibilidad (última columna):**
- ✅ No — reversible / idempotente
- 🔴 Sí — `DELETE` físico **sin** snapshot recuperable
- 🟠 Sí — `DELETE` físico **con** snapshot en `PURGE_LOG` (recuperación manual)
- 📤 Sí — envío externo (WhatsApp vía Whapi / PDF vía API2PDF): no se puede "des-enviar"
- 🔒 Sí — **bloquea login** cross-tabla (reversible por reactivación, pero corta acceso)
- ⚖️ Sí — hash SHA-256 de consentimiento / valor legal
- 🔢 Parcial — consume número de contrato secuencial (no reutilizable)
- 📌 Parcial — tras validar, el registro queda bloqueado a edición/borrado

**Roles (abreviaturas)** — `SA/ADM (bypass)` = SUPER_ADMIN y ADMIN siempre. Demás:
`AJ`=ACADEMICO_JEFE · `ADMJ`=ADMINISTRACION_JEFE · `ADV`=ADVISOR · `APC`=APROBACION_CONTRATOS · `APG`=APROBACION_GESTOR · `COM`=COMERCIAL · `CO`=CONTRATO_ONLY · `CA`=COORDINADOR_ACADEMICO · `RO`=READONLY · `RA`=RECAUDO_ASIST · `RJ`=RECAUDOS_JEFE · `SVA`=SERVICIO_ASIST · `SVJ`=SERVICIO_JEFE · `TAL`=TALERO.
† = ningún rol (además de SA/ADM) tiene ese permiso en el snapshot actual.

---

## Autenticación / Acceso

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Auth | Login (email/clave) | `/login` · `POST /api/auth/[...nextauth]` | Público (bloquea si `activo=false` o contrato vencido) | — (lee `USUARIOS_ROLES`) | ✅ |
| Auth | Logout | `POST /api/auth/logout` | Autenticado | — | ✅ |
| Auth | ¿Olvidaste tu contraseña? (OTP → reset) | `/login` (modal) · `/api/auth/forgot-password/{check-email,verify-identity,verify-otp,reset-password}` | Público (verifica identidad + OTP; rate-limit) | `USUARIOS_ROLES` (password), `ACADEMICA` (clave) | 📤 (OTP WhatsApp) · ⚠️ clave en texto plano |
| Auth | Puente SSO CRM | `/api/auth/crm-bridge` | HMAC cross-app | — (lee) | ✅ |

---

## Dashboard

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Dashboard | Inicio (stats / gráficas IA) | `/` · `/api/postgres/dashboard/*` | Cualquier autenticado (rol `ADVISOR` ve su panel propio) | — (lee) | ✅ |

---

## Académico

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Académico | Agenda Sesiones (ver / filtrar / exportar) | `/dashboard/academic/agenda-sesiones` | SA/ADM + AJ, ADMJ, CA, RO, RJ, RA, SVA, SVJ | — (lee `CALENDARIO`) | ✅ |
| Académico | Crear / editar evento | `POST` / `PUT /api/postgres/events/[id]` | SA/ADM + AJ, ADMJ, CA, SVJ (`ACADEMICO.AGENDA.CREAR_EVENTO`/`EDITAR`) | `CALENDARIO`, `ACADEMICA_BOOKINGS` (propaga), `ADVISOR_EVENT_LOG` (cambio advisor) | ✅ (editar propaga a bookings) |
| Académico | Eliminar evento | `DELETE /api/postgres/events/[id]` | SA/ADM + AJ, CA, RJ (`ACADEMICO.AGENDA.ELIMINAR`) | `DEL CALENDARIO`, `DEL ACADEMICA_BOOKINGS`, `INS ADVISOR_EVENT_LOG` | 🔴 (borra evento + inscripciones; log Suspended) |
| Académico | Enrolar / desenrolar (bulk enroll) | `POST`/`DELETE /api/postgres/events/[id]/enroll` | SA/ADM + AJ, ADMJ, CA, RJ, RA, SVA, SVJ (`STUDENT.ACADEMIA.AGENDAR_CLASE`) | `ACADEMICA_BOOKINGS`, `CALENDARIO` (cupo) | enrolar ✅ / desenrolar 🔴 (DEL booking) |
| Académico | Agenda Académica (semanal) | `/dashboard/academic/agenda-academica` | SA/ADM + AJ, ADMJ, CA, RJ, RA, SVA, SVJ | — (lee) | ✅ |
| Académico | Advisors (lista) + crear | `/dashboard/academic/advisors` | SA/ADM + AJ, ADMJ, CA, SVJ | — (crear vía `/nuevo-advisor`) | ✅ |
| Académico | Control de Horas — registrar sesión / notas | `/dashboard/academic/control-horas` · `/sesion/[id]` · `PATCH .../notas-advisor` · `POST .../cerrar-sesion` | SA/ADM + AJ, ADV, CA, SVJ (`ACADEMICO.CONTROL_HORAS.VER`) | `CALENDARIO`, `ACADEMICA_BOOKINGS`, `ADVISOR_NOTES_AUDIT` | ✅ (auditado) |
| Académico | Eventos Administrativos (crear / registrar) | `/dashboard/academic/eventos-administrativos` · `/api/postgres/admin-events/**` | SA/ADM + AJ, CA (`ACADEMICO.ADMIN_EVENTS.GESTIONAR`) | `ADMIN_EVENTS` | crear/registrar ✅ / eliminar 🔴 |
| Académico | Sesiones sin gestión | `/dashboard/academic/sesiones-sin-gestion` | SA/ADM + AJ, CA, SVJ | — (gestiona vía `/sesion/[id]`) | ✅ |
| Académico | Performance Evaluation (dashboard) | `/dashboard/academic/performance-evaluation` | SA/ADM + AJ, ADMJ, CA, SVJ | — (lee) | ✅ |
| Académico | Jump Evaluaciones (revisar) | `/dashboard/academic/jump-evaluaciones` | SA/ADM † (`ACADEMICO.JUMP_EVAL.REVISAR`) | `JUMP_EVALUATIONS` | ✅ |
| Académico | Actualizar Material (usuario / advisor / interactivo) | `/dashboard/academic/actualizar-material*` · `POST /api/postgres/materials/manage` · `/api/admin/libros-interactivos/*` | SA/ADM + AJ, CA (`ACADEMICO.MATERIAL.ACTUALIZAR`) | `NIVELES`, `LIBROS_INTERACTIVOS`, `MATERIAL_AUDIT`, `APP_CONFIG` | ✅ (auditado; sube archivo a Spaces) |
| Académico | Actualizar Videos (instructivos / sesiones) | `/admin/actualizar-videos` | SA/ADM + AJ, CA | `NIVELES`, `APP_CONFIG` | ✅ |
| Académico | Ir a la Sesión — asistencia / evaluación / comentarios | `/sesion/[id]` · `/api/postgres/academic/{attendance,evaluation}` · `academic-record` | Entra: SA/ADM + AJ, ADV, CA (`ACADEMICO.SESION.IR_A_SESION`); secciones gateadas por `STUDENT.ACADEMIA.*` | `ACADEMICA_BOOKINGS`, `ACADEMICA`, `PEOPLE`, `CALENDARIO`; graduación → `DEL USUARIOS_ROLES` | ✅ / 🔒 si `autoAdvance` gradúa a DONE |

---

## Detalle Estudiante (`/student/[id]` — always-allowed, sub-acciones gateadas)

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Estudiante | Ver estudiante | `/student/[id]` | Cualquier autenticado | — (lee) | ✅ |
| Estudiante | Cambiar step / cambio auditado | `POST /api/postgres/students/[id]/{step,cambio-step-auditado}` | SA/ADM + AJ, ADMJ, CA, SVJ (`STUDENT.ACADEMIA.ASIGNAR_STEP`/`MARCAR_STEP`) | `ACADEMICA`, `PEOPLE` (+ `USUARIOS_ROLES` si → DONE) | ✅ (auditado) / DONE → 🔒 |
| Estudiante | Inicializar nivel | `.../inicializar-nivel` | SA/ADM + AJ, CA (`STUDENT.ACADEMIA.INICIALIZAR_NIVEL`) | `DEL ACADEMICA_BOOKINGS`, `ACADEMICA`, `PEOPLE` | 🔴 (borra bookings del nivel, sin snapshot; una sola vez) |
| Estudiante | Override de step | `.../step-override` | SA/ADM + AJ, CA (`MARCAR_STEP`/`ASIGNAR_STEP`) | `STEP_OVERRIDES` (soft-delete + historial) | ✅ |
| Estudiante | Agendar clase (wizard admin) | `POST /api/postgres/events/[id]/enroll` | SA/ADM + AJ, ADMJ, CA, RJ, RA, SVA, SVJ | `ACADEMICA_BOOKINGS`, `CALENDARIO` | ✅ |
| Estudiante | Extender vigencia | `.../extend` | SA/ADM + RJ, SVJ (`STUDENT.CONTRATO.EXTENDER_VIGENCIA`) | `PEOPLE`, `ACADEMICA`, `USUARIOS_ROLES` | ✅ (reactiva) |
| Estudiante | OnHold activar / desactivar | `POST /api/postgres/students/onhold` | SA/ADM + RJ, SVJ (`STUDENT.CONTRATO.ACTIVAR_HOLD`) | `PEOPLE`, `ACADEMICA`, `USUARIOS_ROLES` | 🔒 (activar bloquea login; reversible) |
| Estudiante | Cambiar estado del contrato (toggle) | `.../toggle-status` | SA/ADM + ADMJ, APG, RJ, SVJ (`PERSON.ADMIN.ACTIVAR_DESACTIVAR`) | `PEOPLE`, `ACADEMICA`, `USUARIOS_ROLES` | 🔒 |
| Estudiante | WhatsApp (mensajes / plantillas) | `/api/postgres/panel-estudiante/*` · whatsapp | SA/ADM + titulares de `STUDENT.GLOBAL.ENVIAR_MENSAJE` | — (lee; envía) | 📤 |
| Estudiante | Clear Historic | `/admin/clear-historic` · `.../clear-historic/student` | SA/ADM † (`MANTENIMIENTO.USUARIOS.CLEAR_HISTORIC`) | `DEL ACADEMICA_BOOKINGS/COMPLEMENTARIA_ATTEMPTS/STEP_OVERRIDES`, `ACADEMICA` | 🔴 (sin snapshot; una sola vez) |

---

## Detalle Persona / Titular (`/person/[id]` — always-allowed, sub-acciones gateadas)

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Persona | Ver persona | `/person/[id]` | Cualquier autenticado | — (lee) | ✅ |
| Persona | Editar persona / cambiar estado | `PATCH /api/postgres/people/[id]` | SA/ADM + AJ, ADMJ, APC, APG, CA, RJ, SVA, SVJ (`PERSON.INFO.MODIFICAR`); estado: + ADMJ, APC, APG, SVJ (`CAMBIAR_ESTADO`) | `PEOPLE`, `ACADEMICA`, `USUARIOS_ROLES` | ✅ / ANULADO → 🔒 (inactiva beneficiarios) |
| Persona | Agregar beneficiario | `POST /api/postgres/people` | SA/ADM + APC, APG (`PERSON.INFO.AGREGAR_BENEFICIARIO`) | `PEOPLE` (+ protección-historial si re-matrícula) | ✅ |
| Persona | Eliminar beneficiario | `DELETE /api/postgres/people/[id]` | SA/ADM + APC, APG (`PERSON.INFO.ELIMINAR`) | `DEL ACADEMICA`, `DEL PEOPLE` | 🔴 (sin snapshot) |
| Persona | Aprobar titular / beneficiario | `POST /api/postgres/people/[id]/approve` | SA/ADM + ADMJ, APC, APG (`PERSON.ADMIN.APROBAR`); contratos `PRB-` solo SA | `PEOPLE`, `INS ACADEMICA` | 📤 (WhatsApp con link `nuevo-usuario`) |
| Persona | Asignar Ejecutivo de Recaudos | `PATCH /api/postgres/people/[id]` (`gestorRecaudo`) 🌍 | SA/ADM + RJ (`PERSON.FINANCIERA.ASIGNAR_GESTOR_RECAUDO`) | `PEOPLE` | ✅ |
| Persona | Cambio estado de cartera | `POST /api/postgres/people/[id]/cambio-cartera` | SA/ADM + RJ (`PERSON.FINANCIERA.CAMBIO_ESTADO_CARTERA`) | `PAGOS_TITULARES` (cuota #0 + historial) | ✅ (auditado) |
| Persona | Registrar pago | `POST /api/postgres/pagos-titulares` | SA/ADM + RJ, RA (`PERSON.FINANCIERA.PAGOS_REGISTRAR`) | `PAGOS_TITULARES`, `FINANCIEROS` (saldo) | ✅ (hasta validar) |
| Persona | Editar / eliminar pago | `PATCH`/`DELETE /api/postgres/pagos-titulares/[id]` | SA/ADM + RJ (editar `PAGOS_EDITAR`; eliminar `PAGOS_ELIMINAR`) | `PAGOS_TITULARES`, `FINANCIEROS` | 📌 (pago validado no editable/borrable) |
| Persona | Validar pago (individual / masivo) | `.../pagos-titulares/[id]/validar` · `.../validar-masivo` | SA/ADM + RJ (`PAGOS_VALIDAR`); masivo `RECAUDOS.APROBACION_MASIVA` | `PAGOS_TITULARES`, `FINANCIEROS` | 📌 (tras validar queda bloqueado) |
| Persona | Imprimir recibo de pago | `.../pagos-titulares/[id]/recibo` | SA/ADM + RJ, RA (`PAGOS_RECIBO`) | `PAGOS_TITULARES` (`numeroRecibo` secuencial) | 📤 (PDF) |
| Persona | Adjuntar / eliminar doc de pago | `.../pagos-titulares/[id]/documentos` | SA/ADM + RJ, RA (`PAGOS_REGISTRAR`) | `PAGOS_TITULARES` (`documentosAdjuntos`) + Spaces | 🔴 (borra archivo de Spaces) |
| Persona | Ver / descargar contrato | `GET /api/contracts/[id]/download-pdf` | SA/ADM + titulares de `PERSON.INFO.VER_CONTRATO`/`DESCARGAR_CONTRATO` | — (lee de Drive/bsl) | ✅ |

---

## Comercial

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Comercial | Crear Contrato | `/dashboard/comercial/crear-contrato` · `POST /api/postgres/contracts` | SA/ADM + ADMJ, APC, COM, CO | `PEOPLE`, `FINANCIEROS`, `PAGOS_TITULARES` (cuota #0), `EQUIPO_COMERCIAL` | 🔢 (consume número secuencial; crea registros) |
| Comercial | Contrato detalle admin (editar / vista previa) | `/dashboard/comercial/contrato/[id]` | SA/ADM + ADMJ, APC, COM, CO (genérico `/dashboard/comercial`) | `PEOPLE` (edición por sección) | ✅ |
| Comercial | Enviar PDF de contrato por WhatsApp | `POST /api/contracts/[id]/send-pdf` | SA/ADM + APC, COM (`COMERCIAL.CONTRATO.ENVIAR_PDF`) | — (genera PDF → Drive/Spaces → WhatsApp) | 📤 |
| Comercial | Auto-aprobar consentimiento | `POST /api/consent/[id]/auto-approve` | SA/ADM + ADMJ, APC (`APROBACION_AUTONOMA`) | `PEOPLE` (consentimiento + hash), `auditautoaprov` | ⚖️📤 |
| Comercial | Prospectos | `/dashboard/comercial/prospectos` | SA/ADM + ADMJ (`COMERCIAL.PROSPECTOS.VER`) | — (lee) | ✅ |
| Comercial | Matrículas (consulta + detalle) | `/dashboard/comercial/matriculas[/[id]]` | SA/ADM † (`COMERCIAL.MATRICULAS.VER`) | — (lee) | ✅ |
| Comercial | Borrar matrícula (sin firmar) | `POST /api/postgres/matriculas/delete` | SA/ADM † (`COMERCIAL.MATRICULAS.BORRAR`) | `INS PURGE_LOG` + `DEL` en 8 tablas | 🟠 (snapshot en PURGE_LOG) |

---

## Consentimiento declarativo (público)

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Consentimiento | Página pública del contrato | `/contrato/[id]` | Público | — (lee) | ✅ |
| Consentimiento | Enviar OTP | `POST /api/consent/[id]/send-otp` | Público (verifica documento) | — (OTP en memoria) | 📤 |
| Consentimiento | Verificar OTP + firmar | `POST /api/consent/[id]/verify` | Público | `PEOPLE` (`consentimientoDeclarativo`, `hashConsentimiento`, `inicioContrato`) | ⚖️📤 (hash legal + PDF a Drive) |

---

## Aprobación

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Aprobación | Centro de Aprobaciones (aprobar / rechazar) | `/dashboard/aprobacion` · `PUT /api/postgres/approvals/[id]` | SA/ADM + AJ, ADMJ, APC, APG, SVJ | `PEOPLE` (aprobación/estado/`fechaIngreso`) | 📤 (WhatsApp al aprobar) · 🔒 (rechazo/anulación inactiva) |
| Aprobación | Contratos aprobados (consulta) | `/dashboard/aprobacion/contratos-aprobados` | SA/ADM + ADMJ, APC, APG | — (lee) | ✅ |
| Aprobación | Conversión Titular (duplicar titular → beneficiario) | `/dashboard/aprobacion/conversion-titular` | SA/ADM † (`APROBACION.CONVERSION_TITULAR.VER`) | `INS PEOPLE` (duplica) | ✅ |

---

## Recaudos — 🌍 scope por país

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Recaudos 🌍 | Centro de Validación de Pagos (Gestión) | `/dashboard/recaudos/gestion` | SA/ADM + APG, RJ (`RECAUDOS.GESTION.VER`) · 🌍 | `PAGOS_TITULARES`, `FINANCIEROS` (al validar) | 📌 |
| Recaudos 🌍 | Bancos (por medio de pago) | `/dashboard/recaudos/bancos` | SA/ADM + RJ (`RECAUDOS.BANCOS.VER`) · 🌍 | `PAGOS_TITULARES`, `FINANCIEROS` | 📌 |
| Recaudos 🌍 | Usuarios asignados | `/dashboard/recaudos/asignacion` | SA/ADM + AJ, APG, RJ, RA (`RECAUDOS.ASIGNACION.VER`) · 🌍 | — (lee) | ✅ |
| Recaudos 🌍 | Aprobaciones (asignación masiva de gestor) | `/dashboard/recaudos/aprobaciones` · `.../asignar-masivo` | SA/ADM + RJ (`RECAUDOS.APROBACIONES.VER`; asignar `.ASIGNAR`) · 🌍 | `PEOPLE` (`gestorRecaudo` masivo) | ✅ |

---

## Panel Estudiante (rol `ESTUDIANTE`; `/panel-estudiante` always-allowed)

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Panel Est. | Panel de auto-servicio | `/panel-estudiante` | ESTUDIANTE (dueño de la sesión) | — (lee) | ✅ |
| Panel Est. | Reservar clase | `POST /api/postgres/panel-estudiante/book` | ESTUDIANTE | `ACADEMICA_BOOKINGS`, `CALENDARIO` | ✅ |
| Panel Est. | Cancelar clase | `.../cancel` | ESTUDIANTE | `ACADEMICA_BOOKINGS`, `CALENDARIO` | ✅ (deadline 60 min) |
| Panel Est. | Valoración de sesión (encuesta al advisor) | `.../evaluar` | ESTUDIANTE | `ACADEMICA_BOOKING_EVALUATIONS` (INS-only) | 📌 (no editable tras enviar) |
| Panel Est. | Actividad complementaria (quiz IA) | `.../complementaria/{generate,grade}` | ESTUDIANTE | `COMPLEMENTARIA_ATTEMPTS` (+ al aprobar: `ACADEMICA_BOOKINGS`, autoAdvance) | ✅ |
| Panel Est. | Ejercicios interactivos (práctica IA) | `.../ejercicios-interactivos/grade` | ESTUDIANTE | `EJERCICIOS_INTENTOS` | ✅ (1 intento por step) |
| Panel Est. | Actualizar perfil | `.../update-profile` | ESTUDIANTE | `USUARIOS_ROLES`, `PEOPLE`, `ACADEMICA` | ✅ |
| Panel Est. | Material interactivo (visor) | `/panel-estudiante/material-interactivo/[nivel]` | ESTUDIANTE | — (lee) | ✅ |

---

## Panel / alta de Advisor

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Advisor | Panel Advisor | `/panel-advisor` | SA/ADM + AJ, ADMJ, ADV, CA (`ACADEMICO.ADVISOR.VER_ENLACE`) | — (lee) | ✅ |
| Advisor | Actualización de datos (setup) | `/advisor-setup` · `/api/postgres/advisors/update-profile` | ADVISOR (always-allowed) | `ADVISORS`, `USUARIOS_ROLES` | ✅ |
| Advisor | Nuevo Advisor (alta pública) | `/nuevo-advisor` · `POST /api/postgres/advisors/create` | Público | `ADVISORS`, `USUARIOS_ROLES` | ✅ |
| Advisor | Editar advisor (desde Lgs-Buckets) | `PATCH /api/postgres/advisors/[id]` | SA/ADM + `MANTENIMIENTO.LGS_BUCKETS.EDITAR` † | `ADVISORS`, `USUARIOS_ROLES` | ✅ |

---

## Auto-registro de estudiante (público)

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Registro | Nuevo Usuario (completar registro) | `/nuevo-usuario/[id]` · `POST` | Público (link enviado al aprobar) | `ACADEMICA`, `PEOPLE`, `INS USUARIOS_ROLES`, `ACADEMICA_BOOKINGS` (auto-welcome), `CALENDARIO` | ✅ (crea login; clave posible en texto plano) |
| Registro | Reagendar Welcome | `/reagendar-welcome/[id]` · `POST` | Público | `ACADEMICA`, `ACADEMICA_BOOKINGS`, `CALENDARIO` | ✅ |

---

## Informes (solo lectura; escritura = ninguna salvo indicado)

> Todos gateados por `ROUTE_PERMISSIONS` exacto (permiso nieto). `SA/ADM (bypass)` implícito en cada fila.

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Informes · Asistencia | Sesiones & Jumps | `/dashboard/informes/asistencia/sesiones-clubes` | SA/ADM † (`INFORMES.ASISTENCIA.SESIONES`) | — (lee) | ✅ |
| Informes · Asistencia | Clubes (Training + Clubs) | `.../asistencia/clubes` | SA/ADM † | — (lee) | ✅ |
| Informes · Asistencia | Complementarias | `.../asistencia/complementarias` | SA/ADM † | — (lee) | ✅ |
| Informes · Asistencia | Welcome Session | `.../asistencia/welcome-session` | SA/ADM † | — (lee) | ✅ |
| Informes · Asistencia | X País | `.../asistencia/x-pais` | SA/ADM + ADMJ (`INFORMES.ASISTENCIA.XPAIS`) | — (lee) | ✅ |
| Informes · Programación | Sesiones-Jumps | `.../sesiones/calendario-sesiones-jumps` | SA/ADM + ADMJ | — (lee) | ✅ |
| Informes · Programación | Training-Clubs | `.../sesiones/calendario-training-clubs` | SA/ADM + ADMJ | — (lee) | ✅ |
| Informes · Programación | Welcome | `.../sesiones/calendario-welcome` | SA/ADM + ADMJ | — (lee) | ✅ |
| Informes · Advisors | Sesiones / Jumps / Training / Clubes / Welcome / Essential | `.../advisors/{sesiones,jumps,training,clubes,welcome,essential}` | SA/ADM † (cada uno su `INFORMES.ADVISORS.*`) | — (lee) | ✅ |
| Informes · Advisors | Resumen | `.../advisors/resumen` | SA/ADM + ADMJ (`INFORMES.ADVISORS.RESUMEN`) | — (lee) | ✅ |
| Informes · Académica | Horas Advisor | `.../academica/horas-advisor` | SA/ADM + AJ, ADMJ, CA | — (lee) | ✅ |
| Informes · Académica | Hold & Vigencias | `.../academica/hold-vigencias` | SA/ADM + AJ, SVJ | — (lee) | ✅ |
| Informes · Académica | X Niveles | `.../academica/x-niveles` | SA/ADM + AJ | — (lee) | ✅ |
| Informes · Académica | Conciliación Steps | `.../academica/conciliacion-steps` | SA/ADM † | — (lee) | ✅ |
| Informes · Académica | Por Vencer | `.../academica/por-vencer` | SA/ADM † | — (lee) | ✅ |
| Informes · Académica | Usuarios | `.../usuarios` | SA/ADM + AJ, ADMJ, CA, RJ, SVJ (`INFORMES.USUARIOS`) | — (lee) | ✅ |
| Informes · Académica | InfoAcademic User | `.../infoacademic-user` | SA/ADM + AJ, CA, RJ, SVJ | — (lee) | ✅ |
| Informes · Contratos | Contratos | `.../contratos` | SA/ADM + ADMJ | — (lee) | ✅ |
| Informes · Contratos | Matrículas | `.../contratos/matriculas` | SA/ADM + AJ (`INFORMES.CONTRATOS.MATRICULAS`) | — (lee) | ✅ |
| Informes · Planta | Advisors / Administrativos | `.../planta/{advisors,administrativos}` | SA/ADM + ADMJ | — (lee) | ✅ |
| Informes · Estadísticas | Niveles / Horarios | `.../estadisticas[/horarios]` | SA/ADM + ADMJ | — (lee) | ✅ |

---

## Admin / Mantenimiento

> `/admin/*` sin entrada en `ROUTE_PERMISSIONS` es **permitido por el middleware por defecto**; el candado real está en `<PermissionGuard>` (página) + `requirePermission` (endpoint). `†` = solo SA/ADM en el snapshot.

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Mantenimiento | Matriz de Permisos | `/admin/permissions` · `PUT /api/postgres/roles/[rol]/permissions` | SA/ADM only (superAdminOnly) | `ROL_PERMISOS` | ✅ |
| Mantenimiento | Crea UserRol / Crear rol | `/admin/roles/create` · `POST /api/postgres/roles` · `users/create-{administrativo,comercial,from-academica}` | SA/ADM † (`MANTENIMIENTO.USUARIOS.CREAR_ROL`) | `ROL_PERMISOS`, `USUARIOS_ROLES`, `EQUIPO_COMERCIAL` | ✅ (clave en texto plano) |
| Mantenimiento | Migrar Contrato | `/admin/migrar-contrato` | SA/ADM + APC (`MANTENIMIENTO.CONTRATOS.MIGRAR`) | `PEOPLE`, `FINANCIEROS`, `PAGOS_TITULARES` | 🔢 |
| Mantenimiento | Bloqueo Contrato | `/admin/bloqueo-contrato` · `.../bloqueo-contrato/execute` | SA/ADM † (`MANTENIMIENTO.CONTRATOS.BLOQUEAR`) | `PEOPLE`, `ACADEMICA`, `USUARIOS_ROLES` | 🔒 |
| Mantenimiento | Contratos Prueba (purga) | `/admin/contratos-prueba` · `.../contratos-prueba/purge` | SA/ADM † (`MANTENIMIENTO.USUARIOS.CONTRATOS_PRUEBA`) | `INS PURGE_LOG` + `DEL` en 8 tablas | 🟠 |
| Mantenimiento | Edición / Generar Contrato (regenerar PDF Drive) | `/admin/{edicion-contrato,generar-contrato}` · `.../regenerate-drive` | SA/ADM † (`EDICION_CONTRATO` / `GENERAR_CONTRATO`) | — (regenera PDF → Drive) | 📤 |
| Mantenimiento | Drive de Contratos (interruptor) | `/admin/drive-config` · `PATCH /api/admin/drive-mode` | SA/ADM † (`MANTENIMIENTO.CONTRATOS.DRIVE_CONFIG`) | `APP_CONFIG` | ✅ |
| Mantenimiento | Clear Historic | `/admin/clear-historic` | SA/ADM † | `DEL ACADEMICA_BOOKINGS/COMPLEMENTARIA_ATTEMPTS/STEP_OVERRIDES`, `ACADEMICA` | 🔴 |
| Mantenimiento | Envío de Mensajes (WhatsApp masivo) | `/admin/envio-mensajes` · `.../envio-mensajes/send` · `.../update-celular` | SA/ADM † (`MANTENIMIENTO.USUARIOS.ENVIO_MENSAJES`) | `PEOPLE`, `ACADEMICA`, `USUARIOS_ROLES` (update-celular) | 📤 |
| Mantenimiento | Plantillas de mensajes | `/admin/plantillas/gestion` | SA/ADM † (`MANTENIMIENTO.PLANTILLAS.GESTION`) | `MESSAGE_TEMPLATES` (delete = soft) | ✅ |
| Mantenimiento | Ticker / Banner de login | `/admin/{ticker,banner}` | SA/ADM + AJ (`MANTENIMIENTO.AVISOS.{TICKER,BANNER}`) | `APP_CONFIG` | ✅ |
| Mantenimiento | Filiales (catálogo) | `/admin/filiales` · `POST`/`DELETE` | SA/ADM † (`MANTENIMIENTO.USUARIOS.CREAR_ROL`) | `INS/DEL FILIALES` | 🔴 (DELETE físico; snapshot en `EQUIPO_COMERCIAL.filial`) |
| Mantenimiento | Lgs-Buckets (fotos DO Spaces) | `/admin/lgs-buckets` · `.../replace` | SA/ADM † (ver `LGS_BUCKETS.VER`; editar `.EDITAR`) | `ADVISORS`/`ACADEMICA` (foto) + Spaces | ✅ (reemplaza; borra objeto viejo) |
| Mantenimiento | Consulta de Scripts | `/admin/scripts/consulta` | SA/ADM † (`MANTENIMIENTO.SCRIPTS.CONSULTA`) | — (lee FS) | ✅ |
| Mantenimiento | Usuarios Pegados (reconciliar) | `/admin/scripts/usuarios-pegados` | SA/ADM † (`MANTENIMIENTO.SCRIPTS.USUARIOS_PEGADOS`) | `ACADEMICA`, `PEOPLE` (vía changeStep) | ✅ (auditado) |
| Mantenimiento | Diagnóstico | `/admin/diagnostico` | SA/ADM † (`MANTENIMIENTO.DIAGNOSTICO.VER`) | — (lee) | ✅ |
| Mantenimiento | DB Viewer (edición directa) | `/dblgs` | SA/ADM only | Cualquier tabla (edición/borrado directo) | 🔴 (escritura directa sin auditoría) |
| Mantenimiento | Subir Lote (importación PEOPLE) | `/subir-lote` | SA/ADM only | `PEOPLE` (UPSERT masivo) | ✅ |
| Mantenimiento | Libros interactivos (config) | `/admin/libros-interactivos/*` (binding, audios, step-páginas, feature-flag) | SA/ADM + AJ, CA (`ACADEMICO.MATERIAL.ACTUALIZAR`) | `NIVELES`, `LIBROS_INTERACTIVOS`, `APP_CONFIG` | ✅ |
| Mantenimiento | Sync-field (copia/normalización masiva) | `POST /api/admin/sync-field` | SA/ADM only | Tabla dinámica (`UPDATE` masivo) | 🔴 (escritura masiva sin snapshot) |

---

## Crons (autenticados con `CRON_SECRET`; daemon `scripts/cron-worker.js`)

| Módulo | Proceso | Ruta/pantalla | Roles con permiso | Modelos Prisma que escribe | ¿Irreversible? |
|---|---|---|---|---|---|
| Cron | Expirar contratos | `/api/cron/expire-contracts` (04:00 UTC) | `CRON_SECRET` | `PEOPLE`, `ACADEMICA`, `USUARIOS_ROLES`, `CRON_RUNS` | 🔒 (bloquea login de vencidos) |
| Cron | Reactivar OnHold | `/api/cron/reactivate-onhold` (03:00 UTC) | `CRON_SECRET` | `PEOPLE`, `ACADEMICA`, `USUARIOS_ROLES`, `CRON_RUNS` | ✅ (extiende contrato) |
| Cron | Reconciliar usuarios pegados | `/api/cron/reconcile-pegados` (02:00 UTC) | `CRON_SECRET` | `ACADEMICA`, `PEOPLE`, `CRON_RUNS` | ✅ (auditado) |

---

## Anexo A — Modelos Prisma → tabla

Fuente: [`prisma/schema.prisma`](../../prisma/schema.prisma) (28 modelos). Todos usan `@map("_id")` para el PK; el **nombre del modelo = nombre de la tabla** (no hay `@@map` salvo `schema_version`).

```
ACADEMICA · ACADEMICA_BOOKINGS · ACADEMICA_BOOKING_EVALUATIONS · ADMIN_EVENTS
ADVISORS · ADVISOR_EVENT_LOG · ADVISOR_NOTES_AUDIT · APP_CONFIG · CALENDARIO
COMPLEMENTARIA_ATTEMPTS · CRON_RUNS · ContractTemplates · EJERCICIOS_INTENTOS
EJERCICIOS_INTERACTIVOS · EQUIPO_COMERCIAL · FILIALES · FINANCIEROS · JUMP_EVALUATIONS
LIBROS_INTERACTIVOS (PK = codigo) · MATERIAL_AUDIT · MESSAGE_TEMPLATES · NIVELES
PAGOS_TITULARES · PEOPLE · PURGE_LOG · ROL_PERMISOS · STEP_OVERRIDES · USUARIOS_ROLES
auditautoaprov · schema_version → "_schema_version" (@@map)
```

**Tabla usada por la app pero NO versionada en `schema.prisma`:**
- `EXAM_INTERN_AUDIT` — se crea en runtime con `CREATE TABLE IF NOT EXISTS` en [`src/services/exam-intern.service.ts`](../../src/services/exam-intern.service.ts). Escrita por el proceso **Exam. Intern. → Aplicar Confirmación** (`.../servicio/exam-intern/aplicar-confirmacion`), que además hace `UPDATE PEOPLE/ACADEMICA/USUARIOS_ROLES` (extiende o bloquea) + 📤 WhatsApp — gateado por `SERVICIO.EXAM_INTERN.{IELTS,B2F,TOEFL}_APLICAR_CONFIRMACION` (solo SA/ADM en el snapshot).

> Nota: la app accede a PostgreSQL con **SQL parametrizado** vía `pg` (repositorios/servicios), no con el cliente Prisma. `schema.prisma` documenta el esquema; los nombres de la columna "Modelos Prisma que escribe" son esos modelos/tablas.

---

## Anexo B — Notas de riesgo

- **Contraseñas en texto plano**: `reset-password`, `users/create-*` y `nuevo-usuario` pueden escribir la clave sin hashear (`USUARIOS_ROLES.password` / `ACADEMICA.clave`) — compatibilidad legacy; el login acepta bcrypt y texto plano.
- **Efectos externos no reversibles** (📤): todo envío por WhatsApp (Whapi) y todo PDF (API2PDF + subida a Google Drive/DO Spaces) ya ocurrió al completarse el request; no hay "deshacer".
- **DELETE sin snapshot** (🔴): `clear-historic`, `inicializar-nivel`, eliminar beneficiario, eliminar evento, `sync-field`, `/dblgs` y borrado de doc de pago **no** guardan copia. Solo `contratos-prueba/purge` y `matriculas/delete` snapshotean en `PURGE_LOG` (🟠).
- **`EXAM_INTERN_AUDIT` fuera de `schema.prisma`**: si se regenera el cliente/esquema desde el schema, esta tabla no queda declarada (existe solo por el `CREATE TABLE IF NOT EXISTS` en runtime).
- **Permisos sin rol asignado (†)**: varios permisos existen en el catálogo pero **ningún rol** los tiene en el snapshot actual → solo accesibles por bypass `SUPER_ADMIN`/`ADMIN` (p. ej. `COMERCIAL.MATRICULAS.*`, `APROBACION.CONVERSION_TITULAR.VER`, `ACADEMICO.JUMP_EVAL.REVISAR`, y la mayoría de `MANTENIMIENTO.*`). Asignables en `/admin/permissions`.
```
