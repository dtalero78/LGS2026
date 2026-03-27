# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LGS Admin Panel is a Next.js 14 administrative dashboard for "Let's Go Speak" language learning platform. The panel provides management interfaces for students, classes, events, contracts, and financial data. Includes a student self-service portal, a public contract/consent page, WhatsApp integration (Whapi.cloud), PDF generation (API2PDF), and a digital signature system via OTP. Uses PostgreSQL (Digital Ocean) as primary database with a layered architecture (Repository → Service → API Route → Hook).

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
134. Expiración automática de contratos (diario 12:00 UTC, marca como FINALIZADA + estadoInactivo)
135. Reactivación automática de OnHold (diario 6:00 AM UTC, extiende contrato por días pausados)
136. Autenticación de cron jobs con CRON_SECRET

### Panel del Estudiante (Auto-Servicio)
137. Portal de auto-servicio para estudiantes logueados (rol ESTUDIANTE)
138. Ver perfil propio (merge PEOPLE + ACADEMICA)
139. Ver progreso académico ("¿Cómo voy?" con barra de progreso, steps, porcentaje)
140. Ver eventos próximos y disponibles (filtrados por nivel/step del estudiante)
141. Auto-reserva de clases - Wizard 4 pasos: fecha (hoy/mañana) → tipo → evento → confirmación
142. Validaciones de reserva: capacidad, no duplicado, no pending SESSION, límites semanales (2 sesiones/3 clubs), no misma hora, mínimo 30 min antes
143. Cancelación de clases con deadline de 60 minutos antes del evento
144. Estadísticas personales de asistencia (total, asistidas, ausentes, porcentaje)
145. Historial completo de clases con detalles
146. Material de estudio por nivel/step actual
147. Comentarios de advisors (anotaciones y evaluaciones)
148. Próxima clase destacada (card grande con fecha, advisor, Zoom link). Muestra "---" cuando no hay evento agendado (no muestra el nivel/step del estudiante). Cuando el Zoom aún no está disponible muestra: "Enlace disponible 5 min antes, recuerde refrescar el navegador"
149. Actividades Complementarias (AI quiz): estudiantes con 1 sesión exitosa en un step normal pueden tomar un quiz de 10 preguntas generado por OpenAI (gpt-4o-mini). ≥80% para aprobar, máximo 3 intentos. Al aprobar se crea booking COMPLEMENTARIA y se ejecuta auto-promoción
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
│   │   ├── materials/           Material por nivel/step, books (DO Spaces proxy)
│   │   ├── permissions/         Permisos del usuario actual
│   │   ├── users/               Rol de usuario por email
│   │   ├── panel-estudiante/    Panel del estudiante (me, events, stats, progress, book, cancel, materials, history, comments)
│   │   └── dblgs/               Visor/editor de base de datos
│   ├── consent/                 Consentimiento declarativo (status, contract-data, send-otp, verify, auto-approve)
│   ├── contracts/               Generación y envío de PDF de contrato (send-pdf)
│   ├── auth/                    NextAuth handler, logout
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
- **Provider**: Whapi.cloud API
- **Implementation**: `src/lib/whatsapp.ts`
- **Functions**: `formatPhoneNumber(raw)` validates/strips to digits, `sendWhatsAppMessage(toNumber, messageBody)` sends via Whapi
- **Uses**: Envío de contratos PDF, mensajes de bienvenida, OTP para consentimiento, plantillas de mensajes en detalle estudiante
- **Token**: `WHAPI_TOKEN` env var (hardcoded fallback exists but should use env)

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
```
NEXTAUTH_URL=https://your-app-url.ondigitalocean.app
NEXTAUTH_SECRET=your_32_character_secret_key
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-secure-password
DATABASE_URL=postgresql://user:pass@host:port/dbname
CRON_SECRET=secret_for_cron_job_auth
API2PDF_KEY=api2pdf_api_key
WHAPI_TOKEN=whapi_cloud_token
OPENAI_API_KEY=openai_api_key_for_complementaria
ANTHROPIC_API_KEY=anthropic_api_key_for_dashboard_charts
```

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

### Compatibilidad Wix ↔ Admin en Bookings
- Datos migrados de Wix usan `idEvento` como foreign key a CALENDARIO (nueva columna: `eventoId`)
- El tipo de evento en datos Wix se almacena en `tipoEvento` (nueva: columna `tipo` en CALENDARIO)
- Las queries de welcome sessions usan `COALESCE(b."eventoId", b."idEvento")` y `COALESCE(c."tipo", b."tipoEvento")` para soportar ambos formatos
- Al crear nuevos bookings desde el admin, usar solo `eventoId` (sin `numeroId`, `celular`, `plataforma` que no existen en ACADEMICA_BOOKINGS)

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
- All SQL is parameterized ($1, $2, ...) to prevent injection
- JSONB fields for flexible data: `onHoldHistory`, `extensionHistory`, `evaluacion`, `steps`, `consentimientoDeclarativo`, etc.
- Key tables:
  - `PEOPLE`: Personas (titulares y beneficiarios), contratos, OnHold, consentimiento declarativo, comentarios
    - Campos de consentimiento: `consentimientoDeclarativo` (JSONB), `hashConsentimiento` (text)
    - Campos OnHold: `estadoInactivo`, `fechaOnHold`, `fechaFinOnHold`, `onHoldCount`, `onHoldHistory` (JSONB)
    - Campos extensión: `finalContrato`, `vigencia`, `extensionCount`, `extensionHistory` (JSONB) — **estos campos viven en PEOPLE, no en ACADEMICA**
    - Campos paralelos: `nivelParalelo`, `stepParalelo` (nullable)
    - Campo comentarios: `comentarios` (JSONB array) — comentarios internos por persona, NO hay tabla COMENTARIOS separada
  - `ACADEMICA`: Registros académicos por estudiante (nivel, step, nivelParalelo, stepParalelo). **No contiene** campos de contrato/extensión/onhold
  - `ACADEMICA_BOOKINGS`: Inscripciones a eventos (asistencia, evaluación, calificación, participación, comentarios). Datos migrados de Wix usan columna `idEvento` (nueva: `eventoId`) y `tipoEvento` (queries usan COALESCE para compatibilidad)
  - `CALENDARIO`: Eventos (SESSION, CLUB) con advisor, nivel, step, linkZoom, limiteUsuarios. Eventos de bienvenida se distinguen por `tituloONivel=WELCOME`. La columna `tipo=WELCOME` existe solo en datos legacy de Wix
  - `ADVISORS`: Profesores/advisors (primerNombre, primerApellido, nombreCompleto, email, zoom, telefono, pais, activo). Creación vía página pública `/nuevo-advisor` + auto-insert en USUARIOS_ROLES con rol ADVISOR
  - `USUARIOS_ROLES`: Credenciales y roles de usuario (email, password bcrypt/plain, rol)
  - `ROL_PERMISOS`: Definiciones de roles con arrays de permisos (JSONB)
  - `NIVELES`: Niveles académicos con steps, material, clubs y contenido (esParalelo flag para ESS, contenido TEXT para temario del step)
  - `STEP_OVERRIDES`: Overrides manuales de steps por estudiante
  - `FINANCIEROS`: Datos financieros (totalPlan, pagoInscripcion, saldo, cuotas, formaPago)
  - `CONTRACT_TEMPLATES`: Plantillas de contrato por plataforma (HTML con {{placeholders}})
  - `COMPLEMENTARIA_ATTEMPTS`: Intentos de actividades complementarias (AI quiz). Campos: studentId, nivel, step, attemptNumber, questions (JSONB), answers (JSONB), score, passed, bookingId, status (IN_PROGRESS/PASSED/FAILED)

## Migración Wix → PostgreSQL

### Resumen
Los datos de producción viven en Wix (base NoSQL). Periódicamente se sincronizan a PostgreSQL (Digital Ocean) usando scripts de migración que hacen UPSERT (INSERT ... ON CONFLICT DO UPDATE). Es idempotente: se puede re-ejecutar sin duplicar datos.

### Archivos del sistema de migración

```
migration/
├── config.js                        ← Configuración central (conexión PG, endpoints Wix, batch sizes)
├── orchestrator.js                  ← Ejecuta todos los exporters en secuencia
├── check-db.js                      ← Verifica conexión y cuenta registros por tabla
├── .env                             ← Credenciales (gitignored)
└── exporters/
    ├── 04-people.js                 ← PEOPLE (~9K registros)
    ├── 05-academica.js              ← ACADEMICA (~5K registros)
    ├── 06-calendario.js             ← CALENDARIO (~18K registros)
    ├── 07-academica-bookings.js     ← ACADEMICA_BOOKINGS (~100K registros)
    ├── 08-financieros.js            ← FINANCIEROS (~2.6K registros)
    ├── 09-populate-estudiantes.js   ← Popula USUARIOS_ROLES con estudiantes de ACADEMICA
    └── 10-populate-advisors.js      ← Popula USUARIOS_ROLES con advisors
```

### Cómo ejecutar la migración

#### 1. Prerequisitos
```bash
# Asegurar que node está disponible
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# El archivo .env debe existir en migration/ con:
DATABASE_URL=postgresql://doadmin:PASS@lgs-db-do-user-19197755-0.e.db.ondigitalocean.com:25060/defaultdb?sslmode=require
WIX_API_BASE_URL=https://www.lgsplataforma.com/_functions
```

#### 2. Abrir acceso en Digital Ocean
- Ir a Digital Ocean → Database → Trusted Sources
- Agregar `0.0.0.0/0` temporalmente (el ISP rota IPs entre subredes distintas: 191.x, 186.x, 212.x)
- **IMPORTANTE**: Quitar `0.0.0.0/0` al terminar la migración

#### 3. Preparar la base de datos
Antes de migrar, se deben **eliminar check constraints y NOT NULL** que bloquean datos de Wix:
```sql
-- Check constraints (valores de Wix fuera del rango permitido)
ALTER TABLE "PEOPLE" DROP CONSTRAINT IF EXISTS "PEOPLE_aprobacion_check";
ALTER TABLE "CALENDARIO" DROP CONSTRAINT IF EXISTS "CALENDARIO_tipo_check";
ALTER TABLE "ACADEMICA_BOOKINGS" DROP CONSTRAINT IF EXISTS "ACADEMICA_BOOKINGS_calificacion_check";
ALTER TABLE "FINANCIEROS" DROP CONSTRAINT IF EXISTS "FINANCIEROS_estado_check";

-- NOT NULL en campos que Wix deja vacíos
ALTER TABLE "PEOPLE" ALTER COLUMN "fechaCreacion" DROP NOT NULL;
ALTER TABLE "PEOPLE" ALTER COLUMN "tipoUsuario" DROP NOT NULL;
ALTER TABLE "ACADEMICA" ALTER COLUMN "fechaCreacion" DROP NOT NULL;
```

#### 4. Ejecutar migración por tabla
```bash
cd migration/

# Verificar conexión primero
node check-db.js

# Migrar tabla por tabla (recomendado)
node exporters/04-people.js
node exporters/05-academica.js
node exporters/06-calendario.js
node exporters/07-academica-bookings.js

# Opciones útiles
node exporters/04-people.js --dry-run     # Solo leer de Wix, no escribir en PG
node exporters/04-people.js --max=200     # Migrar solo 200 registros (para probar)

# O ejecutar todo en secuencia
node orchestrator.js
```

#### 5. Verificar resultados
```bash
node check-db.js    # Muestra conteos por tabla
```

### Arquitectura técnica de los exporters

Cada exporter sigue el mismo patrón:

1. **Fetch paginado desde Wix** con retry (5 intentos, backoff exponencial 5s-30s)
   - Endpoint: `https://www.lgsplataforma.com/_functions/exportar{Tabla}?skip=N&limit=M`
   - Batch size configurado en `config.js` (100-200 registros)

2. **Transform**: Limpia datos (fechas, JSONB, strings vacíos → NULL)

3. **Filtrado de columnas**: Consulta las columnas reales de la tabla PG y descarta campos de Wix que no existen en PG (Wix es schema-less y tiene campos extra como `crmContactId`, `direccion`, `link-copy-of-contrato-_id`, etc.)

4. **Batch UPSERT**: Construye un solo `INSERT INTO ... VALUES (...), (...), ... ON CONFLICT ("_id") DO UPDATE SET ...` por lote completo (~100-200 registros en una sola query)
   - Rendimiento: **125-226 registros/segundo**
   - Retry: 3 intentos con backoff de 2s-6s para errores de PG

### Rendimiento y problemas conocidos

| Estrategia | Velocidad | Estabilidad |
|---|---|---|
| Individual UPSERT (1 query por registro) | ~3 rec/sec | Estable pero muy lento |
| Parallel UPSERT (CONCURRENT=5-10) | ~12 rec/sec | Pool PG se agota después de ~2300 registros |
| **Batch UPSERT (multi-row INSERT)** | **125-226 rec/sec** | **Estable, 0 fallos** |

- **FINANCIEROS**: Endpoint Wix `/exportarFinanciera` funciona correctamente (2,626 registros migrados Mar 2026)
- **CLUBS, NIVELES_MATERIAL, COMMENTS, STEP_OVERRIDES**: Endpoints Wix no implementados
- **IP rotation**: El ISP rota IPs entre subredes completamente distintas. Por eso se necesita `0.0.0.0/0` en trusted sources durante la migración
- **SSL**: El `?sslmode=require` de DATABASE_URL se stripea automáticamente en `config.js` (igual que en `src/lib/postgres.ts`), usando `ssl: { rejectUnauthorized: false }` en su lugar

### Última migración exitosa: Mar 7, 2026

| Tabla | Registros | Última actualización |
|---|---|---|
| PEOPLE | 9,747 | 2026-03-07 |
| ACADEMICA | 5,413 | 2026-03-07 |
| CALENDARIO | 19,971 | 2026-03-07 |
| ACADEMICA_BOOKINGS | 114,366 | 2026-03-07 |
| FINANCIEROS | 2,626 | 2026-03-07 |
| ADVISORS | 45 | 2026-02-02 |
| USUARIOS_ROLES (ESTUDIANTE) | 5,367 | 2026-03-07 |

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
- **Pass threshold**: ≥80%
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
When a student with role ESTUDIANTE loads the panel (`resolveStudentFromSession`):
- If `finalContrato < today` and student is not already inactive:
  - Student is marked as `estadoInactivo = true`, `aprobacion = 'FINALIZADA'`
  - The titular of the same contract is also marked as `estadoInactivo = true`, `aprobacion = 'FINALIZADA'`
  - All contract members' `USUARIOS_ROLES.activo` set to `false` (blocks login)
- Implementation: `src/services/panel-estudiante.service.ts` (resolveStudentFromSession)

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
- Daily at 12:00 UTC, the cron job checks all contracts and marks expired ones as FINALIZADA + inactive
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

### Pages and Routes Summary (25 pages)
| Page | Route | Access |
|---|---|---|
| Login | `/login` | Public |
| Dashboard | `/` | Authenticated |
| Agenda Sesiones | `/dashboard/academic/agenda-sesiones` | ACADEMICO permissions |
| Agenda Académica | `/dashboard/academic/agenda-academica` | ACADEMICO permissions |
| Advisors | `/dashboard/academic/advisors` | ACADEMICO.ADVISOR permissions |
| Informe Beneficiarios | `/dashboard/academic/informes/beneficiarios` | ACADEMICO permissions |
| Welcome Session | `/dashboard/servicio/welcome-session` | SERVICIO permissions |
| Servicio Main | `/dashboard/servicio` | SERVICIO permissions |
| Lista Sesiones | `/dashboard/servicio/lista-sesiones` | SERVICIO permissions |
| Sin Registro | `/dashboard/servicio/sin-registro` | SERVICIO permissions |
| Crear Contrato | `/dashboard/comercial/crear-contrato` | COMERCIAL permissions |
| Contrato Detail (admin) | `/dashboard/comercial/contrato/[id]` | COMERCIAL permissions |
| Prospectos | `/dashboard/comercial/prospectos` | COMERCIAL permissions |
| Aprobación | `/dashboard/aprobacion` | APROBACION permissions |
| Permisos Admin | `/admin/permissions` | SUPER_ADMIN/ADMIN only |
| Student Detail | `/student/[id]` | Authenticated |
| Person Detail | `/person/[id]` | Authenticated |
| Session Detail | `/sesion/[id]` | ACADEMICO.SESION permissions |
| Advisor Detail | `/advisor/[id]` | Authenticated |
| Contrato Público | `/contrato/[id]` | **Public** (no auth) |
| Nuevo Advisor | `/nuevo-advisor` | **Public** (no auth) |
| Panel Advisor | `/panel-advisor` | ADVISOR role |
| Panel Estudiante | `/panel-estudiante` | ESTUDIANTE role |
| Actividad Complementaria | `/panel-estudiante/actividades-complementarias` | ESTUDIANTE role |
| Subir Lote | `/subir-lote` | SUPER_ADMIN only |
| DB Viewer | `/dblgs` | SUPER_ADMIN/ADMIN only |

## ESS (English Speaking Sessions) como Nivel Paralelo

### Overview
ESS es un nivel **paralelo y opcional** que NO bloquea el avance en los niveles principales (WELCOME → BN1 → BN2 → BN3 → etc.).

### Características Principales
- **Paralelo**: Los estudiantes pueden estar en BN1 Y ESS simultáneamente
- **Opcional**: No es requisito para avanzar a otros niveles
- **Solo tracking**: Se usa para seguimiento de asistencia, no afecta promociones automáticas
- **Sin dependencias**: Completar o no completar ESS no impide avanzar en otros niveles

### Estructura de Datos

#### NIVELES (PostgreSQL)
```javascript
{
  code: "ESS",          // Código del nivel
  step: "Step 0",       // Step único para ESS
  esParalelo: true,     // Campo que identifica niveles paralelos
  description: "English Speaking Sessions (Opcional)",
  material: [...],
  clubs: [...],
  contenido: "..."      // Temario/contenido del step (TEXT, importado de Wix)
}
```

#### ACADEMICA (PostgreSQL)
```javascript
{
  _id: "...",
  nivel: "BN1",           // Nivel principal actual
  step: "Step 1",         // Step principal actual
  nivelParalelo: "ESS",   // Nivel paralelo (opcional)
  stepParalelo: "Step 0", // Step paralelo (opcional)
  // ... otros campos
}
```

#### PEOPLE (PostgreSQL)
```javascript
{
  _id: "...",
  nivel: "BN1",           // Nivel principal
  step: "Step 1",         // Step principal
  nivelParalelo: "ESS",   // Nivel paralelo (opcional)
  stepParalelo: "Step 0", // Step paralelo (opcional)
  // ... otros campos
}
```

### Implementación

#### updateStudentStep
- **API**: `PUT /api/postgres/students/[id]/step`
- **Servicio**: `student.service.ts`
- **Repositorios**: `niveles.repository.ts`, `academica.repository.ts`, `people.repository.ts`
- Detecta si el nuevo step pertenece a un nivel paralelo consultando `NIVELES.esParalelo`
- Si `esParalelo === true`: Actualiza `nivelParalelo` y `stepParalelo`
- Si `esParalelo === false`: Actualiza `nivel` y `step` (comportamiento normal)

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
- Requiere **2 sesiones exitosas** (tipo SESSION) + **1 TRAINING club exitoso** (tipo CLUB)
- Una clase es "exitosa" si `asistio === true` OR `asistencia === true` OR `participacion === true`
- Mensajes diagnósticos específicos según lo que falta:
  - `sesExitosas >= 2, clubs === 0` → "Falta un TRAINING SESSION"
  - `sesExitosas === 1, clubs === 0` → "Falta una sesión."
  - `sesExitosas === 1, clubs >= 1` → "Falta una sesión para terminar."
  - `sesExitosas === 0, clubs >= 1` → "Faltan dos sesiones"
  - `sesExitosas === 0, clubs === 0` → "Faltan dos sesiones y un TRAINING SESSION"
- Si `complementariaEligible` es true, se agrega al mensaje: " Puedes realizar una actividad complementaria."

**2. Jump Steps (5, 10, 15, 20, 25, 30, 35, 40, 45) — múltiplos de 5**
- Requiere **1 clase con asistencia exitosa** (`asistio/asistencia/participacion = true`) Y `noAprobo !== true`
- El estudiante **permanece en el Jump Step** si:
  - No hay clases registradas → "Falta la clase del jump"
  - El advisor marcó `noAprobo = true` → "No aprobó el jump"
  - Tiene clase registrada pero no asistió o canceló → "Falta asistir al jump"
- El step se completa automáticamente cuando el estudiante **asistió exitosamente** y el advisor **no marcó `noAprobo = true`**
- El advisor solo necesita marcar `noAprobo = true` si el estudiante reprobó; si no marca nada y el estudiante asistió, el step se completa

**3. Overrides manuales**
- Tienen **prioridad absoluta** sobre toda la lógica
- `overrideCompletado === true` → completado sin importar clases
- `overrideCompletado === false` → incompleto, "Marcado como incompleto por administrador"
- Se almacenan en tabla `STEP_OVERRIDES` vía `StepOverridesRepository`

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
| ESS | Step 0 | Nivel paralelo, excluido del diagnóstico |
| DONE | Step 0 | Nivel final |

### TypeScript Types

**Archivo**: `src/types/index.ts`

```typescript
export interface Student {
  // ... otros campos
  nivel: string          // Nivel principal (WELCOME, BN1, BN2, etc.)
  step: string           // Step principal
  nivelParalelo?: string // Nivel paralelo opcional (ej: ESS)
  stepParalelo?: string  // Step paralelo opcional
}

export interface Person {
  // ... otros campos
  nivel?: string          // Nivel principal (opcional para titulares)
  step?: string           // Step principal (opcional para titulares)
  nivelParalelo?: string // Nivel paralelo opcional (ej: ESS)
  stepParalelo?: string  // Step paralelo opcional
}
```

### Flujo de Trabajo Típico

#### Estudiante comienza ESS mientras está en BN1
1. Estudiante actual: `nivel: "BN1"`, `step: "Step 1"`
2. Se inscribe en sesión ESS
3. Admin cambia a ESS usando `updateStudentStep({ numeroId, newStep: "0" })`
4. Estado resultante: `nivel: "BN1"`, `step: "Step 1"`, `nivelParalelo: "ESS"`, `stepParalelo: "Step 0"`
5. El estudiante puede continuar avanzando en BN1 sin problema

#### Estudiante avanza a BN2 mientras tiene ESS
1. Estado actual: `nivel: "BN1"`, `nivelParalelo: "ESS"`
2. Completa BN1 Step 5
3. Admin cambia a BN2: `updateStudentStep({ numeroId, newStep: "6" })`
4. Estado resultante: `nivel: "BN2"`, `step: "Step 6"`, `nivelParalelo: "ESS"` (se mantiene)

#### Diagnóstico "¿Cómo voy?"
1. Estudiante: `nivel: "BN2"`, `step: "Step 7"`, `nivelParalelo: "ESS"`
2. Generar diagnóstico: `generateReport(studentId)` desde `progress.service.ts`
3. **Resultado**:
   - Diagnóstico por steps: Solo muestra progreso de BN2 (Steps 6-10)
   - Cada step muestra: sesiones exitosas/2, clubs exitosos/1, estado, diagnóstico
   - Jump (Step 10) muestra: clases/1, sin columna clubs, estado especial
   - Estadísticas globales: Incluye TODAS las clases (incluyendo ESS) para tracking
   - No evalúa completitud de ESS

### Notas Importantes

- **Retrocompatibilidad**: Estudiantes sin nivel paralelo siguen funcionando normalmente
- **ESS Step 0 especial**: Sigue usando lógica de 5 semanas para aprobación automática
- **Campos opcionales**: `nivelParalelo` y `stepParalelo` son nullable en PostgreSQL
- **Jump Steps**: Funcionan igual en niveles paralelos y principales

## Recent Changes (March 2026)

| Commit | Description |
|---|---|
| `efe358b` | Fix: zoom unavailable text changed to "recuerda refrescar el navegador" (was "recuerde"), color set to white for visibility on blue background (panel-estudiante/page.tsx + NextClassCard.tsx) |
| `6b6afec` | Fix: beneficiary links in /person/[id] use ACADEMICA _id (falls back to PEOPLE _id if no academic record); booking.repository preserves prefixed step names (e.g. 'TRAINING - Step 7') |
| `9783aa8` | Fix: revert booking logic to original; add visual "Jump" suffix to step display in booking flow for steps that are multiples of 5 (e.g. "BN1 - Step 5 Jump") |
| `local` | Login diferenciado: BLOCKED (activo=false) lanza modal "Acceso bloqueado", EXPIRED (finalContrato < hoy) lanza modal "Contrato vencido", credenciales inválidas muestra toast |
| `f36fc36` | Fix: Jump Step stays when class is cancelled — progress.service shows "Canceló la clase del jump, debe reagendarla"; autoAdvanceStep now also requires exitosa attendance (was missing) |
| `1e073e8` | Login shows specific modal per failure reason: "Acceso bloqueado" (activo=false), "Contrato vencido" (finalContrato < hoy), or toast "Credenciales inválidas" (wrong password/user not found) |
| `6afa966` | Show PLATAFORMA instead of advisor link for COMPLEMENTARIA type classes in student academic tab |
| `53292ce` | Zoom link unavailable text changed to "Enlace disponible 5 min antes, recuerde refrescar el navegador" |
| `1d16cac` | Fix: trigger autoAdvanceStep on attendance endpoints (individual + bulk) — root cause of students getting stuck at wrong step |
| `411b353` | Fix: Jump Step requires exitosa attendance + noAprobo != true; non-attendance and cancellation keep student in jump step |
| `local` | Beneficiary names in PersonAdmin are clickable links to `/student/[id]` |
| `0868616` | Progress report uses CALENDARIO JOIN for correct step counts, complementaria restricted by week (Mon-Sun), Next Session card shows "---" when no event |
| `5d11520` | Student historial shows event's step from CALENDARIO instead of booking's stored step |
| `84f55cb` | Student booking saves event's step (from CALENDARIO) instead of student's current step |
| `5111cae` | ACADEMICA-PEOPLE JOIN prefers BENEFICIARIO over TITULAR when duplicate numeroId exists |
| `f96fd2e` | Student login resolves to BENEFICIARIO instead of TITULAR when they share the same email |
| `1e087f8` | OnHold deactivation properly clears estado and distinguishes real OnHold from other inactive states |
| `431e4a2` | Load saved evaluation data when selecting student in session detail |
| `fc319a0` | Fix stale inscritos cache, missing student info in event modal, and session grading endpoint |
| `f2e8869` | Prevent duplicate bookings caused by duplicate PEOPLE records |
| `02a8a8c` | Calendar ordering by creation date, timezone-aware booking, editable login password, email priority fix |
| `ea3b9d6` | Truncate origen value for complementaria bookings (varchar(10) limit) |
| `9daa60e` | Correct session parameter destructuring in onhold route |
| `afa5cdb` | Correct session parameter destructuring in extend and step-override routes |
| `07374d7` | Skip capacity limit for privileged roles and sync Role enum with DB |
| `a67a5ad` | Auto-create USUARIOS_ROLES entry on student registration (`/nuevo-usuario/[id]`) + email validation (lowercase, regex) |
| `d8e3e62` | Update welcome WhatsApp link to new platform domain (`lgs-plataforma.com`) |
| `e1745e0` | Sync USUARIOS_ROLES password on student registration (ON CONFLICT DO UPDATE instead of DO NOTHING) |
| `e6b92f0` | Sync `asistio` field when saving attendance from student class detail modal |
| `3fae770` | Exclude future events from absence/total counts in student attendance stats |
| `f21e1c2` | Use CALENDARIO JOIN in complementaria eligibility to match progress query |
| `028a229` | Add PEOPLE/ACADEMICA lookup buttons (P/A) to dblgs table rows |
| `300ae57` | Improve dblgs lookup to resolve across tables via academicaId, studentId, idEstudiante |
| `9266622` | Handle non-numeric contract numbers in next-number endpoint (e.g. 10182A) |
| `fc5466e` | Add missing `_id` to USUARIOS_ROLES INSERT in nuevo-usuario registration |
| `742e54f` | Generate contract number server-side to prevent duplicates from race conditions |
| `aa16e45` | Include consent data in PDF generation and remove HTML escaping |
| `521e092` | Use separate SQL parameters in nuevo-usuario booking INSERT to avoid type inference errors |
| `273869e` | Auto-promote WELCOME → BN1 Step 1 on attendance + show phone prefix for beneficiary |
| `284c413` | Show only student-facing comments in panel, not advisor internal notes |
| `e79eea3` | Propagate advisor and linkZoom changes to existing bookings when event is updated |
| `a674b92` | Exclude cancelled bookings from event detail modal list and counts |
| `a90642a` | Exclude cancelled bookings from batch counts (Inscritos badge in calendar) |
| `65d08f5` | Sync nivel/step/tituloONivel on event edit and show only tituloONivel in agenda card |
| `b41f91d` | Exclude cancelled bookings from step completion check to prevent incorrect promotions |
| `4199975` | Add admin endpoint to sync PEOPLE nivel/step from ACADEMICA (massive sync) |
| `ffca55e` | Progress report reads nivel/step from ACADEMICA instead of PEOPLE |
| `20b81c4` | Add bulk CSV upload page for PEOPLE records (`/subir-lote`) with UPSERT API and sidebar link |
| `b929d2f` | Restrict Subir Lote sidebar button to SUPER_ADMIN only |
| `b385f55` | Update Soporte Academico WhatsApp phone number (56926209723 → 56932631038) |
| `9208de7` | Prevent editing virtual columns (JOIN-derived) in dblgs viewer |
| `370e4f7` | Persist dblgs selected table and active view across page reloads (localStorage) |
| `543eabc` | Add AI-generated SVG dashboard charts via Claude API (6 visualizations, 30-min cache) |
| `c6a378d` | Resolve student and advisor names in chart queries (JOIN ACADEMICA/ADVISORS) |
| `e565494` | Make dashboard charts interactive with tooltips, hover effects, and animations (iframe renderer) |
| `3fe1bbb` | Use blob URL instead of doc.write to prevent duplicate variable declarations in charts iframe |
| `54c3221` | Remove Top Students card from dashboard, infer booking type from CALENDARIO/step name |
| `e111903` | Redesign dashboard charts as suggestion chips — individual on-demand generation instead of all-at-once |