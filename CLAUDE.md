# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LGS Admin Panel is a Next.js 14 administrative dashboard for "Let's Go Speak" language learning platform. The panel provides management interfaces for students, classes, events, contracts, and financial data. Includes a student self-service portal, a public contract/consent page, WhatsApp integration (Whapi.cloud), PDF generation (API2PDF), and a digital signature system via OTP. Uses PostgreSQL (Digital Ocean) as **única fuente de datos** with a layered architecture (Repository → Service → API Route → Hook). **La plataforma opera 100% sobre PostgreSQL — Wix ya no se usa como fuente de datos.**

## Lista Completa de Funcionalidades

### Autenticación y Acceso
1. Login con email/contraseña (credenciales desde PostgreSQL USUARIOS_ROLES)
2. Control de acceso basado en roles (RBAC) con 9 roles (SUPER_ADMIN, ADMIN, ADVISOR, COMERCIAL, APROBADOR, TALERO, FINANCIERO, SERVICIO, READONLY)
3. Carga dinámica de permisos desde PostgreSQL con caché de 5 minutos
4. Control de acceso por ruta (middleware con verificación de permisos)
5. Gestión de sesiones con JWT (NextAuth.js)
6. Soporte de contraseñas bcrypt y texto plano (compatibilidad legacy)
7. Credenciales admin de respaldo vía variables de entorno (ADMIN_EMAIL, ADMIN_PASSWORD)
8. Logout con limpieza completa de cookies de sesión

### Dashboard (Inicio)
9. Tarjetas de estadísticas (Total Usuarios, Inactivos, Sesiones Hoy, Inscritos Hoy, Advisors Hoy)
10. Gráficas interactivas generadas por IA (Claude API) con UI de suggestion chips: el usuario elige qué visualización generar (sesiones agendadas vs atendidas/canceladas, bookings por tipo, estudiantes por nivel, tasa de asistencia, carga de advisors). Cada gráfica se genera individualmente on-demand en iframe con tooltips, hover effects y animaciones
11. Auto-refresh de estadísticas (5 min stale, 10 min refresh)
12. Caché server-side individual por tipo de gráfica (30 min TTL) con regeneración manual

### Módulo Académico
12. Agenda de Sesiones - Vista de calendario mensual con navegación mes anterior/siguiente
13. Creación de eventos (SESSION, CLUB) con campos: día, hora, advisor, nivel, step, tipo, título, linkZoom, límite usuarios, club, observaciones. Eventos de bienvenida se crean como SESSION/CLUB con `tituloONivel=WELCOME` (WELCOME es un nivel, no un tipo)
14. Edición de eventos existentes
15. Eliminación de eventos con opción de eliminar bookings asociados
16. Filtrado de eventos por advisor, tipo, nivel, step, rango de fechas
17. Gestión de inscripciones por evento (enrollar/desenrollar estudiantes)
18. Inscripción masiva de estudiantes en un evento (bulk enroll)
19. Seguimiento de asistencia individual y masiva (bulk attendance)
20. Vista de agenda diaria
21. Exportación Excel (CSV con UTF-8 BOM) de eventos con filtros
22. Agenda Académica - Vista semanal de clases
23. Lista de Advisors con estadísticas de rendimiento
24. Creación de nuevos advisors (página pública `/nuevo-advisor` con wizard 3 pasos + creación automática de cuenta USUARIOS_ROLES)
25. Detalle de advisor (calendario, estadísticas, eventos asignados)
26. Panel Advisor personal (calendario y métricas propias filtradas por email)
27. Informe de Beneficiarios (reportes por rango de fechas con conteo de sesiones)
28. Exportación PDF/CSV de informes de beneficiarios
29. Leyenda de colores por tipo de evento (SESSION=azul, CLUB=verde). Eventos de tipo WELCOME legacy se muestran en morado por compatibilidad
30. Badges de capacidad en calendario (inscritos/límite, asistieron)
31. Conteo batch de inscripciones para múltiples eventos en una sola query

### Módulo Servicio
32. Welcome Session - Carga y gestión de eventos de bienvenida (modo bookings o eventos)
33. Seguimiento de asistencia de welcome sessions
34. Lista de Sesiones de clase con filtros
35. Filtrado por fecha, estado de asistencia, apellido
36. Usuarios sin Registro - Vista de beneficiarios sin perfil académico (LEFT JOIN PEOPLE/ACADEMICA)
37. Creación de perfiles académicos para beneficiarios sin registro
38. Integración con WhatsApp para mensajes (Whapi.cloud API)
39. Envío de WhatsApp de bienvenida a nuevos beneficiarios
40. Exportación Excel (CSV con UTF-8 BOM) de datos de servicio (welcome-session, lista-sesiones, sin-registro)
40b. **Cancelación sin reemplazo** - Al cancelar un evento marcando "Sesión con booking" (add-on de Suspensión, excluye Restructuración) se cancela la clase de los inscritos **devolviendo el cupo semanal** (`cancelo=true`) y se listan aquí para gestión: pestañas Actual (agrupado por sesión, Gestión + Gestionada por editables) e Histórico; botón global "Gestionada" habilitado solo cuando ninguna fila queda "Sin gestión" — al gestionar, pasa los registros a histórico Y **borra de `ACADEMICA_BOOKINGS` la clase cancelada de cada alumno** (transaccional; NO afecta el cupo semanal; la auditoría queda en el histórico + `ADVISOR_EVENT_LOG`). Alimenta el ítem "No Asistió" del informe de Horas y de Control de Horas (permiso `SERVICIO.CANCELACION_SIN_REEMPLAZO.VER`)

### Módulo Comercial
41. Crear Contrato - Formulario wizard multi-paso (titular + beneficiarios + financiero)
42. Selección de país con prefijos telefónicos
43. Generación de PDF de contrato vía API2PDF (renderiza página pública del contrato)
44. Vista previa de contrato con template llenado dinámicamente
45. Envío de PDF de contrato por WhatsApp (genera PDF + envía vía Whapi)
46. Opción de auto-aprobación de consentimiento declarativo (sin OTP)
47. Gestión de Prospectos (pipeline comercial)
48. Detalle de contrato admin - Vista editable de titular, beneficiarios, financiero y referencias
49. Edición inline de campos del contrato con guardado por sección
50. Búsqueda de contratos por número (exact match o patrón)
51. Numeración automática secuencial de contratos (next-number)
52. Smart polling - Auto-actualización del contrato admin cuando el cliente firma consentimiento (timeout 10 min)
52b. Auto-guardado de borrador en Crear Contrato — guarda estado del formulario en localStorage con TTL de 72h; al volver muestra banner para continuar o descartar

### Consentimiento Declarativo (Firma Digital)
53. Página pública de contrato para el cliente (`/contrato/[id]`)
54. Verificación de identidad por número de documento
55. Envío de OTP de 6 dígitos por WhatsApp (TTL 10 minutos)
56. Verificación OTP con hash SHA-256 del consentimiento
57. Re-envío de OTP con cooldown
58. Checkbox de declaración jurada antes de verificar
59. Auto-aprobación por admin (sin verificación OTP del cliente)
60. Estado de consentimiento visible en detalle de contrato admin (tipo aprobación, documento, fecha, hash)

### Módulo Aprobación
61. Vista de contratos pendientes de aprobación
62. Aprobación/rechazo de contratos con comentarios
63. Filtrado por estado (Pendiente, Aprobado, Rechazado) y tipo
64. Descarga y envío de PDF de contratos
65. Paginación y búsqueda de aprobaciones

### Gestión de Permisos (Admin)
66. Interfaz de matriz de permisos (solo SUPER_ADMIN/ADMIN, abre en nueva pestaña)
67. Vista agrupada por módulo con colores distintos por módulo
68. Asignación masiva de permisos ("Select All" por módulo)
69. Creación de roles con nombre, descripción, permisos y estado activo
70. Edición de permisos por rol (PUT con array de permisos)
71. Invalidación manual de caché de permisos (endpoint admin)
72. Indicador de fuente de permisos ('postgres' o 'fallback')
73. Botón "Volver al Dashboard" para retornar al inicio

### Detalle de Estudiante
74. Tabs: General | Académica (con submenú) | Contrato | WhatsApp | Comentarios
75. Información general (datos personales, contacto, plataforma, info del sistema)
76. Envío de mensaje WhatsApp de bienvenida desde pestaña General
77. Tabla de asistencia académica con filtros (fecha desde/hasta, estado asistencia, advisor)
78. Columnas de tabla: Fecha, Tipo, Advisor (link clickeable), Nivel, Step, Zoom, Asistió, Participó, Canceló, No Aprobó
79. Header sticky en tabla de asistencia para scroll
80. Diagnóstico "¿Cómo voy?" (progreso del estudiante con barra de progreso y porcentaje)
81. Resumen de progreso: Total Clases, Asistencias, Ausencias, % Asistencia
82. Tabla de progreso por step: sesiones exitosas/2, clubs/1, estado, diagnóstico
83. Clases por tipo (grid de cards con totales y asistencias por tipo)
84. Agendar nueva clase - Wizard 3 pasos: tipo → día (próximos 5 días) → hora (con capacidad visible)
85. Indicadores de capacidad en eventos: inscritos/límite, "LLENO", "Ya inscrito"
86. Gestión de Steps (toggles con auto-save y loading state)
87. Overrides manuales de steps (prioridad absoluta sobre lógica automática)
88. Cambiar Step del estudiante (modal con selector y auto-detección de nivel)
89. Detección automática de nivel paralelo (ESS) al cambiar step
90. Modal de detalles de clase con secciones protegidas por permisos:
    - Evaluación: asistencia toggle, participación toggle, calificación 0-10 (permiso `EVALUACION`)
    - Anotaciones del Advisor (permiso `ANOTACION_ADVISOR`)
    - Comentarios para el Estudiante (permiso `COMENTARIOS_ESTUDIANTE`, solo editable por COORDINADOR_ACADEMICO/SUPER_ADMIN)
    - Eliminar Evento (permiso `ELIMINAR_EVENTO`)
91. Información del contrato (fechas, estado, vigencia con color: rojo <30d, naranja <90d, verde)
92. Historial de extensiones (manuales y automáticas) en modal con tarjetas por extensión
93. Extensión manual del contrato (por días o fecha específica, con motivo)
94. Sistema OnHold - Activar pausa del contrato (date pickers inicio/fin, cálculo automático de duración)
95. Sistema OnHold - Desactivar pausa (extensión automática de finalContrato por días pausados)
96. Historial de OnHold en modal (períodos, duración, fechas, activador, motivo)
97. Envío de mensajes por WhatsApp con plantillas predefinidas (Recordatorio, Progreso, Material, Felicitaciones)
98. Mensaje personalizado por WhatsApp con opción de guardar como template
99. Historial de mensajes WhatsApp con estado de entrega
100. Sección de comentarios del estudiante
101. Información del titular del contrato con tarjetas agrupadas por color

### Detalle de Persona (Titular)
102. Tabs: Información General | Contacto y Referencias | Financiera | Administración | Comentarios
103. Información general del titular (nombres, ID, fecha nacimiento, tipo usuario, estado)
104. Contacto y referencias (teléfonos, emails, dirección, emergencia, referencias personales/comerciales)
105. Información financiera (número de contrato, estado de pago, resumen financiero)
106. Administración de beneficiarios:
     - Lista de beneficiarios con nombre (link clickeable → `/student/[id]`), ID, estado (badge)
     - Botón Aprobar con seguimiento de estado (Aprobando → Enviando WhatsApp → Completado)
     - Botón Editar (protegido por permisos)
     - Botón Eliminar con confirmación modal (solo tipo BENEFICIARIO)
107. Agregar beneficiario - Formulario multi-paso: datos básicos → contacto (con selector de país) → dirección
108. Control de estado de titular (dropdown: Aprobado, Contrato nulo, Devuelto, Pendiente, Rechazado) con confirmación. Estados Contrato nulo/Devuelto/Rechazado inactivan automáticamente al titular y todos sus beneficiarios
109. Comentarios internos con tipo, prioridad, autor y fecha

### Detalle de Advisor
110. Información del advisor (nombre, email, Zoom)
111. Calendario de eventos asignados con filtros de fecha
112. Estadísticas de rendimiento (clases impartidas, estudiantes únicos, tasa de asistencia)

### Detalle de Sesión
113. Tabs: Información General | Estudiantes | Material
114. Información general de la sesión (fecha, hora, advisor, Zoom, tipo, título, descripción)
115. Roster de estudiantes con marcado de asistencia (toggle individual)
116. Marcado masivo de asistencia (bulk update)
117. Calificación y participación por estudiante
118. Material y recursos de enseñanza por nivel/step

### Búsqueda Global
119. Búsqueda por nombre, apellido, número de ID, contrato
120. Búsqueda con debounce configurable (400ms default, mínimo 3 caracteres)
121. Resultados multi-tipo (PEOPLE y ACADEMICA) con deduplicación
122. Navegación por teclado en resultados (↑↓ Enter Escape)
123. Badges de tipo de resultado con colores (TITULAR, BENEFICIARIO, Registro Académico)

### ESS (English Speaking Sessions)
124. Nivel paralelo que no bloquea avance en niveles principales
125. Tracking de asistencia ESS independiente
126. Asignación simultánea de nivel principal + nivel paralelo (nivelParalelo/stepParalelo)
127. ESS excluido del diagnóstico "¿Cómo voy?" (pero incluido en estadísticas globales)

### Exportación de Datos
128. Exportación Excel (CSV UTF-8 BOM) de eventos con filtros (fecha, advisor, nivel, tipo) — agenda-sesiones, agenda-académica
129. Exportación Excel (CSV UTF-8 BOM) de datos de servicio (welcome-session, lista-sesiones, sin-registro)
130. Exportación Excel (CSV UTF-8 BOM) de aprobaciones
131. Exportación CSV de estudiantes
132. Exportación PDF de contratos (vía API2PDF)
133. Exportación PDF/CSV de informes de beneficiarios
- **Utilidad compartida**: `src/lib/export-excel.ts` → `exportToExcel(data, columns, filename)` (client-side, genera CSV con BOM para compatibilidad con Excel y caracteres en español)

### Jobs Automáticos (Cron)
134. Expiración automática de contratos (diario 04:00 UTC = 11:00 PM Colombia, marca como FINALIZADA + estadoInactivo)
135. Reactivación automática de OnHold (diario 03:00 UTC = 10:00 PM Colombia, extiende contrato por días pausados)
136. Autenticación de cron jobs con CRON_SECRET

### Panel del Estudiante (Auto-Servicio)
137. Portal de auto-servicio para estudiantes logueados (rol ESTUDIANTE). Header muestra: saludo con nombre + badge nivel/step + botón logout. El botón de ayuda WhatsApp fue eliminado del header.
138. Ver perfil propio (merge PEOPLE + ACADEMICA)
139. Ver progreso académico ("¿Cómo voy?" con barra de progreso, steps, porcentaje)
140. Ver eventos próximos y disponibles (filtrados por nivel/step del estudiante)
141. Auto-reserva de clases - Wizard 4 pasos: fecha (hoy/mañana) → tipo → evento → confirmación
142. Validaciones de reserva: capacidad, no duplicado, no pending SESSION, límites semanales (2 sesiones/3 clubs), no misma hora, mínimo 30 min antes
143. Cancelación de clases con deadline de 60 minutos antes del evento
144. Estadísticas personales de asistencia (total, asistidas, ausentes, porcentaje)
145. Historial completo de clases con detalles
146. Material de estudio por nivel/step actual
146b. Botón "Material Interactivo" — enlace a lgsplataforma.com/material-{nivel} para niveles BN1-BN3, P1-P3, F3 (solo visible si el nivel tiene URL asignada)
146c. **Regla de material por pantalla**: Todas las vistas de material de usuario usan `tipo=usuario` (solo `NIVELES.materialUsuario`): panel estudiante, pestaña **Libros** en `/sesion/[id]`, y modal Libros del panel-advisor. La pestaña **Material** (amber) en `/sesion/[id]` usa `tipo=advisor` (solo `NIVELES.material`) y es exclusiva para advisors/admins. El campo `material`/`materiales` legacy NO se expone a estudiantes.
147. Comentarios de advisors (anotaciones y evaluaciones)
148. Próxima clase destacada (card grande con fecha, advisor, Zoom link). Muestra "---" cuando no hay evento agendado (no muestra el nivel/step del estudiante). Cuando el Zoom aún no está disponible muestra: "Enlace disponible 5 min antes, recuerde refrescar el navegador"
149. Actividades Complementarias (AI quiz): estudiantes con 1 sesión exitosa en un step normal pueden tomar un quiz de 10 preguntas generado por OpenAI (gpt-4o-mini). ≥50% para aprobar, máximo 3 intentos. Al aprobar se crea booking COMPLEMENTARIA y se ejecuta auto-promoción
150. Verificación de contrato expirado al login: al cargar el panel, si `finalContrato < hoy` se inactiva automáticamente al estudiante y su titular
151. Auto-reactivación de OnHold al login: al cargar el panel, si `fechaFinOnHold < hoy` se desactiva OnHold automáticamente, se extiende el contrato por los días pausados y se crea entrada en extensionHistory

### Contratos con Templates
152. Plantillas de contrato configurables por plataforma
153. Llenado dinámico de templates con {{placeholders}} (titular, beneficiarios, financiero, consentimiento)
154. Detalle de contrato admin con edición inline por sección (titular, referencias, beneficiarios, financiero)
155. Vista previa de contrato renderizado en modal

### Subir Lote (Importación Masiva de Personas)
156. Carga de archivo CSV con drag & drop para crear/actualizar registros en PEOPLE
157. Parseo client-side de CSV con aliases flexibles de columnas (ej: "Documento"→"numeroId", "Nombres"→"primerNombre", "Cédula"→"numeroId"). Soporta separadores `,` y `;`
158. Campo mapping CSV→DB: `pais`→`plataforma`, `direccion`→`domicilio`
159. Vista previa de datos parseados con tabla editable inline antes de importar
159. Validación de campos obligatorios (numeroId, primerNombre, primerApellido) con resaltado visual
160. UPSERT: busca por (numeroId + tipoUsuario), si existe UPDATE, si no INSERT (sin ON CONFLICT ya que PEOPLE no tiene unique constraint en esos campos)
161. Soporte de formatos de fecha YYYY-MM-DD y DD/MM/YYYY
162. Máximo 5000 registros por lote, reporte de éxitos/fallos/errores
163. Acceso restringido a SUPER_ADMIN únicamente

### Visor de Base de Datos (dblgs)
164. Herramienta de debug para ver tablas de PostgreSQL (solo SUPER_ADMIN/ADMIN)
165. Lista de tablas con schema y conteo de registros
166. Lectura paginada con ordenamiento y filtros dinámicos
167. Edición de celdas individuales con coerción de tipos
168. Creación de registros con auto-generación de _id
169. Eliminación masiva de registros (máximo 100)
170. Filtro por NULL/vacío: botón `∅` por columna → filtra `IS NULL OR = ''` (texto) o `IS NULL` (otros tipos)
171. Filtro por rango de fechas: columnas tipo fecha/timestamp muestran dos date pickers (Desde ≥ / Hasta ≤) con botón `∅ nulo`; backend usa `__gte`/`__lte` como sufijos de clave en filters

### Caché y Rendimiento
162. Caché client-side en localStorage con TTL para calendario (5 min, keys por mes)
163. Caché server-side en memoria para permisos (5 min TTL, por rol)
164. Invalidación automática de caché en operaciones CRUD
165. Endpoint admin para invalidación manual de caché de permisos
166. React Query con staleTime configurable por feature (5-30 min)

## Architecture

### Data Flow
```
Browser (React)
   │  El usuario interactúa con la app
   ▼
HOOKS (use-student.ts, use-calendar.ts, ...)
   │  Reciben la petición del componente,
   │  la pasan al API, y manejan cache/loading/error
   │  con React Query.
   ▼
API ROUTES (postgres/students/[id]/route.ts)
   │  Adaptadores HTTP delgados. Solo reciben el request,
   │  llaman al servicio, y devuelven la respuesta.
   │  Usan handler()/handlerWithAuth() para estandarizar
   │  try/catch, auth y error responses.
   ▼
SERVICES (student.service.ts, contract.service.ts, ...)
   │  Lógica de negocio. Saben las "recetas":
   │  "Para un perfil, buscar en ACADEMICA y si no,
   │   buscar en PEOPLE". Combinan repositorios.
   ▼
REPOSITORIES (people.repository.ts, academica.repository.ts, ...)
   │  Capa de acceso a datos. Solo SQL parametrizado.
   │  Un repositorio por tabla (o grupo de tablas).
   ▼
PostgreSQL (Digital Ocean)
```

### Los archivos y qué hacen

```
src/
├── hooks/                   ← HOOKS - Frontend data fetching (8 archivos)
│   ├── use-api.ts               Wrapper de fetch con manejo de errores
│   ├── use-student.ts           Datos de estudiantes (perfil, académico, progreso, onhold, extensiones)
│   ├── use-calendar.ts          Datos del calendario (eventos, bookings, inscripciones)
│   ├── use-advisors.ts          Datos de advisors (lista, stats)
│   ├── use-search.ts            Búsqueda global con debounce
│   ├── use-dblgs.ts             Visor de BD (tablas, schema, rows, CRUD)
│   ├── use-panel-estudiante.ts  Panel estudiante (me, events, stats, progress)
│   ├── use-complementaria.ts   Actividades complementarias (eligibility, generate, grade, attempts)
│   └── usePermissions.ts        Permisos del usuario (hasPermission, hasAny, hasAll)
│
├── app/api/                 ← API ROUTES - Adaptadores HTTP (~95 rutas)
│   ├── postgres/
│   │   ├── students/            Perfil, academic, step, toggle-status, onhold, extend, progress, contract
│   │   ├── calendar/            Eventos del calendario, CRUD
│   │   ├── events/              Eventos, bookings, inscripciones, batch-counts, welcome, filtered, sessions
│   │   ├── people/              PEOPLE CRUD, comments, beneficiarios-sin-registro, bulk-import (CSV UPSERT)
│   │   ├── advisors/            Lista, stats, events, by-email, name, create (público)
│   │   ├── search/              Búsqueda unificada (PEOPLE + ACADEMICA)
│   │   ├── contracts/           Contratos, búsqueda, template, next-number, detalle editable
│   │   ├── dashboard/           Estadísticas del inicio, gráficas IA (charts vía Claude API)
│   │   ├── roles/               CRUD de roles y permisos
│   │   ├── niveles/             Niveles y steps
│   │   ├── financial/           Datos financieros
│   │   ├── export/              Exportación CSV (eventos, estudiantes)
│   │   ├── reports/             Reportes de asistencia
│   │   ├── academic/            Historial académico, asistencia, evaluación, actividad
│   │   ├── approvals/           Aprobaciones pendientes
│   │   ├── materials/           Material por nivel/step, books (DO Spaces proxy); presigned URLs para Office Viewer
│   │   ├── permissions/         Permisos del usuario actual
│   │   ├── users/               Rol de usuario por email
│   │   ├── panel-estudiante/    Panel del estudiante (me, events, stats, progress, book, cancel, materials, history, comments)
│   │   └── dblgs/               Visor/editor de base de datos
│   ├── consent/                 Consentimiento declarativo (status, contract-data, send-otp, verify, auto-approve)
│   ├── contracts/               Generación y envío de PDF de contrato (send-pdf)
│   ├── auth/                    NextAuth handler, logout, CRM bridge (cross-app SSO via HMAC)
│   ├── cron/                    Jobs automáticos (expire-contracts, reactivate-onhold)
│   ├── wix/                     Integraciones WhatsApp, CRUD beneficiarios, estado titular
│   ├── admin/                   Invalidar cache de permisos
│   ├── dashboard/               Stats y top-students (legacy, con handler wrapper)
│   ├── permissions/             Matriz completa de permisos, actualización
│   ├── roles/                   Crear roles
│   ├── user/                    Permisos del usuario actual
│   ├── informes/                Informes de beneficiarios
│   └── internal/                Verificación de credenciales (uso interno por auth)
│
├── services/                ← SERVICES - Lógica de negocio (11 archivos)
│   ├── student.service.ts       Perfil (lookup ACADEMICA→PEOPLE), historial, toggle status
│   ├── contract.service.ts      OnHold, extensiones, expiración
│   ├── calendar.service.ts      Crear/editar/eliminar eventos con bookings
│   ├── enrollment.service.ts    Inscribir estudiantes en eventos (validación de capacidad)
│   ├── search.service.ts        Búsqueda unificada en PEOPLE + ACADEMICA en paralelo
│   ├── dashboard.service.ts     Estadísticas del dashboard (queries paralelas)
│   ├── progress.service.ts      Reporte "¿Cómo voy?" (diagnóstico del estudiante)
│   ├── panel-estudiante.service.ts  Panel del estudiante (perfil, eventos, stats, progreso)
│   ├── student-booking.service.ts   Auto-reserva de clases por estudiantes
│   ├── consent.service.ts       Consentimiento declarativo (OTP, verificación, hash SHA-256)
│   ├── complementaria.service.ts Actividades complementarias (OpenAI quiz generation, grading, auto-promotion)
│   └── dblgs.service.ts         Acceso dinámico a tablas de BD (visor/editor)
│
├── repositories/            ← REPOSITORIES - Acceso a datos / SQL (10 archivos)
│   ├── base.repository.ts       Clase base: findById, findMany, updateFields, parseJsonb
│   ├── people.repository.ts     Tabla PEOPLE (~10 rutas)
│   ├── academica.repository.ts  Tabla ACADEMICA (~4 rutas)
│   ├── booking.repository.ts    Tabla ACADEMICA_BOOKINGS (~8 rutas)
│   ├── calendar.repository.ts   Tabla CALENDARIO (~6 rutas)
│   ├── advisor.repository.ts    Tabla ADVISORS (~5 rutas, incluye create)
│   ├── roles.repository.ts      Tablas ROL_PERMISOS + USUARIOS_ROLES (~4 rutas)
│   ├── niveles.repository.ts    Tablas NIVELES + STEP_OVERRIDES (~5 rutas)
│   ├── financial.repository.ts  Tabla FINANCIEROS (~2 rutas)
│   ├── complementaria.repository.ts Tabla COMPLEMENTARIA_ATTEMPTS (attempts CRUD, eligibility checks)
│   └── dblgs.repository.ts      Consultas genéricas dinámicas por tabla (standalone, no extiende Base)
│
├── lib/                     ← UTILIDADES compartidas (16 archivos)
│   ├── errors.ts                Clases de error: NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError
│   ├── api-helpers.ts           handler(), handlerWithAuth(), successResponse(), errorResponse()
│   ├── query-builder.ts         buildDynamicUpdate(), buildDynamicWhere()
│   ├── id-generator.ts          ids.event(), ids.booking(), ids.person(), ids.comment(), ids.advisor(), etc.
│   ├── postgres.ts              Pool de conexión PostgreSQL (SSL, Digital Ocean, globalThis cache para hot reload)
│   ├── auth.ts                  NextAuth.js config (legacy)
│   ├── auth-postgres.ts         NextAuth.js config (PostgreSQL actual)
│   ├── middleware-permissions.ts Cache de permisos server-side (5 min TTL)
│   ├── zod-resolver.ts          Custom zodResolver para react-hook-form
│   ├── custom-permissions.ts    Resolución de permisos con fallback
│   ├── permissions.ts           Utilidades de permisos
│   ├── whatsapp.ts              Envío de WhatsApp vía Whapi.cloud (formatPhoneNumber, sendWhatsAppMessage)
│   ├── otp-store.ts             Almacén in-memory de OTP (generateOtp, saveOtp, verifyOtp, TTL 10 min)
│   ├── contract-template-filler.ts  Llenado de templates de contrato con {{placeholders}} (titular, beneficiarios, financiero, consentimiento)
│   ├── export-excel.ts          exportToExcel() - Genera CSV con UTF-8 BOM para compatibilidad con Excel (client-side)
│   └── utils.ts                 Utilidades generales
│
├── components/              ← COMPONENTES React organizados por feature (12 directorios)
│   ├── layout/                  DashboardLayout, sidebar, navigation (1 archivo)
│   ├── student/                 StudentTabs, StudentAcademic, StudentOnHold, StudentContract, StudentGeneral... (10 archivos)
│   ├── search/                  SearchBar (búsqueda global) (1 archivo)
│   ├── calendar/                CalendarView, EventModal, EventForm... (4 archivos)
│   ├── permissions/             PermissionGuard, PermissionGate, PermissionButton, ProtectedAction (4 archivos)
│   ├── panel-estudiante/        Panel del estudiante (10 archivos)
│   ├── person/                  Detalle de persona/titular (6 archivos)
│   ├── advisor/                 Detalle de advisor (3 archivos)
│   ├── advisors/                Lista de advisors (3 archivos)
│   ├── session/                 Detalle de sesión (4 archivos)
│   ├── dashboard/               Componentes del dashboard (2 archivos: DashboardStats, DashboardCharts)
│   └── academic/                Componentes académicos (1 archivo)
│
└── types/                   ← TypeScript definitions (4 archivos)
    ├── index.ts                 Student, Person, Event, Booking, etc.
    ├── permissions.ts           Enums de permisos sincronizados con ROL_PERMISOS
    ├── hapi-overrides.d.ts      Override tipos hapi (fix build)
    └── hapi__address.d.ts       Override tipos hapi/address (fix build)
```

### Convenciones importantes

- **`server-only`**: Todos los repositorios, servicios y api-helpers importan `'server-only'` para evitar que se incluyan en bundles del cliente
- **SQL parametrizado**: Todo el SQL usa placeholders `$1, $2, ...` (nunca interpolación de strings)
- **React Query v3**: Se importa de `'react-query'` (NO de `@tanstack/react-query`)
- **handler() wrapper**: Todas las rutas API de postgres/ usan `handler()` o `handlerWithAuth()` de `@/lib/api-helpers` para estandarizar try/catch y respuestas de error. Rutas legacy (auth, cron, wix) son excepciones legítimas que manejan su propio error handling
- **JSONB**: Campos como `onHoldHistory`, `extensionHistory`, `evaluacion` se almacenan como JSONB en PostgreSQL. Los repositorios usan `parseJsonb()` de la clase base para deserializarlos

## Development Commands

```bash
# Development
npm run dev                    # Start dev server on port 3001

# Build and Deploy
npm run build                  # Production build with memory optimization
npm run start                 # Start production server on port 3001
```

## Running DB Scripts / Managed DB Access

**Importante**: `DATABASE_URL` en `.env.local` apunta a la **BD de PRODUCCIÓN** (Digital Ocean Managed PostgreSQL, cluster `08d65733-6811-420c-a0a1-a71d6b3b9c6d`). No hay BD local — el dev server y todos los scripts hablan con producción. Por eso, si el dev server muestra "connection timeout" / "no me deja ver en local", es casi siempre el **firewall** (la IP no está whitelisteada), no un bug.

### Acceso por Trusted Sources (firewall)
La BD solo acepta conexiones desde IPs en su whitelist. La IP del entorno de desarrollo **cambia entre sesiones**, así que el flujo para correr cualquier script o usar el dev server con datos es:

```bash
MYIP=$(curl -s https://api.ipify.org)                                              # IP actual
doctl databases firewalls append 08d65733-6811-420c-a0a1-a71d6b3b9c6d --rule ip_addr:$MYIP
# ... esperar ~8-10s a que propague, luego correr el script / usar el dev server ...
# al terminar, REMOVER la IP (higiene de seguridad):
doctl databases firewalls list 08d65733-6811-420c-a0a1-a71d6b3b9c6d | awk -v ip="$MYIP" '$0~ip{print $1}' \
  | xargs -I{} doctl databases firewalls remove 08d65733-6811-420c-a0a1-a71d6b3b9c6d --uuid {}
```

Conexión típica en los scripts: `new Client({ connectionString: DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl: { rejectUnauthorized: false } })`.

### Convención de scripts (`scripts/*.js`)
- **Idempotentes** y **dry-run por defecto**: corren sin escribir hasta pasar **`--apply`** (algunos además exigen `--motivo`). Las migraciones de esquema usan `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`.
- Escrituras de datos en **transacción** (`BEGIN`/`COMMIT`/`ROLLBACK`); para validar SQL sin persistir, envolver en `BEGIN … ROLLBACK`.
- Leen `.env.local` con `require('dotenv').config({ path: '.env.local' })`.
- **Gitignored**: `scripts/diag-*.js` (diagnósticos ad-hoc) y `*.csv` (datos sensibles) — los CSV de entrada/reporte viven solo en `docs/` local.
- Catálogo navegable de todos los scripts (utilidad, parámetros, lectura/escritura) en **`/admin/scripts/consulta`** (lee `scripts/` del FS, nunca los ejecuta).

## Key Implementation Details

### Authentication System
- Uses NextAuth.js with credentials from PostgreSQL `USUARIOS_ROLES` table
- Supports both bcrypt hashed passwords and plain text (legacy compatibility)
- User credentials and roles stored in PostgreSQL
- **Login blocked by `USUARIOS_ROLES.activo = false`**: When a student/contract is inactivated (toggle, OnHold, contract expiration), `activo` is set to `false` to prevent login. Reactivation restores `activo = true`
- Admin fallback credentials via environment variables: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Implementation: `src/lib/auth-postgres.ts` (actual), `src/lib/auth.ts` (legacy)
- Password verification: Checks PostgreSQL first, then falls back to test users

### Custom Form Validation
- Custom `zodResolver` implementation in `src/lib/zod-resolver.ts`
- Replaced `@hookform/resolvers` to avoid peer dependency issues
- Only supports Zod schemas

### WhatsApp Integration
- **Provider**: Whapi.cloud API. **Toda la mensajería WhatsApp sale por Whapi** — no hay código Twilio en `src/` (ver "Plantillas Twilio" abajo)
- **Implementation**: `src/lib/whatsapp.ts`
- **Functions**: `formatPhoneNumber(raw)` validates/strips to digits, `sendWhatsAppMessage(toNumber, messageBody)` sends via Whapi
- **Uses**: Envío de contratos PDF, mensajes de bienvenida, OTP para consentimiento, OTP de recuperar contraseña, envío masivo por plantillas, confirmación Exam. Intern.
- **⚠️ Token**: `WHAPI_TOKEN` **NO está configurado en producción** — todo corre con los fallbacks hardcodeados del repo, y **hay dos distintos**, así que la plataforma **envía desde dos números**:

| Token (sufijo) | Canal | Número | Lo usan |
|---|---|---|---|
| `…Ds2EYj` | SPDRMN-67FL6 | **+56 9 5770 3724** (*Coordinador Servicio al usuario*) | `lib/whatsapp.ts` (OTP consentimiento, OTP contraseña, bienvenida al aprobar, envío masivo, exam-intern), `wix/sendWhatsApp`, `contracts/[id]/send-pdf` |
| `…LzPgtx` | DEADPL-QSNG2 | **+56 9 4267 9066** (*Lets Go Speak*) | `wix/sendWelcomeWhatsApp`, `wix/sendReagendarWhatsApp` |

  Consecuencia: **el mismo mensaje de bienvenida sale de un número u otro según el botón** (Aprobar vs "Mensaje de Bienvenida"). Configurar `WHAPI_TOKEN` unifica 5 de los 9 puntos, pero **no todos**: [send-pdf/route.ts:12](src/app/api/contracts/[id]/send-pdf/route.ts#L12) y [wix/sendWhatsApp/route.ts:50](src/app/api/wix/sendWhatsApp/route.ts#L50) llevan el token **inline sin `process.env`**. Los tokens están en git (también en `src/backend/FUNCIONES WIX/`) → **pendiente rotarlos**.
- **Mensajes hardcodeados vs plantillas**: los del flujo de firma y bienvenida están **en código**, no en `MESSAGE_TEMPLATES` — editar plantillas desde `/admin/plantillas/gestion` no los cambia. El de "Solicitar firma" se arma **en el cliente** ([contrato/[id]/page.tsx:378](src/app/dashboard/comercial/contrato/[id]/page.tsx#L378)) y se envía por `POST /api/wix/sendWhatsApp`, que acepta `toNumber` + `messageBody` arbitrarios con solo validar sesión.

### Plantillas Twilio (preparadas, SIN uso todavía)
Cuenta **`ACee5675…` ("LGS")** — distinta de la de las env vars `TWILIO_*` de producción, que apuntan a `ACbae12b…` con credenciales muertas. Sender ONLINE: **+56 600 914 2331** (perfil *"Lets Go Speak Ec"*).

| Plantilla | ContentSid | Categoría | Estado |
|---|---|---|---|
| `lgs_activacion_cuenta_es` | `HXa97297894ae3f964b0d9bd96a8aa5d6d` | UTILITY 🔒 | candidata a migrar |
| `lgs_solicitud_firma_es` | `HXa031f1b9156a1fb9a4cc702bee853df1` | UTILITY | candidata a migrar |
| `lgs_codigo_verificacion_es` | `HXdd7c5ec40ac95d2862c7eb942427d040` | AUTHENTICATION | en reserva |
| `lgs_contrato_pdf_es` | `HX5a90602bbf7dce853f79f42ed2589591` | UTILITY | en reserva |
| `lgs_bienvenida_registro_es` | `HX7d7886e87f62820565b5a90d273170c7` | MARKETING | sustituida, borrable |

- **Regla de la cuenta**: todo se registra como **UTILITY** con **`allow_category_change: false`**. Twilio lo manda en `true` por defecto y Meta **reclasifica a MARKETING en silencio** (más caro + límites de frecuencia). Con el flag en `false`, Meta rechaza en vez de reclasificar. **Excepción**: los OTP, que Meta obliga a `AUTHENTICATION`.
- Para que Meta apruebe como UTILITY el texto debe ser **transaccional** — sin emojis ni tono celebratorio.
- Los Content de Twilio son **inmutables**: cambiar el texto exige borrar y recrear. Borrar una plantilla **aprobada** bloquea ese nombre en Meta ~30 días → usar nombre nuevo.
- Scripts: [twilio-create-bienvenida-template.js](scripts/twilio-create-bienvenida-template.js), [twilio-create-firma-templates.js](scripts/twilio-create-firma-templates.js) (`--preview` / `--apply` / `--submit`).
- **DECISIÓN**: el **OTP** y el **envío del PDF** se quedan en Whapi. Son ruta crítica y concentran los dos blockers: (a) Twilio valida el medio **por extensión** y las URLs de API2PDF no la tienen — el arreglo limpio es una ruta alias de [download-pdf](src/app/api/contracts/[id]/download-pdf/route.ts) terminada en `.pdf`, con el token **en la ruta y no en la query**; (b) en plantillas `AUTHENTICATION` **el cuerpo lo genera Meta** y no se puede personalizar (la marca visible ahí es el nombre del perfil del sender).

### PDF Generation
- **Provider**: API2PDF (Chrome URL rendering)
- **Implementation**: `src/app/api/contracts/[id]/send-pdf/route.ts`
- **Flow**: Renders public contract page (`/contrato/[id]`) → API2PDF generates PDF → sends via WhatsApp
- **Options**: `delay: 10000` (wait for page render), `scale: 0.75`, `printBackground: true`

### OTP / Digital Consent System
- **OTP Store**: In-memory Map in `src/lib/otp-store.ts` (10-minute TTL, one-time use)
- **Service**: `src/services/consent.service.ts`
- **Flow**: Send OTP → Verify OTP → Create consent JSON → Compute SHA-256 hash → Save to PEOPLE
- **Fields saved**: `consentimientoDeclarativo` (JSONB), `hashConsentimiento` (text)
- **Auto-approve**: Admin can bypass OTP, marks `tipoAprobacion: 'AUTOMATICA'`

### Contract Templates
- **Template filler**: `src/lib/contract-template-filler.ts` (client-safe, no server imports)
- **Placeholders**: `{{primerNombre}}`, `{{beneficiarios}}`, `{{totalPlan}}`, `{{consentimiento}}`, etc.
- **Templates**: Stored in DB, fetched via `/api/postgres/contracts/template?plataforma=X`
- **Consent block**: Auto-generated with timestamp, document number, verified phone, SHA-256 hash

### Caching Strategy
- **Client-side**: localStorage-based caching for calendar events with 5-minute TTL
- **Client-side**: React Query with configurable staleTime (5-30 min depending on feature)
- **Server-side (Middleware)**: In-memory cache for user permissions with 5-minute TTL
- Cache keys include month/date for granular invalidation
- Automatic cache cleanup on expiration
- Cache invalidation on CRUD operations
- Manual invalidation via `/api/admin/invalidate-permissions-cache`
- Implementation:
  - Calendar: `src/app/dashboard/academic/agenda-sesiones/page.tsx`
  - Permissions: `src/lib/middleware-permissions.ts`

## Deployment Configuration

### Environment Variables (Digital Ocean)

**App ID real: `46497990-93e8-406d-ab77-ed1835ae4bae`** (el que figura en [.do/app.yaml](.do/app.yaml) está desactualizado y da 404). Consultar con `doctl apps spec get <APP_ID>`.

```
NEXTAUTH_URL=https://your-app-url.ondigitalocean.app
NEXTAUTH_SECRET=your_32_character_secret_key
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-secure-password
DATABASE_URL=postgresql://user:pass@host:port/dbname
CRON_SECRET=secret_for_cron_job_auth
OPENAI_API_KEY=openai_api_key_for_complementaria
ANTHROPIC_API_KEY=anthropic_api_key_for_dashboard_charts
GOOGLE_SERVICE_ACCOUNT_JSON=service_account_json_para_modo_drive_lgs
GOOGLE_DRIVE_FOLDER_ID=carpeta_contratos_unidad_compartida
CRM_BRIDGE_SECRET=hmac_para_sso_con_el_crm
KIDS_API_URL=base_url_de_kids2026 (integración proceso Kids; sin configurar = integración inactiva)
KIDS_INTAKE_API_KEY=clave_de_servicio_x-api-key (= LGS_INTAKE_API_KEY del lado de KIDS2026)
DO_SPACES_KEY / DO_SPACES_SECRET / DO_SPACES_BUCKET / DO_SPACES_REGION / DO_SPACES_ENDPOINT
SENCE_RUT_OTEC=rut_del_otec_para_integracion_sence
SENCE_TOKEN=token_sence_generado_en_sistemas_sence_cl_rts
SENCE_COD_SENCE=codigo_sence_del_otec
SENCE_AMBIENTE=test_o_produccion
```

**⚠️ Variables que el código espera pero NO están configuradas en producción** (corren con el fallback hardcodeado del repo):

| Variable | Situación |
|---|---|
| `WHAPI_TOKEN` | Sin configurar → dos tokens hardcodeados = **dos números emisores** (ver "WhatsApp Integration") |
| `API2PDF_KEY` | Sin configurar → usa el fallback de [send-pdf/route.ts:11](src/app/api/contracts/[id]/send-pdf/route.ts#L11) |

**Variables presentes pero sin uso**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_TWIML_APP_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` — **ninguna se lee** (no hay código Twilio en `src/`), apuntan a la cuenta `ACbae12b…` cuyas credenciales están **muertas** (401 en auth token y en API key), y están guardadas **en texto plano** (no como `SECRET`). Si se retoma Twilio, la cuenta viva es `ACee5675…`.

### TypeScript Build Configuration
- Target: `es2017`
- Build errors ignored in production (`ignoreBuildErrors: true`)
- Test files excluded from compilation
- Hapi type overrides in `src/types/` to fix build errors

### Docker Deployment
- Multi-stage build with dependency cleanup
- Test directories removed from node_modules
- Standalone output for Digital Ocean App Platform
- Configuration: `Dockerfile:1-67`

## Common Issues and Solutions

### TypeScript Compilation Errors
- Production builds are more strict than development
- Use `ignoreBuildErrors: true` for third-party library issues
- Exclude problematic directories in `tsconfig.json`
- Hapi type errors fixed via override files in `src/types/hapi-overrides.d.ts` and `src/types/hapi__address.d.ts`

### Server-Side API Calls
- Always use `process.env.NEXTAUTH_URL` for server-side fetch calls
- Client-side should use relative URLs (`''` baseUrl)
- Avoid hardcoded `localhost:3001` references

### Caching Issues
- localStorage may not persist in some environments
- Check browser dev tools for cache key conflicts
- Verify TTL calculations are working correctly
- Cache is automatically invalidated on event CRUD operations
- Permissions cache can be manually invalidated via `/api/admin/invalidate-permissions-cache`
- **Back-button bypass after logout**: El middleware aplica `Cache-Control: no-store` via `noCacheNext()` a **todos** los returns de rutas protegidas (incluyendo `alwaysAllowedRoutes` como `/panel-estudiante`). Si se agrega un nuevo `return NextResponse.next()` en el middleware, debe reemplazarse por `return noCacheNext()` para mantener esta protección

### Form Validation Issues
- Use the custom `zodResolver` from `src/lib/zod-resolver.ts`
- Do not install `@hookform/resolvers` - causes peer dependency conflicts
- Only Zod schemas are supported

### Duplicate PEOPLE Records y Login
- Algunos estudiantes tienen registros duplicados en PEOPLE (uno como BENEFICIARIO, otro como TITULAR) con el mismo `numeroId`
- **Login**: `resolveStudentFromSession()` en `panel-estudiante.service.ts` prioriza BENEFICIARIO sobre TITULAR cuando comparten email, ya que el panel estudiante es para beneficiarios
- **ACADEMICA-PEOPLE JOIN**: `student.service.ts` prioriza BENEFICIARIO sobre TITULAR cuando hay duplicados con el mismo `numeroId` (ORDER BY tipoUsuario, BENEFICIARIO primero)
- **Bookings duplicados**: `student-booking.service.ts` valida contra TODOS los `_id` del estudiante en PEOPLE para evitar bookings duplicados cuando hay registros duplicados

### OnHold Edge Cases
- La desactivación de OnHold distingue entre "real OnHold" (tiene fechaOnHold) y otros estados inactivos (estadoInactivo=true sin fechaOnHold)
- Solo limpia campos de OnHold y extiende contrato si realmente estaba en OnHold
- La reactivación automática al login del estudiante replica la misma lógica que `contractService.deactivateOnHold()`

### Session Detail (Evaluación)
- Al seleccionar un estudiante en el detalle de sesión (`/sesion/[id]`), se cargan los datos de evaluación previamente guardados (asistencia, participación, calificación, anotaciones, comentarios)
- El cache de inscritos se invalida correctamente al enrollar/desenrollar estudiantes
- El endpoint de grading (`/api/postgres/events/[id]/grade`) funciona para eventos individuales

### Sistema de Comentarios
- Los comentarios de personas/titulares están en `PEOPLE.comentarios` (JSONB array), **no** en una tabla `COMENTARIOS` separada
- La tabla `COMENTARIOS` no existe en producción; `comments.repository.ts` fue eliminado
- `people.repository.ts` maneja comentarios con `getComments()` y `saveComments()` directamente sobre el campo JSONB
- API: `GET/POST /api/postgres/people/[id]/comments` — lee y escribe el array en `PEOPLE.comentarios`

### Propagación de cambios de CALENDARIO a ACADEMICA_BOOKINGS

Cuando se edita un evento en CALENDARIO, `calendar.service.updateEvent()` propaga automáticamente los siguientes campos a todos los bookings del evento:
- `advisor`, `linkZoom` — siempre propagados si cambian
- `nombreEvento`, `titulo` — nombre del evento
- `nivel`, `step` — nivel y step del evento
- `tituloONivel` — título combinado
- `tipo` / `tipoEvento` — tipo de evento

Esto garantiza que los bookings existentes reflejen siempre el estado actual del evento en CALENDARIO.

### Datos históricos Wix en ACADEMICA_BOOKINGS y CALENDARIO
La plataforma opera 100% sobre PostgreSQL. Los datos migrados de Wix (marzo 2026) dejaron registros históricos con columnas legacy que las queries deben tolerar:
- **`idEvento`** (legacy Wix) vs **`eventoId`** (nuevo POSTGRES): queries usan `COALESCE(b."eventoId", b."idEvento")`
- **`tipoEvento`** (legacy Wix) vs **`tipo`** (nuevo POSTGRES): queries usan `COALESCE(c."tipo", b."tipoEvento")`
- Nuevos bookings usan solo `eventoId` (sin `numeroId`, `celular`, `plataforma` que no existen en ACADEMICA_BOOKINGS)

### Timestamps de CALENDARIO: todos en UTC (fix aplicado 2026-04-15)
- **Todos los eventos** tienen `origen='POSTGRES'` y `dia` almacenado en UTC correcto
- **Fix aplicado**: 19.943 registros Wix normalizados via `dia = (dia::timestamp AT TIME ZONE 'America/Bogota')` + `origen = 'POSTGRES'`. Backup en `CALENDARIO_BACKUP_20260414` (22.819 registros)
- **`eventDiaToUTC(dia)`** en `student-booking.service.ts` es ahora un simple `new Date(dia)` — el branch de COLOMBIA_OFFSET_MS fue eliminado

### CALENDARIO JOIN para Step/Nivel Correcto en Bookings
- **Problema**: Los bookings almacenan el step del estudiante al momento de agendar, NO el step real del evento. Si un estudiante en Step 16 agenda una sesión de Step 17, el booking guarda "Step 16".
- **Solución**: Todas las queries de bookings hacen `LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")` y usan `COALESCE(c."step", b."step")` / `COALESCE(c."nivel", b."nivel")` para preferir el step/nivel del evento.
- **Archivos afectados**:
  - `booking.repository.ts` → `findByStudentId()` (historial del estudiante)
  - `progress.service.ts` → query de `allClasses` (diagnóstico "¿Cómo voy?")
  - `student-booking.service.ts` → `bookEvent()` ahora guarda el step del evento, no el del estudiante
- **Historial de CLUBs**: En el panel estudiante, la columna Step muestra el nombre completo del step (ej: "TRAINING - Step 17") en vez de solo "TRAINING"

### WhatsApp/OTP Issues
- OTP store is in-memory: OTPs are lost on server restart
- OTP has 10-minute TTL, one-time use (deleted after verification)
- WhatsApp requires valid phone number (digits only, no spaces/dashes)
- `formatPhoneNumber()` in `src/lib/whatsapp.ts` strips non-digit characters
- If WhatsApp fails, check WHAPI_TOKEN is valid and phone format is correct

### PDF Generation Issues
- API2PDF renders the public contract page via Chrome URL
- `delay: 10000` (10 seconds) is needed to let Next.js page fully render
- If PDF is blank/incomplete, the contract page may have loading issues
- API2PDF key is required (`API2PDF_KEY` env var)

## Database Architecture
- **PostgreSQL** (Digital Ocean Managed Database) as sole data store
- Connection: `src/lib/postgres.ts` with connection pool (`max: 10`, `idleTimeoutMillis: 15000`) and SSL (`ssl: { rejectUnauthorized: false }`)
- Pool cached in `globalThis` to prevent connection exhaustion during Next.js hot reloads in development
- **`statement_timeout = 30s` e `idle_in_transaction_session_timeout = 60s` están fijados a nivel de BASE DE DATOS** (`ALTER DATABASE defaultdb SET ...`, aplicado 2026-09-07 tras el incidente de saturación). Aplican a toda conexión nueva, incluidos los scripts de `scripts/`. Un backfill que legítimamente tarde más debe empezar con `SET statement_timeout = 0` (funciona en conexión directa al 25060, no vía pooler).
  - **NUNCA** poner `statement_timeout` en el config del Pool de `pg`: en producción `DATABASE_URL` apunta al pooler PgBouncer (modo `transaction`), que rechaza los startup parameters y tumba TODAS las queries con `unsupported startup parameter`
  - El cluster es `db-s-1vcpu-1gb` (25 conexiones máx.) y está **compartido con otra app** (tablas `tenants`/`messages`/`conversations` del bot de WhatsApp), así que el presupuesto de conexiones y CPU es ajustado
- **No ejecutar DDL en el request path.** Un `ALTER TABLE ... IF NOT EXISTS` toma ACCESS EXCLUSIVE sobre la tabla y, si se encola detrás de una query lenta, bloquea todo el tráfico de esa tabla. Las migraciones van en `scripts/` (idempotentes, dry-run por defecto). Ver `ensureESSColumns` en [src/services/panel-estudiante.service.ts](src/services/panel-estudiante.service.ts) como referencia del patrón corregido (promesa cacheada, sin reintento)
- All SQL is parameterized ($1, $2, ...) to prevent injection
- JSONB fields for flexible data: `onHoldHistory`, `extensionHistory`, `evaluacion`, `steps`, `consentimientoDeclarativo`, etc.
- Key tables:
  - `PEOPLE`: Personas (titulares y beneficiarios), contratos, OnHold, consentimiento declarativo, comentarios
    - Campos de consentimiento: `consentimientoDeclarativo` (JSONB), `hashConsentimiento` (text)
    - Campos OnHold: `estadoInactivo`, `fechaOnHold`, `fechaFinOnHold`, `onHoldCount`, `onHoldHistory` (JSONB)
    - Campos extensión: `finalContrato` (DATE puro — sin hora ni TZ), `vigencia`, `extensionCount`, `extensionHistory` (JSONB) — **estos campos viven en PEOPLE, no en ACADEMICA**. Regla de expiración timezone-independent en [`src/lib/contract-expiry.ts`](src/lib/contract-expiry.ts): vencido cuando hoy UTC ≥ `finalContrato + 2` días (gracia +1 día para usuarios en cualquier zona)
    - Campos paralelos: `nivelParalelo`, `stepParalelo` (nullable)
    - Campo comentarios: `comentarios` (JSONB array) — comentarios internos por persona, NO hay tabla COMENTARIOS separada
    - Campo `gestorRecaudo` (VARCHAR nullable) — `USUARIOS_ROLES._id` del Ejecutivo de Recaudos asignado al titular (rol `RECAUDO_ASIST` o `RECAUDOS_JEFE`, solo activos). Solo aplica a `tipoUsuario='TITULAR'`. Validado en backend en `PATCH /api/postgres/people/[id]`. Asignación gateada por `PersonPermission.ASIGNAR_GESTOR_RECAUDO`
    - Campo `kids` (BOOLEAN, default false) — marca a la persona como segmento/programa infantil. Migración idempotente [scripts/add-kids-column.js](scripts/add-kids-column.js)
  - `ACADEMICA`: Registros académicos por estudiante (nivel, step, nivelParalelo, stepParalelo). **No contiene** campos de contrato/extensión/onhold
  - `ACADEMICA_BOOKINGS`: Inscripciones a eventos (asistencia, evaluación, calificación, participación, comentarios). Datos migrados de Wix usan columna `idEvento` (nueva: `eventoId`) y `tipoEvento` (queries usan COALESCE para compatibilidad)
  - `CALENDARIO`: Eventos (SESSION, CLUB) con advisor, nivel, step, linkZoom, limiteUsuarios. Eventos de bienvenida se distinguen por `tituloONivel=WELCOME`. La columna `tipo=WELCOME` existe solo en datos legacy de Wix
  - `ADVISORS`: Profesores/advisors (primerNombre, primerApellido, nombreCompleto, email, zoom, telefono, pais, activo, fotoAdvisor TEXT, domicilioadvisor TEXT, esPlanta BOOLEAN, usuarioRolId). `fotoAdvisor` almacena key de DO Spaces (`fotosAdvisors/`); `domicilioadvisor` texto libre. Creación vía página pública `/nuevo-advisor` + auto-insert en USUARIOS_ROLES con rol ADVISOR. Contadores de por vida `cancelada` (INTEGER, +1 en Suspensión y en Sesión-con-booking) y `noasistio` (INTEGER, +1 solo en Sesión-con-booking) — ver "Cancelación sin reemplazo"
  - `ADVISOR_EVENT_LOG`: Snapshots inmutables (solo INSERT) de transiciones de evento del advisor. Estados: `Canceled` (cambio de advisor), `Suspended` (cancelación del evento) y `NoAsistio` (cancelación con booking). Campos: eventoId, fechaEvento, tipo, nivel, step, tituloEvento, horaFin, observaciones, canceladoPor, fechaTransicion, motivoTransicion. Fuente del ítem "No Asistió" acotable por rango en el informe de Horas Advisor
  - `CANCELACIONES_SIN_REEMPLAZO`: Snapshot persistente (histórico) de alumnos de sesiones canceladas con booking, para gestión de Servicio. Campos: `loteId` (agrupa por sesión), datos de sesión + advisor + alumno (nombre/telefono/email), `gestion` (SIN_GESTION/CONTACTADO_REAGENDO/NO_RESPONDE), `gestionadaPor` (SERVICIO/ACADEMICO), `fechaGestion`, `loteGestionado` (false=Actual, true=Histórico). Poblada por `calendar.service.deleteEvent` en modo `conBooking`; leída en `/dashboard/servicio/cancelacion-sin-reemplazo`
  - `USUARIOS_ROLES`: Credenciales y roles de usuario (email, password bcrypt/plain, rol). Campos adicionales: `numberid` (columna legacy existente, se llena con `numeroId` de ACADEMICA), `contrato` (auto-creada con `ADD COLUMN IF NOT EXISTS`, se llena desde ACADEMICA al registrarse en `/nuevo-usuario/[id]`)
  - `ROL_PERMISOS`: Definiciones de roles con arrays de permisos (JSONB)
  - `NIVELES`: Niveles académicos con steps, material, clubs y contenido (esParalelo flag para ESS, contenido TEXT para temario del step). Campos de material: `material` (JSONB advisor) y `materialUsuario` (JSONB array de keys DO Spaces). Los registros migrados de Wix en `material` pueden tener URLs `wix:document://...` (no accesibles — deben reemplazarse desde admin); los nuevos usan keys `materials/{nivel}/{tipo}/{step}-{filename}`. `GET /api/postgres/materials/nivel?step=&nivel=&tipo=usuario|advisor|all` expone campo `key` (Spaces key) cuando el material está en DO Spaces. `GET /api/postgres/materials/presigned?key=` genera presigned URL (10 min) para archivos en Spaces, usada por Descargar y el visualizador Office Online (PPTX/DOCX/XLSX)
  - `STEP_OVERRIDES`: Overrides manuales de steps por estudiante. El campo `studentId` guarda el ACADEMICA `_id` (no el PEOPLE `_id`). Si el estudiante tiene duplicados en ACADEMICA, el endpoint retorna error "USUARIO duplicado en ACADEMICA"
  - `FINANCIEROS`: Datos financieros (totalPlan, pagoInscripcion, saldo, cuotas, formaPago)
  - `ContractTemplates`: Plantillas de contrato por plataforma (texto con {{placeholders}}). **Ojo con el nombre**: la tabla es `"ContractTemplates"` (CamelCase, legacy Wix) y la columna del contenido es **`template`** — NO `CONTRACT_TEMPLATES`/`contenido`. El lookup se hace por `plataforma` con fallback case-insensitive (`LOWER(plataforma) = LOWER($1)`)
  - `COMPLEMENTARIA_ATTEMPTS`: Intentos de actividades complementarias (AI quiz). Campos: studentId, nivel, step, attemptNumber, questions (JSONB), answers (JSONB), score, passed, bookingId, status (IN_PROGRESS/PASSED/FAILED), plataforma (VARCHAR 50, nullable — se llena al generar el quiz desde el panel estudiante)
  - `APP_CONFIG`: Configuración de la aplicación (clave/valor). Campos: key (PK), value (TEXT), color (VARCHAR 20, default '#ffffff'), updatedBy, _updatedDate. Registros: `ticker_message` (banner animado panel estudiante), `banner_image` (base64 imagen banner login), `banner_active` ('true'/'false' visibilidad banner login), `kids_feature_activo` ('true'/'false' — proceso Kids en Crear Contrato, togglable en Mantenimiento › Proceso Kids), flags de material interactivo (`material_interactivo_v2_activo`, `material_interactivo_clasico_activo`, `material_interactivo_ejercicios_activo`)
  - `auditautoaprov`: Auditoría de auto-aprobaciones de consentimiento. Auto-creada (`CREATE TABLE IF NOT EXISTS`) al primer uso. Campos: `_id` (PK), `contrato`, `titularId`, `usuarioEmail`, `usuarioNombre`, `ip`, `userAgent`, `_createdDate`. Se inserta un registro cada vez que un usuario ejecuta "Auto-Aprobar Consentimiento" en `/dashboard/comercial/contrato/[id]`

## Migración Wix → PostgreSQL (COMPLETADA — marzo 2026)

> **La migración está finalizada. La plataforma opera 100% sobre PostgreSQL. Wix ya no se usa como fuente de datos.**

### Resumen
En marzo 2026 se realizó la migración única de todos los datos históricos de Wix (base NoSQL) a PostgreSQL (Digital Ocean). Los scripts en `migration/` se usaron para esa migración y ya no se ejecutan. Se conservan como referencia histórica.

### Volumen migrado (marzo 2026)

| Tabla | Registros |
|---|---|
| PEOPLE | 9,747 |
| ACADEMICA | 5,413 |
| CALENDARIO | 19,971 |
| ACADEMICA_BOOKINGS | 114,366 |
| FINANCIEROS | 2,626 |
| ADVISORS | 45 |
| USUARIOS_ROLES (ESTUDIANTE) | 5,367 |

### Datos históricos con formato legacy
Los registros migrados de Wix dejaron columnas con nombres distintos a los actuales. El código mantiene compatibilidad via COALESCE (ver sección "Datos históricos Wix"). **No crear nuevos registros con el formato legacy.**

## OnHold System with Automatic Contract Extension

### Overview
The OnHold system allows administrators to temporarily pause a student without losing contract days. When a student is reactivated from OnHold, the system **automatically extends** their contract end date (`finalContrato`) by the number of days they were paused.

### Key Features
- **Temporary Pause**: Mark students as inactive for a specific period
- **Automatic Extension**: Contract `finalContrato` automatically extended by paused days when reactivated
- **Complete History**: Both `onHoldHistory` and `extensionHistory` track all operations
- **Transparent Tracking**: Extension reason clearly indicates it was automatic due to OnHold
- **Zero Data Loss**: Students never lose contract days due to pauses

### Architecture

#### Data Flow - Activating OnHold
```javascript
// User activates OnHold via StudentOnHold component
POST /api/postgres/students/onhold
{
  studentId: "abc123",
  setOnHold: true,
  fechaOnHold: "2025-07-01",
  fechaFinOnHold: "2025-07-31",
  motivo: "Vacaciones"
}

// contractService.activateOnHold() updates PEOPLE table:
{
  estadoInactivo: true,
  fechaOnHold: "2025-07-01",
  fechaFinOnHold: "2025-07-31",
  onHoldCount: 1,
  onHoldHistory: [{
    fechaActivacion: "2025-07-01T10:00:00Z",
    fechaOnHold: "2025-07-01",
    fechaFinOnHold: "2025-07-31",
    motivo: "Vacaciones",
    activadoPor: "Admin"
  }]
}
```

#### Data Flow - Deactivating OnHold (Automatic Extension)
```javascript
// User deactivates OnHold via StudentOnHold component
POST /api/postgres/students/onhold
{
  studentId: "abc123",
  setOnHold: false
}

// contractService.deactivateOnHold():
// 1. Calculates paused days: 30 days
// 2. Extends finalContrato: 2025-12-31 → 2026-01-30 (+30 days)
// 3. Creates extension history entry
// 4. Clears OnHold fields

// Updated PEOPLE record:
{
  estadoInactivo: false,
  fechaOnHold: null,
  fechaFinOnHold: null,
  finalContrato: "2026-01-30",  // ← Extended automatically
  vigencia: 395,                 // ← Recalculated
  extensionCount: 1,             // ← Incremented
  extensionHistory: [{           // ← Auto-extension entry
    numero: 1,
    fechaEjecucion: "2025-07-31T14:00:00Z",
    vigenciaAnterior: "2025-12-31",
    vigenciaNueva: "2026-01-30",
    diasExtendidos: 30,
    motivo: "Extensión automática por OnHold (30 días pausados desde 2025-07-01 hasta 2025-07-31)"
  }]
}
```

### Implementation Files

- **`src/services/contract.service.ts`**
  - `activateOnHold()`: Handles OnHold activation
  - `deactivateOnHold()`: Calculates paused days, extends `finalContrato`, creates `extensionHistory` entry
  - `extendByDays()`: Manual contract extension

- **`src/repositories/people.repository.ts`**
  - `activateOnHold()`, `deactivateOnHold()`, `extendContract()`: SQL queries for PEOPLE table updates

- **`src/app/api/postgres/students/onhold/route.ts`**
  - API route that delegates to `contractService`

- **`src/components/student/StudentOnHold.tsx`**
  - Modal to activate OnHold with date pickers
  - Shows OnHold status card
  - Displays OnHold history modal
  - Button to reactivate (triggers automatic extension)

- **`src/components/student/StudentContract.tsx`**
  - Shows extension counter and "Ver historial" link
  - Modal displays all extensions (manual + automatic)
  - Automatic extensions clearly labeled with OnHold motivo

### Data Schema

#### PEOPLE Table Fields
```typescript
interface Person {
  // OnHold fields
  estadoInactivo: boolean           // true = paused
  fechaOnHold: string | null        // Start date of current pause
  fechaFinOnHold: string | null     // End date of current pause
  onHoldCount: number               // Total times paused
  onHoldHistory: OnHoldHistoryEntry[]

  // Contract/Extension fields
  finalContrato: Date               // Contract end date (auto-extended on OnHold deactivation)
  vigencia: number                  // Days remaining (recalculated)
  extensionCount: number            // Total extensions (manual + automatic)
  extensionHistory: ExtensionHistoryEntry[]
}

interface OnHoldHistoryEntry {
  fechaActivacion: string    // When OnHold was activated
  fechaOnHold: string         // Pause start date
  fechaFinOnHold: string      // Pause end date
  motivo: string              // Reason for pause
  activadoPor: string         // Who activated it
}

interface ExtensionHistoryEntry {
  numero: number              // Extension number
  fechaEjecucion: string      // When extension was applied
  vigenciaAnterior: string    // Previous end date
  vigenciaNueva: string       // New end date
  diasExtendidos: number      // Days added
  motivo: string              // Reason (auto-extensions mention OnHold)
}
```

### Example Scenario

```
Student: Juan Pérez
Contract start: 2025-01-01
Contract end: 2025-12-31 (365 days)

┌─────────────────────────────────────┐
│ Step 1: Activate OnHold             │
│ Dates: 2025-07-01 to 2025-07-31    │
│ Duration: 30 days                   │
└─────────────────────────────────────┘
  ↓
  estadoInactivo: true
  finalContrato: 2025-12-31 (unchanged)
  onHoldCount: 1

┌─────────────────────────────────────┐
│ Step 2: Deactivate OnHold           │
│ Automatic Extension Triggered       │
└─────────────────────────────────────┘
  ↓
  estadoInactivo: false
  finalContrato: 2026-01-30 (extended +30 days)
  extensionCount: 1
  extensionHistory[0]:
    - diasExtendidos: 30
    - motivo: "Extensión automática por OnHold (30 días pausados...)"

Result: Student maintains full 365 days of contract
```

### Benefits

1. **Fairness**: Students don't lose contract days when paused
2. **Automatic**: No manual intervention needed from admins
3. **Traceable**: All extensions logged in `extensionHistory`
4. **Transparent**: Extension reason clearly indicates OnHold origin
5. **Consistent**: Uses same structure as manual extensions

### Testing

After changes:
1. Activate OnHold on a test student (e.g., 10 days)
2. Verify `onHoldCount` incremented
3. Deactivate OnHold
4. Verify `finalContrato` extended by 10 days
5. Verify `extensionCount` incremented
6. Check `extensionHistory` contains entry with OnHold motivo
7. View extension history in frontend modal

## Permissions System (RBAC - Role-Based Access Control)

### Overview
The application implements a comprehensive RBAC system that loads permissions dynamically from PostgreSQL. All permission checks are synchronized across:
- **Middleware** (route access control)
- **Frontend UI** (menu visibility and component rendering)
- **API endpoints** (server-side permission verification)

### Architecture

#### 1. PostgreSQL as Source of Truth
- **Table**: `ROL_PERMISOS` in PostgreSQL
- **Structure**: Each role has a JSONB array of permission strings
- **API Endpoints**: `/api/postgres/roles` (all roles), `/api/postgres/roles/[rol]/permissions` (by role)
- **Repository**: `src/repositories/roles.repository.ts`

#### 2. Permission Format
Permissions follow a hierarchical dot notation:
- `MODULE.SUBMODULE.ACTION`
- Examples:
  - `ACADEMICO.AGENDA.VER_CALENDARIO`
  - `SERVICIO.WELCOME.CARGAR_EVENTOS`
  - `COMERCIAL.CONTRATO.MODIFICAR`

#### 3. Available Roles (9 total)
1. `SUPER_ADMIN` - 41 permissions (full system access)
2. `ADMIN` - 40 permissions (all except delete persons)
3. `ADVISOR` - 16 permissions (academic + welcome sessions)
4. `COMERCIAL` - 21 permissions (commercial + approvals)
5. `APROBADOR` - 12 permissions (approval workflows)
6. `TALERO` - 1 permission (advisor list view only)
7. `FINANCIERO` - 4 permissions (financial queries)
8. `SERVICIO` - 9 permissions (service management)
9. `READONLY` - 2 permissions (view-only access)

### Implementation Components

#### 1. TypeScript Permission Enums
**File**: `src/types/permissions.ts`

Defines all permission constants synchronized with PostgreSQL `ROL_PERMISOS`:
```typescript
export enum AcademicoPermission {
  VER_CALENDARIO = 'ACADEMICO.AGENDA.VER_CALENDARIO',
  LISTA_ADVISORS_VER = 'ACADEMICO.ADVISOR.LISTA_VER',
  // ... etc
}

export enum ServicioPermission {
  WELCOME_CARGAR_EVENTOS = 'SERVICIO.WELCOME.CARGAR_EVENTOS',
  // ... etc
}
```

**Important**: These enums MUST match exactly with the permission strings in PostgreSQL `ROL_PERMISOS` table.

#### 2. Middleware Permission System
**File**: `src/lib/middleware-permissions.ts`

Core functions:
- `getPermissionsForRole(role)`: Loads permissions from PostgreSQL with 5-minute cache
- `hasAccessToRoute(pathname, userPermissions)`: Verifies route access
- `ROUTE_PERMISSIONS`: Maps specific routes to required permissions
- `GENERIC_ROUTE_ACCESS`: Maps parent routes to any child permission

**File**: `src/middleware.ts`

Middleware flow:
1. Check if user is authenticated
2. SUPER_ADMIN/ADMIN get full access
3. For other roles: Load permissions from PostgreSQL (cached)
4. Verify if user has ANY of the required permissions for the route
5. Allow or deny access

**Example logs**:
```
🔐 [Middleware] Verificando permisos para TALERO → /dashboard/academic/advisors
📋 [Middleware] Permisos de TALERO: 1 permisos
  🔍 Ruta específica /dashboard/academic/advisors: ✅
✅ [Middleware] Access granted
```

#### 3. Frontend Permission Hooks
**File**: `src/hooks/usePermissions.ts`

React hook that loads user permissions asynchronously:
```typescript
const {
  userPermissions,      // Array of user's permissions
  hasPermission,        // Check single permission
  hasAnyPermission,     // Check if has any of array
  hasAllPermissions,    // Check if has all of array
  isLoading,           // Loading state
  permissionsSource    // 'postgres' or 'fallback'
} = usePermissions();
```

**Usage in components with PermissionGuard**:
```typescript
// Hides element completely if user lacks permission (default behavior)
<PermissionGuard permission={AcademicoPermission.CREAR_EVENTO}>
  <button>Crear Evento</button>
</PermissionGuard>

// Show fallback message if no permission (optional)
<PermissionGuard
  permission={PersonPermission.CAMBIAR_ESTADO}
  showDefaultMessage={true}
>
  <button>Cambiar Estado</button>
</PermissionGuard>
```

**PermissionGuard Component** (`src/components/permissions/PermissionGuard.tsx`):
- Default behavior: **Hides elements** when user lacks permission (`showDefaultMessage={false}`)
- Optional fallback: Show "No tienes permisos para usar esta sección" message with `showDefaultMessage={true}`
- Supports single permission, all permissions (`allPermissions`), or any permissions (`anyPermissions`)
- Returns `null` during loading state

**Recent Permission Implementations** (October 2025):

1. **Modal "Detalles de la Clase"** ([StudentAcademic.tsx](src/components/student/StudentAcademic.tsx)):
   - Sección "Evaluación": Solo visible con `STUDENT.ACADEMIA.EVALUACION`
   - Sección "Anotación Advisor": Solo visible con `STUDENT.ACADEMIA.ANOTACION_ADVISOR`
   - Sección "Comentarios Estudiante": Solo visible con `STUDENT.ACADEMIA.COMENTARIOS_ESTUDIANTE`
   - Botón "Eliminar Evento": Solo visible con `STUDENT.ACADEMIA.ELIMINAR_EVENTO`
   - Botón "Guardar Cambios": Solo visible si tiene al menos uno de los permisos de edición

2. **Botón "Gestión de Steps"** ([StudentTabs.tsx](src/components/student/StudentTabs.tsx)):
   - Solo visible para usuarios con `STUDENT.ACADEMIA.MARCAR_STEP` O `STUDENT.ACADEMIA.ASIGNAR_STEP`
   - Utiliza `hasAnyPermission()` para verificar múltiples permisos

3. **Endpoint /sesion/[id]** ([sesion/[id]/page.tsx](src/app/sesion/[id]/page.tsx)):
   - Protegido con permiso específico `ACADEMICO.SESION.IR_A_SESION` ("Ir a la Sesión")
   - Permite gestionar sesión específica: tomar asistencia, evaluar, agregar comentarios
   - Corrige el uso previo incorrecto de `ACADEMICO.AGENDA.CALENDARIO_VER`

#### 4. Dashboard Menu Filtering
**File**: `src/components/layout/DashboardLayout.tsx`

The sidebar menu dynamically shows/hides sections based on user permissions:
- Loads permissions via `usePermissions()` hook
- Filters top-level sections (Académico, Servicio, Comercial, Aprobación)
- Filters sub-menu items (children) based on page-specific permissions
- Real-time updates when permissions change
- "Permisos" link opens in new tab (`target="_blank"` with `rel="noopener noreferrer"`)

**Example**: TALERO user will see:
- ✅ Académico section (has `ACADEMICO.ADVISOR.LISTA_VER`)
  - ✅ Advisors (visible and clickable)
  - ❌ Agenda Sesiones (hidden)
  - ❌ Agenda Académica (hidden)
- ❌ Servicio (hidden - no SERVICIO permissions)
- ❌ Comercial (hidden)
- ❌ Aprobación (hidden)

#### 5. API Route Protection
**File**: `src/app/api/permissions/route.ts`

API endpoints can verify permissions server-side:
```typescript
const session = await getServerSession(authOptions);
const userRole = session.user.role;

// Check if user has required permission
if (!hasPermission(userRole, RequiredPermission)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### Permission Management

#### Viewing All Permissions
**Endpoint**: `/admin/permissions`
- Only accessible by SUPER_ADMIN and ADMIN
- Opens in a new browser tab when accessed from sidebar menu
- Shows complete permission matrix for all roles grouped by module
- Each module section has distinct color coding (purple for TITULAR, blue for BENEFICIARIO, etc.)
- "Select All" checkbox per module for bulk permission assignment
- Loads data directly from PostgreSQL ROL_PERMISOS table
- Source indicator shows if data is from 'postgres' or 'fallback'
- "Volver al Dashboard" button returns to `/` (root/homepage)

#### Modifying Permissions
1. **Via Admin UI** (Recommended):
   - Use `/admin/permissions` interface
   - Changes take effect within 5 minutes (cache TTL)

2. **Via API**:
   ```typescript
   // Update permissions for a role
   PUT /api/postgres/roles/TALERO/permissions
   {
     "permisos": ["ACADEMICO.ADVISOR.LISTA_VER", "NEW.PERMISSION"]
   }
   ```

#### Creating New Roles
```typescript
POST /api/postgres/roles
{
  "rol": "NEW_ROLE",
  "descripcion": "Role description",
  "permisos": ["PERMISSION.ONE", "PERMISSION.TWO"],
  "activo": true
}
```

### Cache Management

#### Middleware Cache (Server-side)
- **Location**: In-memory Map in `src/lib/middleware-permissions.ts`
- **TTL**: 5 minutes
- **Scope**: Per-role caching
- **Invalidation**: Automatic after TTL, or manual via `invalidatePermissionsCache()`

#### Frontend Cache (Client-side)
- **Location**: React state in `usePermissions` hook
- **Lifetime**: Session-based (until page refresh or logout)
- **Refresh**: On user role change or manual reload

### Troubleshooting Permissions

#### User Can't Access a Route
1. Check user's role in PostgreSQL `USUARIOS_ROLES` table
2. Check role's permissions in PostgreSQL `ROL_PERMISOS` table
3. Check middleware logs for permission verification:
   ```
   🔐 [Middleware] Verificando permisos para ROLE → /path
   📋 [Middleware] Permisos de ROLE: X permisos
   ```
4. Verify route is mapped in `ROUTE_PERMISSIONS` or `GENERIC_ROUTE_ACCESS`

#### Menu Items Not Showing
1. Check browser console for permission logs:
   ```
   🔄 Cargando permisos para rol: ROLE
   ✅ Permisos cargados desde wix: X
   📋 Lista de permisos: [...]
   ```
2. Verify `permissionsSource: 'postgres'` (not 'fallback')
3. Check `DashboardLayout` logs for menu filtering:
   ```
   Académico: ✅
   Servicio: ❌
   ```

#### Permissions Not Updating
1. Wait 5 minutes for cache to expire
2. Force logout and login again
3. Check if changes were saved in PostgreSQL ROL_PERMISOS
4. Verify Digital Ocean deployment completed successfully

### Adding New Permissions

#### Step 1: Add to PostgreSQL
Add permission string to `ROL_PERMISOS` table for desired roles.

#### Step 2: Add to TypeScript Enum
Update `src/types/permissions.ts`:
```typescript
export enum NewModulePermission {
  NEW_ACTION = 'MODULE.SUBMODULE.NEW_ACTION',
}
```

#### Step 3: Map Route (if needed)
Update `src/lib/middleware-permissions.ts`:
```typescript
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/new/route': [
    NewModulePermission.NEW_ACTION as Permission,
  ],
};
```

#### Step 4: Use in Components
```typescript
<PermissionGate permission={NewModulePermission.NEW_ACTION}>
  <NewFeature />
</PermissionGate>
```

## Actividades Complementarias (AI Quiz)

### Overview
Students who have 1 successful session on a normal step (need 2) can take an AI-generated quiz to substitute the missing session. Uses OpenAI gpt-4o-mini to generate and grade questions based on `NIVELES.contenido`.

### Rules
- **Eligibility**: 1 exitosa session on a non-jump step, not already completed, no override, **AND no successful session this week (Mon-Sun)** for that step
- **Week restriction**: If the student attended a successful session for that step during the current week (Monday to Sunday), complementaria is NOT offered. This prevents students from evading regular sessions when they still have time to book another one that week.
- **Questions**: 10 per attempt (4 multiple choice, 1 true/false, 2 open-ended, 2 multiple choice, 1 any)
- **Pass threshold**: ≥50%
- **Max attempts**: 3 persistent attempts per step (stored in `COMPLEMENTARIA_ATTEMPTS` table)
- **On pass**: Creates `ACADEMICA_BOOKINGS` record with `tipo=COMPLEMENTARIA` (counts as SESSION in `getClassType()`) and triggers `autoAdvanceStep()`

### Implementation Files
- **Service**: `src/services/complementaria.service.ts` (eligibility, generateQuestions, gradeAnswers)
- **Repository**: `src/repositories/complementaria.repository.ts` (COMPLEMENTARIA_ATTEMPTS table)
- **API Routes**: `src/app/api/postgres/panel-estudiante/complementaria/` (eligibility, generate, grade, attempts)
- **Hook**: `src/hooks/use-complementaria.ts`
- **Page**: `src/app/panel-estudiante/actividades-complementarias/page.tsx`
- **Progress integration**: `src/services/progress.service.ts` adds `complementariaEligible` flag per step
- **UI links**: ProgressReport.tsx (student panel, clickable "actividad complementaria" in diagnostic), StudentProgress.tsx (admin, "Elegible Complementaria" badge)

### Content Source
Questions are generated from `NIVELES.contenido` field (TEXT, markdown format with lesson objectives, vocabulary, grammar points, and evaluation criteria). Truncated to 4000 chars for the OpenAI prompt.

## Auto-Avance de Steps (autoAdvanceStep)

### Descripción
`autoAdvanceStep(bookingId)` en `src/services/student.service.ts` avanza automáticamente el step del estudiante cuando completa el step actual. Se llama tras guardar asistencia o evaluación.

### Reglas
- Solo avanza si el booking es del **step actual** del estudiante en ACADEMICA (`student.step === bookingStep`)
- Avanza **un step a la vez** — no puede recuperar steps saltados
- WELCOME → BN1 Step 1: se dispara con cualquier asistencia marcada
- Steps normales: verifica `isCurrentStepComplete()` antes de avanzar
- ESS: ignorado (nunca avanza)
- Overrides manuales tienen prioridad absoluta

### Endpoints que disparan autoAdvanceStep
| Endpoint | Dispara auto-advance |
|---|---|
| `POST /api/postgres/academic/attendance` | ✅ Sí (cuando `asistio=true`) |
| `PUT /api/postgres/academic/attendance` (bulk) | ✅ Sí (por cada booking con `asistio=true`) |
| `PUT/POST /api/postgres/academic/evaluation` | ✅ Sí |
| `POST /api/postgres/academic-record` | ✅ Sí |
| `PUT /api/postgres/academic/[id]` | ✅ Sí (cuando `asistio=true` o `asistencia=true`) — modal Detalles de la Clase del panel admin |
| Complementaria (al aprobar quiz) | ✅ Sí |

### Problema conocido: estudiantes "pegados"
Si un advisor marca asistencia por un medio que no disparaba `autoAdvanceStep` (antes del fix de marzo 2026), el estudiante queda en un step anterior al real. Como el auto-advance valida `student.step === bookingStep`, los steps siguientes nunca disparan el avance.

**Solución para estudiantes pegados**: cambiar manualmente el step vía "Cambiar Step" en el panel de administración (Tab Académica del estudiante).

## Contract Inactivation Rules

### Inactivation Sync Across Tables
All inactivation/reactivation flows update **3 tables** in sync:
- **PEOPLE** → `estadoInactivo` (primary status)
- **ACADEMICA** → `estadoInactivo` (matched by `numeroId`)
- **USUARIOS_ROLES** → `activo` (matched by `email`, controls login access)

### By Admin Toggle (PersonAdmin)
When an admin toggles the contract status via the Estado del Contrato toggle in `/person/[id]`:
- Calls `POST /api/postgres/students/{id}/toggle-status` sequentially for titular + all beneficiaries
- `toggleStatus()` in `student.service.ts` updates PEOPLE, ACADEMICA, and USUARIOS_ROLES
- Implementation: `src/components/person/PersonAdmin.tsx`, `src/services/student.service.ts`

### By Admin Estado Change
When a titular's estado is changed to **Contrato nulo**, **Devuelto**, or **Rechazado** via `PATCH /api/postgres/people/[id]`:
- The titular is marked as `estadoInactivo = true`
- All beneficiaries of the same contract are marked as `estadoInactivo = true`
- Implementation: `src/app/api/postgres/people/[id]/route.ts` (PATCH handler)

### By OnHold Activation/Deactivation
- **Activate OnHold**: Sets `USUARIOS_ROLES.activo = false` (blocks login)
- **Deactivate OnHold**: Sets `USUARIOS_ROLES.activo = true` (restores login)
- Implementation: `src/services/contract.service.ts` (`activateOnHold`, `deactivateOnHold`)

### By Student Login (Contract Expiration)
**Expiration rule** (centralized in [`src/lib/contract-expiry.ts`](src/lib/contract-expiry.ts)): a contract with `finalContrato = D` is considered expired only when the server's UTC date is **at least 2 calendar days after `D`** (i.e. fecha pura + 1 día de gracia). This guarantees that no user — Chile, Colombia, Ecuador, Perú, España, Australia, etc. — is blocked while the last day is still ongoing in their local clock. `PEOPLE.finalContrato` is now stored as `DATE` (no time, no TZ).

Two enforcement points (both use the same helper):

1. **Login** (`auth-postgres.ts`): if `USUARIOS_ROLES.activo=false` AND the contract is past the grace window → throws `EXPIRED`. Defense in depth: if `activo=true` but the contract is past the grace window AND the role is `ESTUDIANTE` → also throws `EXPIRED`. This catches the desynced case where the cron/panel hasn't run yet.
2. **Panel load** (`resolveStudentFromSession`): if `isContractExpired(finalContrato)` is true and the student is not already inactive, runs the full inactivation cascade:
   - PEOPLE: this student + ALL contract members → `estadoInactivo = true`, `aprobacion = 'FINALIZADA'`
   - ACADEMICA: this student + all beneficiarios of the contract → `estadoInactivo = true`
   - USUARIOS_ROLES: this student + all contract members → `activo = false` (blocks login)

The cron `expire-contracts` and the special-nivel `MASTER/IELTS/B2FIRST/TOEFL → DONE` auto-promotion also use the same helper (`CONTRACT_EXPIRED_SQL` in SQL, `isContractExpired` in JS) so the rule is identical everywhere.

### By Student Login (OnHold Auto-Reactivation)
When a student with role ESTUDIANTE loads the panel (`resolveStudentFromSession`):
- If `fechaFinOnHold < today` and student is currently on hold (estadoInactivo + fechaOnHold set):
  - Calculates paused days (`fechaFinOnHold - fechaOnHold`)
  - Extends `finalContrato` by paused days
  - Creates `extensionHistory` entry with motivo "Extensión automática por OnHold"
  - Clears `fechaOnHold`, `fechaFinOnHold`, sets `estadoInactivo = false`
  - Sets `USUARIOS_ROLES.activo = true` (restores login)
- This mirrors `contractService.deactivateOnHold()` but triggered automatically at login
- Implementation: `src/services/panel-estudiante.service.ts` (resolveStudentFromSession)

### By Cron Job
- Daily at 04:00 UTC (11:00 PM Colombia), the cron job checks all contracts and marks expired ones as FINALIZADA + inactive
- Reactivation of OnHold runs daily at 03:00 UTC (10:00 PM Colombia)
- **Schedule source of truth**: `scripts/cron-worker.js` (node-cron daemon desplegado como Worker en Digital Ocean vía `.do/app.yaml`). Los horarios reales son 03:00 UTC (`reactivate-onhold`) y 04:00 UTC (`expire-contracts`)
- Implementation: `src/app/api/cron/expire-contracts/route.ts`

## Consent System (Consentimiento Declarativo - Firma Digital)

### Overview
The consent system allows customers to digitally sign their contract via OTP verification. The customer receives their contract via WhatsApp, views it on a public page, verifies their identity with their document number, receives a 6-digit OTP via WhatsApp, and signs. Alternatively, an admin can auto-approve the consent without OTP.

### Architecture

#### Public Contract Page (`/contrato/[id]`)
- **Page**: `src/app/contrato/[id]/page.tsx`
- **States**: LOADING → ERROR | HAS_CONSENT | DOCUMENT_ENTRY → OTP_ENTRY → VERIFIED
- Public page (no auth required, excluded from middleware)
- Shows rendered contract template with all data filled in
- If already signed: shows consent badge with timestamp, document, and hash

#### Admin Contract Detail Page (`/dashboard/comercial/contrato/[id]`)
- **Page**: `src/app/dashboard/comercial/contrato/[id]/page.tsx`
- Full editable view of contract (titular, references, beneficiarios, financial)
- Inline editing per section with save button
- Contract preview modal with template
- "Enviar PDF" button: generates PDF via API2PDF + sends via WhatsApp
- "Auto-aprobar Consentimiento" button: bypasses OTP
- **Smart polling**: After sending WhatsApp, polls consent status every 15s for 10 min
- Auto-updates contract preview when customer signs

#### Data Flow
```
Admin sends PDF via WhatsApp
    → Customer opens /contrato/{titularId}
    → Customer enters document number (identity verification)
    → System sends 6-digit OTP to customer's WhatsApp
    → Customer enters OTP
    → System verifies OTP + creates consent JSON
    → SHA-256 hash computed
    → Saved to PEOPLE (consentimientoDeclarativo, hashConsentimiento)
    → Admin page auto-detects signature via polling
```

### Implementation Files
- **`src/services/consent.service.ts`**: Business logic (sendConsentOtp, verifyAndSaveConsent, autoApproveConsent, getConsentStatus)
- **`src/lib/otp-store.ts`**: In-memory OTP storage (generateOtp, saveOtp, verifyOtp, 10-min TTL)
- **`src/lib/whatsapp.ts`**: WhatsApp messaging (formatPhoneNumber, sendWhatsAppMessage)
- **`src/lib/contract-template-filler.ts`**: Template filling with {{placeholders}} (client-safe)
- **API Routes** (`src/app/api/consent/[id]/`):
  - `contract-data/route.ts` - GET: Load titular, beneficiarios, financial, template
  - `status/route.ts` - GET: Check if consent exists
  - `send-otp/route.ts` - POST: Validate document + send OTP via WhatsApp
  - `verify/route.ts` - POST: Verify OTP + save consent with hash
  - `auto-approve/route.ts` - POST: Admin auto-approval without OTP
- **`src/app/api/contracts/[id]/send-pdf/route.ts`**: Generate PDF via API2PDF + send via WhatsApp

### Consent Data Structure
```typescript
interface ConsentData {
  aceptado: true
  timestampAcceptacion: string     // ISO date
  ipAddress: string
  userAgent: string
  numeroDocumento: string          // Verified document number
  celularVerificado: string        // Phone that received OTP
  tipoAprobacion: 'OTP' | 'AUTOMATICA'
  aprobadoPor?: string             // Admin email (only for AUTOMATICA)
}
// Stored as JSONB in PEOPLE.consentimientoDeclarativo
// SHA-256 hash stored in PEOPLE.hashConsentimiento
```

## Ejemplo de flujo completo: "Ver perfil del estudiante"

| Paso | Capa | Archivo | Qué hace |
|------|------|---------|----------|
| 1 | **Hook** | `use-student.ts` → `useStudentProfile(id)` | Hace fetch a `/api/postgres/students/{id}`, maneja cache con React Query |
| 2 | **Ruta** | `postgres/students/[id]/route.ts` | `handlerWithAuth()` recibe, llama `studentService.getProfile(id)` |
| 3 | **Servicio** | `student.service.ts` → `getProfile()` | Busca en ACADEMICA, si no encuentra busca en PEOPLE, combina datos |
| 4 | **Repositorio** | `academica.repository.ts` | `SELECT * FROM "ACADEMICA" WHERE _id = $1` |
| 5 | **Repositorio** | `people.repository.ts` | `SELECT * FROM "PEOPLE" WHERE _id = $1` |
| 6 | Respuesta sube de vuelta hasta el componente React |

## Development Notes

### Known Working Configurations
- Node.js 18+ required (project uses v24.13.0 via nvm)
- Next.js 14 with App Router
- TypeScript with `es2017` target
- TailwindCSS for styling
- React Query v3 (`'react-query'`, NOT `@tanstack/react-query`)
- react-hot-toast for notifications
- @heroicons/react for icons
- react-hook-form with custom zodResolver

### Troubleshooting Tips
1. If build fails with TypeScript errors, check `tsconfig.json` excludes
2. If authentication fails, verify environment variables are set correctly
3. If caching doesn't work, check localStorage permissions in browser
4. If server-side API calls fail, verify `NEXTAUTH_URL` is set for production
5. If WhatsApp messages fail, check WHAPI_TOKEN and phone number format
6. If OTP verification fails, remember OTPs are in-memory and lost on server restart
7. If PDF generation fails, check API2PDF_KEY and ensure public contract page loads correctly

### Security Considerations
- All SQL uses parameterized queries ($1, $2, ...) to prevent injection
- All API routes proxy through the application (no direct DB access from frontend)
- JWT tokens expire based on NextAuth configuration
- No sensitive data logged in production builds
- OTP codes are 6-digit, one-time use, 10-minute TTL
- Consent hashed with SHA-256 for tamper detection
- Cron jobs require CRON_SECRET header for authentication

**⚠️ Pendientes abiertos** (detectados ago-2026, sin corregir):
- 🔴 **`GET /api/contracts/[id]/download-pdf` no tiene autenticación** — con solo un `PEOPLE._id` cualquiera descarga el contrato completo (nombre, documento, domicilio, condiciones financieras). Verificado en producción: responde `307` sin sesión. Es intencional de origen (*"Público (se abre con window.open desde el panel)"*) y el middleware no lo cubre porque su matcher **excluye `/api`**. Al corregirlo, la forma que además habilita el uso con Twilio es un token HMAC **en la ruta, no en la query**: `/api/contracts/{id}/{token}/contrato.pdf` (patrón de [reset-token.ts](src/lib/reset-token.ts)).
- 🔴 **Tokens de Whapi en git** (dos, en 5 archivos incl. `src/backend/FUNCIONES WIX/`) — pendiente rotarlos y moverlos a `WHAPI_TOKEN`.
- 🟠 **`POST /api/wix/sendWhatsApp` acepta `toNumber` + `messageBody` arbitrarios** validando solo sesión — cualquier usuario autenticado puede enviar cualquier texto a cualquier número desde el WhatsApp corporativo.
- 🟠 **Credenciales de Twilio en texto plano** en el spec de DO (no como `SECRET`).
- 🟡 `POST /api/auth/forgot-password/check-email` permite **enumerar usuarios** (dice si un email existe).

### Pages and Routes Summary (25 pages)
| Page | Route | Access |
|---|---|---|
| Login | `/login` | Public |
| Dashboard | `/` | Authenticated |
| Agenda Sesiones | `/dashboard/academic/agenda-sesiones` | ACADEMICO permissions |
| Agenda Académica | `/dashboard/academic/agenda-academica` | ACADEMICO permissions |
| Advisors | `/dashboard/academic/advisors` | ACADEMICO.ADVISOR permissions |
| Asistencia - Sesiones & Jumps | `/dashboard/informes/asistencia/sesiones-clubes` | INFORMES.ASISTENCIA |
| Asistencia - Clubes (Training + Clubs) | `/dashboard/informes/asistencia/clubes` | INFORMES.ASISTENCIA |
| Asistencia - Complementarias | `/dashboard/informes/asistencia/complementarias` | INFORMES.ASISTENCIA |
| Asistencia - Welcome Session | `/dashboard/informes/asistencia/welcome-session` | INFORMES.ASISTENCIA |
| Asistencia - X País | `/dashboard/informes/asistencia/x-pais` | INFORMES.ASISTENCIA |
| Programación - Sesiones | `/dashboard/informes/sesiones/programadas` | INFORMES.PROGRAMACION |
| Programación - Clubes | `/dashboard/informes/sesiones/clubes` | INFORMES.PROGRAMACION |
| Programación - Welcome | `/dashboard/informes/sesiones/welcome` | INFORMES.PROGRAMACION |
| Advisors - Sesiones | `/dashboard/informes/advisors/sesiones` | INFORMES.ADVISORS |
| Advisors - Jumps | `/dashboard/informes/advisors/jumps` | INFORMES.ADVISORS |
| Advisors - Training | `/dashboard/informes/advisors/training` | INFORMES.ADVISORS |
| Advisors - Clubes | `/dashboard/informes/advisors/clubes` | INFORMES.ADVISORS |
| Advisors - Welcome | `/dashboard/informes/advisors/welcome` | INFORMES.ADVISORS |
| Advisors - Resumen | `/dashboard/informes/advisors/resumen` | INFORMES.ADVISORS |
| Académica - Horas Advisor | `/dashboard/informes/academica/horas-advisor` | INFORMES.ACADEMICA.HORAS_ADVISOR |
| Académica - Hold & Vigencias | `/dashboard/informes/academica/hold-vigencias` | INFORMES.ACADEMICA.HOLD_VIGENCIAS |
| Académica - X Niveles | `/dashboard/informes/academica/x-niveles` | INFORMES.ACADEMICA.X_NIVELES |
| Académica - Usuarios | `/dashboard/informes/usuarios` | INFORMES.USUARIOS |
| Académica - InfoAcademic User | `/dashboard/informes/infoacademic-user` | INFORMES.USUARIOS |
| Contratos | `/dashboard/informes/contratos` | INFORMES.CONTRATOS |
| Contratos - Matrículas | `/dashboard/informes/contratos/matriculas` | INFORMES.CONTRATOS.MATRICULAS |
| Planta - Advisors | `/dashboard/informes/planta/advisors` | INFORMES.PLANTA |
| Planta - Administrativos | `/dashboard/informes/planta/administrativos` | INFORMES.PLANTA |
| Estadísticas - Niveles | `/dashboard/informes/estadisticas` | INFORMES.ESTADISTICAS |
| Estadísticas - Horarios | `/dashboard/informes/estadisticas/horarios` | INFORMES.ESTADISTICAS |
| Welcome Session | `/dashboard/servicio/welcome-session` | SERVICIO permissions |
| Servicio Main | `/dashboard/servicio` | SERVICIO permissions |
| Lista Sesiones | `/dashboard/servicio/lista-sesiones` | SERVICIO permissions |
| Sin Registro | `/dashboard/servicio/sin-registro` | SERVICIO permissions |
| Cancelación sin reemplazo | `/dashboard/servicio/cancelacion-sin-reemplazo` | SERVICIO.CANCELACION_SIN_REEMPLAZO.VER |
| Exam. Intern. — IELTS | `/dashboard/servicio/exam-intern/ielts` | SERVICIO.EXAM_INTERN.IELTS_VER |
| Exam. Intern. — B2 First (stub) | `/dashboard/servicio/exam-intern/b2first` | SERVICIO.EXAM_INTERN.B2F_VER |
| Exam. Intern. — TOEFL (stub) | `/dashboard/servicio/exam-intern/toefl` | SERVICIO.EXAM_INTERN.TOEFL_VER |
| Crear Contrato | `/dashboard/comercial/crear-contrato` | COMERCIAL permissions |
| Contrato Detail (admin) | `/dashboard/comercial/contrato/[id]` | COMERCIAL permissions |
| Prospectos | `/dashboard/comercial/prospectos` | COMERCIAL permissions |
| Aprobación | `/dashboard/aprobacion` | APROBACION permissions |
| Permisos Admin | `/admin/permissions` | SUPER_ADMIN/ADMIN only |
| Consulta de Scripts | `/admin/scripts/consulta` | MANTENIMIENTO.SCRIPTS.CONSULTA |
| Ticker Editor | `/admin/ticker` | SUPER_ADMIN only |
| Banner Editor | `/admin/banner` | SUPER_ADMIN only |
| Student Detail | `/student/[id]` | Authenticated |
| Person Detail | `/person/[id]` | Authenticated |
| Session Detail | `/sesion/[id]` | ACADEMICO.SESION permissions |
| Advisor Detail | `/advisor/[id]` | Authenticated |
| Contrato Público | `/contrato/[id]` | **Public** (no auth) |
| Nuevo Advisor | `/nuevo-advisor` | **Public** (no auth) |
| Panel Advisor | `/panel-advisor` | ADVISOR role |
| Actualización de Datos | `/advisor-setup` | ADVISOR role (solo si `perfilActualizado IS NULL`) |
| Panel Estudiante | `/panel-estudiante` | ESTUDIANTE role |
| Actividad Complementaria | `/panel-estudiante/actividades-complementarias` | ESTUDIANTE role |
| Subir Lote | `/subir-lote` | SUPER_ADMIN only |
| DB Viewer | `/dblgs` | SUPER_ADMIN/ADMIN only |

## ESS (Essential) — Nivel de Inicio

### Overview
ESS es el **nivel principal de inicio** que se asigna a estudiantes nuevos antes de ingresar a BN1. No es un nivel paralelo. El estudiante queda en `nivel='ESS'`, `step='Step 0'` durante 30 días; al cumplirlos, la plataforma lo promueve automáticamente a `nivel='BN1'`, `step='Step 1'`.

### Características Principales
- **Nivel principal**: `nivel='ESS'`, `step='Step 0'` — ocupa el campo `nivel`, no `nivelParalelo`
- **`esParalelo=false`** en NIVELES: ESS se trata igual que BN1, BN2, etc. desde el sistema de asignación
- **Auto-promoción**: Después de 30 días (`fechaInicioESS`), `resolveStudentFromSession` promueve automáticamente a BN1 Step 1
- **Excluido del diagnóstico "¿Cómo voy?"**: Al igual que WELCOME, ESS no aparece en el reporte de steps

### Estructura de Datos

#### NIVELES (PostgreSQL)
```javascript
{
  code: "ESS",          // Código del nivel
  step: "Step 0",       // Step único para ESS
  esParalelo: false,    // NO es nivel paralelo — es nivel principal
  description: "Essential",
  material: [...],
  clubs: [...],
  contenido: "..."
}
```

#### ACADEMICA (PostgreSQL) — estudiante en ESS
```javascript
{
  _id: "...",
  nivel: "ESS",          // Nivel actual (ESS es el nivel principal)
  step: "Step 0",        // Step de ESS
  fechaInicioESS: "2026-04-01T...",  // Fecha en que se asignó ESS — para auto-promoción
  nivelParalelo: null,   // No se usa para ESS
  stepParalelo: null,
  // ... otros campos
}
```

#### PEOPLE (PostgreSQL) — estudiante en ESS
```javascript
{
  _id: "...",
  nivel: "ESS",
  step: "Step 0",
  fechaInicioESS: "2026-04-01T...",
  nivelParalelo: null,
  stepParalelo: null,
  // ... otros campos
}
```

### Implementación

#### updateStudentStep (asignar ESS)
- **API**: `PUT /api/postgres/students/[id]/step`
- **Servicio**: `student.service.ts`
- **Repositorios**: `niveles.repository.ts`, `academica.repository.ts`, `people.repository.ts`
- Como `esParalelo=false`, actualiza `nivel` y `step` (igual que cualquier nivel normal)
- **Adicionalmente**: `academica.repository.updateStep` y `people.repository.updateStep` guardan `fechaInicioESS=NOW()` cuando `nivel === 'ESS'`

#### Auto-promoción ESS → BN1
- Se ejecuta en `resolveStudentFromSession` (`panel-estudiante.service.ts`) cada vez que el estudiante carga el panel
- Condición: `nivel === 'ESS'` (no `nivelParalelo`) + `NOW() - fechaInicioESS >= 30 días`
- Actualiza ACADEMICA: `nivel='BN1'`, `step='Step 1'`, `fechaInicioESS=NULL`
- Actualiza PEOPLE: mismos campos
- Constante: `ESS_DURATION_DAYS = 30`

#### Eventos ESS en el panel de reservas
- Cuando `nivel === 'ESS'`, los eventos ESS se marcan con `esESS: true`
- UI muestra borde naranja para distinguirlos
- El filtro de step/jump se omite para eventos ESS (el estudiante puede reservarlos libremente)

#### getStudentProgress (Diagnóstico "¿Cómo voy?")
- **API**: `GET /api/postgres/students/[id]/progress`
- **Servicio**: `progress.service.ts`
- **Repositorios**: `people.repository.ts`, `academica.repository.ts`, `niveles.repository.ts`
- Usa solo `nivel` (nivel principal) para generar el diagnóstico
- **EXCLUYE** explícitamente ESS y WELCOME del diagnóstico de steps
- Incluye todas las clases (incluyendo ESS) en estadísticas globales y "Clases por Tipo"
- **JOIN con CALENDARIO**: La query de clases usa `LEFT JOIN "CALENDARIO"` con `COALESCE(c."step", b."step")` para mostrar el step real del evento, no el step que tenía el estudiante al agendar

##### Lógica de completitud de Steps

**1. Normal Steps (1-4, 6-9, 11-14, etc.)**
- **Opción A**: 2 sesiones exitosas (tipo SESSION) + 1 TRAINING club exitoso del step
- **Opción B**: 1 sesión exitosa + 1 complementaria aprobada (tipo=COMPLEMENTARIA cuenta como SESSION) + 1 TRAINING club exitoso del step
- Solo clubs cuyo nombre empieza con `TRAINING -` cuentan. PRONUNCIATION, GRAMMAR, LISTENING y otros clubs NO satisfacen el requisito de club.
- Una clase es "exitosa" si `asistio === true` OR `asistencia === true` (Steps normales NO miran `participacion`)
- Mensajes diagnósticos según lo que falta:
  - `sesExitosas >= 2, trainingClubs === 0` → "Falta el TRAINING club del step"
  - `sesExitosas === 1, trainingClubs === 0` → "Falta una sesión y el TRAINING club"
  - `sesExitosas === 1, trainingClubs >= 1` → "Falta una sesión para terminar"
  - `sesExitosas === 0, trainingClubs >= 1` → "Faltan dos sesiones"
  - `sesExitosas === 0, trainingClubs === 0` → "Faltan dos sesiones y el TRAINING club"
- Si `complementariaEligible` es true, se agrega al mensaje: " Puedes realizar una actividad complementaria."
- **Archivos afectados**: `progress.service.ts` (`isTrainingClub()` helper, `trainingClubsExitosos`), `student.service.ts` (`isCurrentStepComplete`), `student-booking.service.ts` (`getEffectiveStepNumber`)

**2. Jump Steps (5, 10, 15, 20, 25, 30, 35, 40, 45) — múltiplos de 5**

**Regla de aprobación (estricta, AND)**: el Jump se aprueba cuando **AL MENOS UN booking** del step cumple **todas** estas condiciones simultáneamente:
- `asistio = true` (o `asistencia = true`)
- `participacion = true`
- `noAprobo !== true` (el advisor no marcó como reprobado)
- `cancelo !== true`

**Múltiples intentos**: si el estudiante reprueba el Jump (intento con `noAprobo=true`), se queda en el step y puede reagendarlo. **Cualquier intento posterior que cumpla las 4 condiciones aprueba el Jump** — los `noAprobo=true` previos NO bloquean intentos exitosos posteriores. La regla evalúa `bookings.some(aproboElJump)`, no `every`.

**Mensajes diagnósticos en orden de prioridad**:
- Cualquier booking aprobó (los 4 campos OK) → completado, sin mensaje
- `clasesDelStep.length === 0` → "Falta la clase del jump"
- Todas canceladas → "Canceló la clase del jump, debe reagendarla"
- Ninguna asistencia exitosa → "Falta asistir al jump"
- Asistió pero ninguna con `participacion=true` → "Falta marcar participación en el jump"
- Asistió y participó pero todos los intentos tienen `noAprobo=true` → "No aprobó el jump"

**Implementación**: helper `aproboElJump(c)` definido en `student.service.ts`, `progress.service.ts` y `student-booking.service.ts`. Steps normales usan la regla previa basada en `asistio || asistencia` (`participacion` NO cuenta para ellos).

**3. Overrides manuales**
- Tienen **prioridad absoluta** sobre toda la lógica
- `overrideCompletado === true` → completado sin importar clases
- `overrideCompletado === false` → incompleto, "Marcado como incompleto por administrador"
- Se almacenan en tabla `STEP_OVERRIDES` vía `StepOverridesRepository`
- **`studentId` en STEP_OVERRIDES = ACADEMICA `_id`** (no PEOPLE `_id`). El endpoint `step-override/route.ts` resuelve el ACADEMICA `_id` y verifica duplicados antes de guardar. `progress.service.ts` y `student-booking.service.ts` usan ACADEMICA `_id` para buscar overrides
- El badge **"✎ Override ✓"** (morado) o **"✎ Override ✗"** (naranja) aparece en ¿Cómo voy? (admin) cuando un step tiene override manual

**4. Completitud del nivel**
- Un nivel se considera completado cuando **todos sus steps** están completados

##### Inferencia de tipo de clase

El campo `tipo` en `ACADEMICA_BOOKINGS` es `null` en datos migrados de Wix. El tipo se infiere del nombre del step:

| Nombre del step en booking | Tipo inferido | Ejemplo |
|---|---|---|
| `"Step N"` | SESSION | `"Step 7"` |
| `"TRAINING - Step N"` | CLUB | `"TRAINING - Step 7"` |
| Otros prefijos (KARAOKE, PRONUNCIATION, LISTENING) | OTHER (no cuenta) | `"KARAOKE - Step 7"` |

Cuando `tipo` está poblado (eventos creados vía admin panel), se usa directamente.

##### Ordenamiento de steps

Los steps se ordenan **numéricamente** (no alfabéticamente), extrayendo el número del nombre:
- `extractStepNumber("Step 7")` → 7
- `extractStepNumber("TRAINING - Step 7")` → 7
- Esto evita que "Step 10" aparezca antes de "Step 6" (orden alfabético)

##### Estructura de niveles

| Nivel | Steps | Notas |
|---|---|---|
| WELCOME | WELCOME | 1 step (nombre "WELCOME", no "Step 0"), excluido del diagnóstico |
| BN1 | Steps 1-5 | Step 5 = Jump |
| BN2 | Steps 6-10 | Step 10 = Jump |
| BN3 | Steps 11-15 | Step 15 = Jump |
| ... | ... | Patrón continúa hasta F4 |
| ESS | Step 0 | Nivel de inicio (principal), excluido del diagnóstico, auto-promueve a BN1 Step 1 tras 30 días |
| DONE | Step 0 | Nivel final |

### TypeScript Types

**Archivo**: `src/types/index.ts`

```typescript
export interface Student {
  // ... otros campos
  nivel: string          // Nivel actual (WELCOME, ESS, BN1, BN2, etc.)
  step: string           // Step actual
  nivelParalelo?: string // No se usa para ESS (nullable)
  stepParalelo?: string  // No se usa para ESS (nullable)
}

export interface Person {
  // ... otros campos
  nivel?: string          // Nivel actual (opcional para titulares)
  step?: string           // Step actual (opcional para titulares)
  nivelParalelo?: string // Nullable
  stepParalelo?: string  // Nullable
}
```

### Flujo de Trabajo Típico

#### Estudiante nuevo entra en ESS
1. Admin asigna ESS: `Cambiar Step → ESS → Step 0`
2. Estado resultante: `nivel: "ESS"`, `step: "Step 0"`, `fechaInicioESS: NOW()`
3. Estudiante puede reservar eventos ESS en el panel (borde naranja)
4. Después de 30 días: al cargar el panel, `resolveStudentFromSession` detecta `nivel='ESS'` + `daysSince >= 30` → promueve a `nivel='BN1'`, `step='Step 1'`

#### Diagnóstico "¿Cómo voy?" para estudiante en ESS
- ESS es excluido del diagnóstico (igual que WELCOME)
- Panel muestra el nivel/step actual (ESS - Step 0) en el header
- No se genera tabla de steps para ESS

### Notas Importantes

- **ESS = nivel principal**: `nivel='ESS'`, no `nivelParalelo`. Los campos `nivelParalelo`/`stepParalelo` no se usan para ESS
- **`fechaInicioESS`** es nullable en ACADEMICA y PEOPLE; se llena con `NOW()` al asignar ESS y se borra al promover
- **Migración idempotente**: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "fechaInicioESS" TIMESTAMPTZ` corre una vez por arranque del servidor en `panel-estudiante.service.ts`
- **Jump Steps**: No aplican en ESS (solo tiene Step 0)

### ESS — Flujo completo

1. Admin asigna ESS desde panel: `Cambiar Step → ESS → Step 0`
2. `updateStep(nivel='ESS')` — como `esParalelo=false`, actualiza `nivel` y `step` (no `nivelParalelo`/`stepParalelo`); el `essClause` en repositorios guarda `fechaInicioESS=NOW()`
3. Estudiante puede reservar eventos ESS en el panel (borde naranja, filtro step omitido porque `esESS=true`)
4. Al cargar el panel (`resolveStudentFromSession`): si `nivel='ESS'` y `NOW() - fechaInicioESS >= 30 días` → actualiza ACADEMICA y PEOPLE con `nivel='BN1'`, `step='Step 1'`, `fechaInicioESS=NULL`
5. Migración idempotente: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "fechaInicioESS" TIMESTAMPTZ` corre una vez por arranque del servidor en `panel-estudiante.service.ts`

### Fix filtro 30 min en panel de reservas

- Antes: eventos a <30 min se ocultaban completamente → estudiantes en zonas horarias distintas no veían el evento de "hoy"
- Ahora: eventos entre -60 min y +30 min se muestran deshabilitados con badge "Próximamente" (los estudiantes pueden ver que existe el evento aunque no puedan reservar)
- Eventos >60 min en el pasado se ocultan definitivamente

### Inicializar Nivel — Detalles de implementación

- **Permiso**: `STUDENT.ACADEMIA.INICIALIZAR_NIVEL` — asignable desde `/admin/permissions`
- **Columnas DB nuevas en ACADEMICA** (auto-creadas con `ADD COLUMN IF NOT EXISTS`):
  - `checkinicianivel` INTEGER — contador; `NULL`=no ejecutado, `1`=ejecutado (bloqueado)
  - `inicianivel` JSONB — auditoría: `{fecha, motivo, autorizadoPor, realizadoPor, nivel, stepAnterior, stepNuevo, bookingsEliminados}`
- **API**: `GET /api/postgres/students/[id]/inicializar-nivel` (preflight) + `POST` (ejecutar)
- **Qué borra**: `DELETE FROM ACADEMICA_BOOKINGS WHERE (idEstudiante=$1 OR studentId=$1) AND nivel=$2`
- **Primer step del nivel**: consulta `NIVELES` ordenando por número extraído del step (`REGEXP_REPLACE`)
- **Archivos**: `src/app/api/postgres/students/[id]/inicializar-nivel/route.ts`, `src/components/student/StudentInicializarNivel.tsx`, `src/repositories/academica.repository.ts` (resetNivel, ensureColumns), `src/repositories/booking.repository.ts` (countByNivelAndStudent, deleteByNivelAndStudent), `src/services/student.service.ts` (getInicializarNivelInfo, inicializarNivel)

## Historial de cambios

El registro detallado de cambios (2026: abril → septiembre) vive en
**[docs/CHANGELOG.md](docs/CHANGELOG.md)** — se movió allí porque este archivo se
carga completo en cada sesión y el historial ocupaba el 83% de su tamaño.

**Al terminar un cambio, documentarlo en `docs/CHANGELOG.md`** (no aquí), en la
tabla del mes correspondiente y al inicio de la tabla. En `CLAUDE.md` solo se
actualiza lo que cambie de forma permanente: arquitectura, convenciones, tablas
de BD, permisos, rutas.
