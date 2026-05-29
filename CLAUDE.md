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
  - `ACADEMICA`: Registros académicos por estudiante (nivel, step, nivelParalelo, stepParalelo). **No contiene** campos de contrato/extensión/onhold
  - `ACADEMICA_BOOKINGS`: Inscripciones a eventos (asistencia, evaluación, calificación, participación, comentarios). Datos migrados de Wix usan columna `idEvento` (nueva: `eventoId`) y `tipoEvento` (queries usan COALESCE para compatibilidad)
  - `CALENDARIO`: Eventos (SESSION, CLUB) con advisor, nivel, step, linkZoom, limiteUsuarios. Eventos de bienvenida se distinguen por `tituloONivel=WELCOME`. La columna `tipo=WELCOME` existe solo en datos legacy de Wix
  - `ADVISORS`: Profesores/advisors (primerNombre, primerApellido, nombreCompleto, email, zoom, telefono, pais, activo, fotoAdvisor TEXT, domicilioadvisor TEXT). `fotoAdvisor` almacena key de DO Spaces (`fotosAdvisors/`); `domicilioadvisor` texto libre. Creación vía página pública `/nuevo-advisor` + auto-insert en USUARIOS_ROLES con rol ADVISOR
  - `USUARIOS_ROLES`: Credenciales y roles de usuario (email, password bcrypt/plain, rol). Campos adicionales: `numberid` (columna legacy existente, se llena con `numeroId` de ACADEMICA), `contrato` (auto-creada con `ADD COLUMN IF NOT EXISTS`, se llena desde ACADEMICA al registrarse en `/nuevo-usuario/[id]`)
  - `ROL_PERMISOS`: Definiciones de roles con arrays de permisos (JSONB)
  - `NIVELES`: Niveles académicos con steps, material, clubs y contenido (esParalelo flag para ESS, contenido TEXT para temario del step). Campos de material: `material` (JSONB advisor) y `materialUsuario` (JSONB array de keys DO Spaces). Los registros migrados de Wix en `material` pueden tener URLs `wix:document://...` (no accesibles — deben reemplazarse desde admin); los nuevos usan keys `materials/{nivel}/{tipo}/{step}-{filename}`. `GET /api/postgres/materials/nivel?step=&nivel=&tipo=usuario|advisor|all` expone campo `key` (Spaces key) cuando el material está en DO Spaces. `GET /api/postgres/materials/presigned?key=` genera presigned URL (10 min) para archivos en Spaces, usada por Descargar y el visualizador Office Online (PPTX/DOCX/XLSX)
  - `STEP_OVERRIDES`: Overrides manuales de steps por estudiante. El campo `studentId` guarda el ACADEMICA `_id` (no el PEOPLE `_id`). Si el estudiante tiene duplicados en ACADEMICA, el endpoint retorna error "USUARIO duplicado en ACADEMICA"
  - `FINANCIEROS`: Datos financieros (totalPlan, pagoInscripcion, saldo, cuotas, formaPago)
  - `CONTRACT_TEMPLATES`: Plantillas de contrato por plataforma (HTML con {{placeholders}})
  - `COMPLEMENTARIA_ATTEMPTS`: Intentos de actividades complementarias (AI quiz). Campos: studentId, nivel, step, attemptNumber, questions (JSONB), answers (JSONB), score, passed, bookingId, status (IN_PROGRESS/PASSED/FAILED), plataforma (VARCHAR 50, nullable — se llena al generar el quiz desde el panel estudiante)
  - `APP_CONFIG`: Configuración de la aplicación (clave/valor). Campos: key (PK), value (TEXT), color (VARCHAR 20, default '#ffffff'), updatedBy, _updatedDate. Registros: `ticker_message` (banner animado panel estudiante), `banner_image` (base64 imagen banner login), `banner_active` ('true'/'false' visibilidad banner login)
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

## Recent Changes (May 2026)

| Commit | Description |
|---|---|
| `2a52612` | chore: **scripts read-only de diagnóstico de niveles/steps** + verificación de integridad nivel↔step. (1) [`scripts/verify-niveles-step-range.js`](scripts/verify-niveles-step-range.js): recorre todos los registros de `ACADEMICA` con nivel y reporta los que tienen el `step` **fuera del rango canónico** de su nivel (BN1=1–5, BN2=6–10, … F3=41–45; ESS=Step 0, WELCOME, MASTER=46/IELTS=47/B2FIRST=48/TOEFL=49, DONE=50). (2) [`scripts/inspect-niveles-orden.js`](scripts/inspect-niveles-orden.js): inspecciona la tabla `NIVELES` (columnas `code`/`step`/`orden`/`esParalelo`) para confirmar la progresión pedagógica. Ambos **solo leen** (sin `--apply`, sin DML) → aparecen como "Solo lectura" en *Mantenimiento › Scripts › Consulta*. **Verificación de mayo 2026**: se detectaron 6 registros en ACADEMICA con step fuera de rango (cada uno un estudiante con nivel↔step desalineado, ej. P1 con Step 26); el usuario los corrigió manualmente y la re-corrida confirmó **0 fuera de rango** sobre 6.181 registros. La tabla `NIVELES` (52 filas) quedó verificada como 100% consistente con el orden canónico: `orden` 1→16 (WELCOME, ESS, BN1…F3, MASTER, IELTS, B2FIRST, TOEFL, DONE) y cada `code` con sus steps exactos en rango |
| `local` | fix: **`wix/deleteBeneficiario` borraba bookings por columna inexistente `visitorId`**. El DELETE de `ACADEMICA_BOOKINGS` usaba `WHERE "visitorId" IN (...)` pero esa columna no existe en la tabla → la query lanzaba error y el borrado de beneficiario fallaba en ese paso. **Fix** ([deleteBeneficiario/route.ts](src/app/api/wix/deleteBeneficiario/route.ts)): borra por el vínculo real `studentId` / `idEstudiante` (= `ACADEMICA._id`, vía subquery por `numeroId`) más la columna legacy `numeroId` del propio booking — las tres rutas de enlace. Consistente con el `DELETE FROM "ACADEMICA" WHERE numeroId` que la misma función ya ejecuta. Validado con EXPLAIN |
| `local` | feat: **Informes > Académica > X Niveles** — listado de usuarios académicos por nivel. Página [/dashboard/informes/academica/x-niveles](src/app/dashboard/informes/academica/x-niveles/page.tsx) + endpoint [route.ts](src/app/api/postgres/reports/academica/x-niveles/route.ts) (gateado por `INFORMES.ACADEMICA.X_NIVELES`). Lee `ACADEMICA` directo (tiene primerNombre/primerApellido/email/numeroId/nivel/step). **Filtros**: nivel (dropdown BN1…DONE o Todos) + rango de fechas opcional (por `COALESCE(fechaContrato,_createdDate)`; vacío=todos). + **filtro de Step** (dropdown con los steps **canónicos del currículo** del nivel — no los distinct de ACADEMICA, que traen datos sucios como P2 con "Step 26". Fórmula: niveles principales = 5 steps consecutivos BN1=1–5…F3=41–45; ESS=Step 0, WELCOME, MASTER=46/IELTS=47/B2FIRST=48/TOEFL=49, DONE=50. "Todos" = todos los del nivel). El dropdown de **nivel auto-aplica** (resetea step + recarga, así conteo/chips quedan en sync con lo mostrado). **Orden**: niveles en orden pedagógico (BN1,BN2,BN3,P1,P2,P3,F1,F2,F3,MASTER,IELTS,B2FIRST,TOEFL; ESS/WELCOME/DONE al final), steps numérico 0→50. **Columnas**: Nombre · ID · Correo · Nivel · Step. **Conteo total** arriba + chips de desglose por nivel (clickeables para filtrar). **Descargar CSV**. Tabla con cap de 8 000 filas (avisa si excede; el total real siempre se muestra). Permiso registrado en catálogo (sección Académica), middleware, sidebar (Informes > Académica) y pagePermissions |
| `local` | feat: **Informes > Académica > Hold & Vigencias** — tablero de monitoreo de los crons. Página [/dashboard/informes/academica/hold-vigencias](src/app/dashboard/informes/academica/hold-vigencias/page.tsx) + endpoint [route.ts](src/app/api/postgres/reports/academica/hold-vigencias/route.ts) (gateado por `INFORMES.ACADEMICA.HOLD_VIGENCIAS`). Monitorea los dos crons: **reactivate-onhold** (desbloqueo por OnHold vencido, 03:00 UTC) y **expire-contracts** (bloqueo por contrato vencido, 04:00 UTC). Muestra: (1) **Salud de cada cron** desde `CRON_RUNS` (última corrida, status, procesados/exitosos/fallidos, flag stale >26h, errorMessage). (2) **Inconsistencias AHORA** (lo clave): registros que cumplen la condición del cron pero NO fueron procesados — *OnHold vencido no desbloqueado* (`estadoInactivo=true AND fechaFinOnHold <= hoy`) y *contrato vencido no bloqueado* (misma query que el cron: BENEFICIARIO activo con `CONTRACT_EXPIRED_SQL` y estado≠FINALIZADA), cada uno con **causa inferida**: error de la última corrida (de `metadata.details`), cron stale, "pendiente próxima ejecución" (venció después de la última corrida) o "⚠ inconsistencia: cumple condición pero no fue procesado". (3) **Acciones recientes** del rango (desbloqueos/bloqueos) aplanando `CRON_RUNS.metadata.details`. Filtros de fecha + Recargar + CSV. Permiso registrado en catálogo (sección Académica), middleware, sidebar (Informes > Académica) y pagePermissions |
| `local` | feat: **Informes > Contratos > Matrículas** — informe snapshot de contratos con filtros, CSV y PDF ejecutivo. "Contratos" pasa a submenú con "Matrículas" (nueva pestaña). Página [/dashboard/informes/contratos/matriculas](src/app/dashboard/informes/contratos/matriculas/page.tsx) + endpoint [route.ts](src/app/api/postgres/reports/contratos/matriculas/route.ts) (gateado por `INFORMES.CONTRATOS.MATRICULAS`). **Filtros**: País (`PEOPLE.plataforma`) + rango de fechas por FECHA DE CONTRATO (`COALESCE(inicioContrato,fechaContrato,_createdDate)`); el rango aplica al embudo de contratos (x Aprobar/Vigentes/Finalizados/Beneficiarios/barras/dona), las tarjetas académicas son estado actual (sólo país). **Exclusión de contratos de prueba**: descarta nombre/apellido placeholder (TITULAR/BENEFICIARIO), vacío o que contenga 'PRUEBA'. **7 tarjetas**: **x Aprobar** (pendientes SIN decisión: `aprobacion` NULL — **excluye** Aprobado/Finalizado y los estados ya decididos Rechazado/Devuelto/Retractado/Contrato Nulo/Pendiente), **Vigentes** (`aprobacion IN (Aprobado,Aprobada)` Y `estado<>FINALIZADA`), **Finalizados** (`estado=FINALIZADA`), **Beneficiarios** (TOTAL de beneficiarios reales — estado actual, sólo país; es el universo de estudiantes, siempre ≥ académicos activos), **Académicos Activos** (ACADEMICA Step 0–49/WELCOME y `estadoInactivo!=true`), **En OnHold** (PEOPLE beneficiarios con `fechaOnHold` + `estadoInactivo`), **Académicos Inactivos** (Step 50). **Barras** pendientes por antigüedad (1 sem–1 mes / 1–2 meses / +2 meses), medida **desde la fecha final hacia atrás** (`endDate − fechaContrato`; por defecto hoy). **Dona** aprobadas-sin-finalizar vs sin-aprobar. **Heatmaps**: izquierda **por país × mes** en ventana móvil de **12 meses hacia atrás desde `endDate`**; derecha **Consolidado LGS** (toda la compañía, sin filtro de país) por mes. **CSV** (`exportToExcel`) y **Imprimir/PDF ejecutivo** (mismo patrón que InfoAcademic: `@media print`, watermark del logo, print-header, `window.print()`), gateados por `CONTRATOS_MATRICULAS_EXP` / `CONTRATOS_MATRICULAS_PDF`. Permisos registrados en catálogo (sección Contratos), middleware y pagePermissions. SQL validada contra producción |
| `local` | feat: **X País — card izquierdo "Consolidado por País" reestructurado en 3 bloques**. ([asistencia/x-pais/page.tsx](src/app/dashboard/informes/asistencia/x-pais/page.tsx), todo client-side, sin cambios de API). (1) **Eventos Asistencia** (nuevo, arriba): País · Asistencia · %, donde **% = asistencias del país / total de asistencias a TODOS los eventos excluyendo complementarias** (Sesiones+Jumps+Training+Clubes+Welcome vía `consolidatePorPais([ses,jmp,tr,cl,wel])`, ordenado por asistencia). El TOTAL es 100% (base de comparación). (2) **Asistencia vs Agendamiento** (el cuadro que antes era el primero, Sesiones+Jumps+Training+Clubes): renombrado; columnas País · **Agendamiento** (total) · **Asistencia** (asistieron) · %, con **% = asistencia/agendamiento** (tasa) por fila y en el TOTAL. (3) **Complementarias**: ahora muestra solo País · **Generadas** · % (se quitó la columna Total); % = participación del país sobre el total de generadas, TOTAL 100%. Los filtros de fecha y el resto del informe sin cambios |
| `local` | refactor: **Permisos de Informes reorganizados por sección + modelo de 2 marcas + Tableros eliminados**. Rediseño de cómo se ven/otorgan los permisos del módulo Informes en `/admin/permissions` para que reflejen el sidebar. (1) **Matriz por sección**: el bloque genérico "Informes" (que mezclaba los permisos nivel-2 de grupo) se eliminó. Ahora cada sección es su propio grupo en la matriz: **Acceso** (solo `INFORMES.VER`, el abuelo), **Asistencia**, **Programación**, **Advisors**, **Académica**, **Contratos**, **Planta**, **Estadísticas**. Cada sección lista sus informes y, **debajo de cada informe, su permiso de botón** "↳ Descargar CSV" / "↳ Imprimir/PDF". (2) **Modelo de 2 marcas**: para ver un informe basta marcar el abuelo `INFORMES.VER` + el ítem del informe. La sección (Asistencia, etc.) **aparece sola** en el sidebar cuando tiene ≥1 ítem permitido — ya NO requiere un permiso de sección propio. El grupo "Informes" del sidebar se muestra si el usuario tiene **cualquier** permiso de Informes (`sectionPermissions['Informes'] = Object.values(InformesPermission)`); el filtro de sub-grupos pasó a `if (child.isSubmenu && item.name==='Informes') return children.length>0`. (3) **Permiso de export por informe** (uno por reporte, no por sección): nuevos `INFORMES.<SECCION>.<REPORTE>.EXPORTAR` (+ `…INFOACADEMIC.IMPRIMIR` para el PDF). Cableados en los botones: páginas de Asistencia (5) y Estadísticas (2) directo; Programación (3) y Advisors (7) vía un campo `exportPermission` en sus configs (`event-report.config`, `advisor-report.config`) pasado como prop a Filters/Table; Horas Advisor con `ACAD_HORAS_ADVISOR_EXP`. Los permisos viejos por-sección (`INFORMES.ASISTENCIA.EXPORTAR`, etc.) quedan en el enum pero sin uso ni entrada en el catálogo. Los **filtros NO llevan permiso** (implícitos). (4) **InfoAcademic User** ahora tiene su propio permiso de ítem `INFORMES.ACADEMICA.INFOACADEMIC` (antes compartía `INFORMES.USUARIOS` con el informe Usuarios). (5) **Tableros eliminados**: se quitaron los 7 stubs `/dashboard/tableros/*`, sus ítems del sidebar, los permisos `TABLERO_*` (enum + catálogo + middleware + pagePermissions). Las áreas Administración/Gerencia/Servicio/Recaudo/Comercial/Sistema **reaparecerán como secciones** de Informes cuando se les construya el primer informe (igual que pasó con Académica). **Impacto RBAC**: tras el deploy, los roles no-admin deben re-marcarse con la nueva estructura en `/admin/permissions` (SUPER_ADMIN/ADMIN bypassean). Sin cambios de datos de negocio |
| `local` | feat: **Horas Advisor — relación ADVISORS↔USUARIOS_ROLES, desglose por tipo y advisors activos/inactivos**. Refinamientos sobre el informe Horas Advisor. (1) **Relación formal `ADVISORS.usuarioRolId` → `USUARIOS_ROLES._id`** (análoga a `ACADEMICA.usuarioId`→PEOPLE): migración idempotente [`scripts/add-advisor-usuariorol-relation.js`](scripts/add-advisor-usuariorol-relation.js) (`ADD COLUMN IF NOT EXISTS` + backfill por email, DISTINCT ON prefiriendo rol ADVISOR; 50/50 enlazados). `advisors/create` setea `usuarioRolId` tras crear/encontrar la cuenta (RETURNING + fallback SELECT por email). `ADVISOR_COLUMNS` incluye la columna. El informe resuelve `numeroId` por la relación (`url."numberid"`) con fallback LATERAL por email. (2) **Filtro "Tipo" + columnas por tipo** (como el informe Resumen): el endpoint clasifica cada evento (CALENDARIO y ADVISOR_EVENT_LOG) vía `CASE` en sesiones/jumps/training/clubes/welcome/essential/otros (helper `tipoExpr`, `CROSS JOIN LATERAL`). El conducted se desglosa por tipo (las columnas suman exacto a conducted), el filtro Tipo acota todo el informe, y la tabla detalle agrega columnas Sesiones/Jumps/Training/Clubes/Welcome/Essential/Otros. (3) **Gráfica nueva "Conducted por Tipo"** (barras horizontales con `<Cell>` por color) ubicada entre la fila 1 (barras+dona) y el detalle. (4) **Advisors en lista/gráficas = SOLO los que tuvieron actividad** en el rango (`combined` = conducted ∪ logs). Los advisors **activos sin horas** (ej. Super Advisor) **NO aparecen** en lista ni gráficas; los **inactivos aparecen solo si tuvieron agendamientos**, con **nombre en rojo + ⚠**. El KPI **"Advisors Activos"** cuenta el roster activo del país (query aparte `COUNT(*) WHERE activo=true`), independiente de la actividad. Si se **filtra por un advisor específico sin agendamientos** en el período, la lista y las 3 gráficas muestran el mensaje "⚠ Este advisor no tuvo agendamientos en el período consultado" (flag `sinDatosAdvisor`). CSV agrega columnas Activo + desglose por tipo |
| `local` | feat: **Informes > Académica > Horas Advisor + reorganización del subgrupo Académica**. (1) **Nuevo subgrupo "Académica"** bajo el sidebar Informes (isSubmenu) que agrupa: **Horas Advisor** (nuevo), **Usuarios** e **InfoAcademic User** (movidos desde el nivel superior de Informes). (2) **Nueva página `/dashboard/informes/academica/horas-advisor`** ([page.tsx](src/app/dashboard/informes/academica/horas-advisor/page.tsx), nueva pestaña) — título "Informe de horas Advisor". Filtros: **Plataforma (País)** (= `ADVISORS.pais`), **Advisor** (dropdown filtrado por la plataforma elegida), **fecha inicial/final**. Botones Aplicar/Limpiar/Exportar CSV. **Barras horizontales** (izq, Recharts) apiladas por advisor con conducted/suspended/cancelled; **dona SVG** (der) con total al centro + los 3 estados y % respecto al total; fila de KPIs (Total/Conducted/Suspended/Cancelled). **Tabla inferior** con advisor, numeroId, conducted, suspended, cancelled, total booking (suma) + **fila de totales** en `<tfoot>`. (3) **Modelo de datos** (igual que Ctrl Horas): `conducted` = eventos vigentes en `CALENDARIO` del advisor; `cancelled` = `ADVISOR_EVENT_LOG.estado='Canceled'` (cambio de advisor); `suspended` = `ADVISOR_EVENT_LOG.estado='Suspended'` (cancelación del evento); total = suma de los tres. El `numeroId` del advisor (que NO existe en ADVISORS) se resuelve vía `USUARIOS_ROLES.numberid` por email (LATERAL, puede ser null). (4) **Endpoint `GET /api/postgres/reports/academica/horas-advisor`** ([route.ts](src/app/api/postgres/reports/academica/horas-advisor/route.ts)): CTEs `conducted`/`logs` resuelven el advisor por `_id` OR email (tolera datos legacy), filtros opcionales de plataforma/advisor por parámetro. Gateado por `requirePermission(INFORMES.ACADEMICA.HORAS_ADVISOR)` (SUPER_ADMIN/ADMIN bypass). (5) **Permisos nuevos**: `InformesPermission.ACADEMICA` (`INFORMES.ACADEMICA`, nivel-2 del subgrupo) y `InformesPermission.ACAD_HORAS_ADVISOR` (`INFORMES.ACADEMICA.HORAS_ADVISOR`, nivel-3 del reporte), registrados en `PERMISSIONS_CATALOG`, `ROUTE_PERMISSIONS`, `pagePermissions` y `informesSubmenuPermissions`. El gate del subgrupo Académica acepta `[ACADEMICA, USUARIOS, ACAD_HORAS_ADVISOR]` para que ningún rol con `INFORMES.USUARIOS` pierda acceso a Usuarios/InfoAcademic tras el movimiento. SUPER_ADMIN/ADMIN bypassean |
| `local` | feat: **Consulta de Scripts (Mantenimiento > Scripts) + auditoría/limpieza de ROL_PERMISOS**. (1) **Nueva página `/admin/scripts/consulta`** ([page.tsx](src/app/admin/scripts/consulta/page.tsx)) bajo el sidebar Mantenimiento > Scripts (nueva pestaña). Lista el catálogo de los scripts del repo con columnas: **Script** (nombre), **Utilidad** (extraída del comentario `/** */` de cabecera), **Ejecución** (línea `Uso:` del comentario, o `node scripts/<name>` + flags detectados), **¿Parámetros?** (Sí/No), **Parámetros** (flags `--xxx` + posicionales detectados), **Tipo** (badge: `Solo lectura` verde / `Escribe` rojo / `Escribe (--apply)` ámbar). Búsqueda por nombre o utilidad, filtro por tipo, **Descargar CSV** (vía `exportToExcel`). (2) **Endpoint `GET /api/admin/scripts/catalog`** ([route.ts](src/app/api/admin/scripts/catalog/route.ts)): escanea `scripts/*.js` con `fs.readdirSync(path.join(process.cwd(),'scripts'))` y parsea metadata por archivo (solo lectura del FS — **nunca ejecuta** scripts). El Dockerfile ya copia `scripts/` a la imagen del runner, así que funciona en producción. Heurística de Tipo: si tiene flag `--apply` → escribe (convención del repo, manda aunque el SQL sea dinámico); si no, regex de `UPDATE/INSERT/DELETE/ALTER/CREATE/DROP/TRUNCATE`; si nada → solo lectura. (3) **Permiso nuevo** `MantenimientoPermission.SCRIPTS_CONSULTA` = `'MANTENIMIENTO.SCRIPTS.CONSULTA'` registrado en `PERMISSIONS_CATALOG` (sección Scripts), en `ROUTE_PERMISSIONS` del middleware y en `pagePermissions` del sidebar. SUPER_ADMIN/ADMIN bypassean vía `requirePermission` + `PermissionGuard`. (4) **ROL_PERMISOS**: rol nuevo **`ACADEMICO_JEFE`** ("Director programas academico", activo, 50 permisos copiados de COORDINADOR_ACADEMICO — el resto se asignan manualmente) agregado al enum `Role` y a la BD. Descripciones erróneas corregidas (COORDINADOR_ACADEMICO y RECAUDOS_JEFE tenían texto de otro rol; se quitaron conteos `(N permisos)` desactualizados de 9 roles). (5) **`roles.repository`**: `create()` ahora genera `_id` (UUID, corrige bug latente: la columna es `NOT NULL` sin default) y mantiene `fechaCreacion`/`fechaActualizacion` (legacy Wix) en sync con `_createdDate`/`_updatedDate`; `updatePermisos()` sincroniza `fechaActualizacion`. Scripts de soporte: `inspect-rol-permisos*.js` (auditoría read-only), `fix-rol-permisos-descripciones-y-academico-jefe.js` (idempotente, dry-run por defecto, `--apply` para escribir) |
| `local` | feat: **Wizard Registrar Pago rediseñado — separar `fechaPago` / `fechaReporte`, snapshot del contrato read-only, "Valor a Aplicar" y "Saldo después de pago" calculados en vivo**. (1) **Migración idempotente** [`scripts/add-fecha-reporte-column.js`](scripts/add-fecha-reporte-column.js): `ALTER TABLE PAGOS_TITULARES ADD COLUMN IF NOT EXISTS "fechaReporte" DATE`. Separa el concepto "cuándo pagó el titular" (`fechaPago`) del "cuándo se registró en el sistema" (`fechaReporte`, default hoy). Nullable para retrocompatibilidad. (2) **Repository** `PagoTitular.fechaReporte` agregado al interface y al INSERT (slot $10). **Service** `pagosTitularesService.create()` ahora computa el saldo de forma autoritativa server-side: lee `FINANCIEROS.saldo` (el "Saldo a la Fecha" dinámico) y calcula `saldo = max(0, saldoAFecha − (valorPagado − descuento))` — antes usaba la fórmula vieja `valorCuota − valorPagado − descuento`. La columna `saldo` ahora representa "Saldo después de pago" (lo que queda debiendo tras aplicar este pago). El campo `fechaReporte` se default a hoy si el wizard no lo manda. (3) **PersonFinancial** pasa nueva prop `saldoActual={Number(financial?.saldo)}` al wizard para que muestre el Saldo a la Fecha + compute el saldo después en vivo. (4) **Wizard rediseñado** con 5 filas de campos en el orden pedido por el usuario: **Fila 1 (Fechas)** Fecha de Pago (edit) · Fecha de Reporte (edit, default hoy) · Fecha Primer Pago (read-only, del contrato — sigue siendo la columna BD `fechaVencimiento` por legacy). **Fila 2 (Snapshot del contrato — todo read-only, fondo gris)** Total del Programa · Cuotas Totales (`cuota#0.cuotasTotal`) · Saldo a la Firma (computed = `totalPlan − inscripcion`) · # Cuota (auto-incrementado desde `max(numCuota)+1`). **Fila 3** Plan (edit, dropdown Contado/Credito/Colaborador) · Saldo a la Fecha (read-only, `FINANCIEROS.saldo`) · Valor Cuota (read-only, del contrato). **Fila 4 (Captura del pago)** Valor a Pagar (edit, renombrado de "Valor Pagado") · Descuento (edit) · **Valor a Aplicar** (read-only ámbar, `= max(0, valorPagado − descuento)`) · **Saldo después de pago** (read-only verde, `= max(0, saldoFecha − valorAplicar)`). **Fila 5** Medio de Pago · # Referencia. Bloques posteriores sin cambios: checkboxes Último Pago/Penalidad, Pago Tercero, Documentos. (5) **MoneyInput** ya tenía la prop `readOnly` desde antes — la usamos para los 3 campos del snapshot del contrato (Total Programa, Valor Cuota). Los campos no monetarios usan inputs custom con clases `bg-gray-100 cursor-not-allowed`. (6) **Compatibilidad legacy**: el INSERT envía `saldo` calculado client-side, pero el endpoint lo ignora y recomputa server-side desde `FINANCIEROS.saldo` (única fuente de verdad). Cuota#0 (creada vía `/api/postgres/contracts` y `/api/admin/migrar-contrato`) NO usa este path, mantiene su propia inserción. (7) **Defaults**: `fechaReporte` se setea a `getLocalToday()` igual que `fechaPago`; el draft de localStorage los persiste ambos |
| `local` | feat: **Resumen Financiero rediseñado (5 cards) + Cambio Estado Cartera con auditoría + vocabulario nuevo**. (1) **5 cards en el Resumen Financiero del Titular** ([PersonFinancial.tsx](src/components/person/PersonFinancial.tsx)) reemplazan las 4 anteriores: `Valor Plan` (sin cambio, `FINANCIEROS.totalPlan`) · `Inscripción` (antes "Cuota Inicial", sin cambio de valor, `FINANCIEROS.pagoInscripcion`) · **`Saldo a la Firma`** (NUEVA semántica — calculado on-the-fly como `totalPlan − pagoInscripcion`, congelado por definición) · **`Total Cuotas`** (antes "Cuotas Restantes", ahora muestra `FINANCIEROS.numeroCuotas` — el total pactado en el contrato) · **`Saldo a la Fecha`** (NUEVA — `FINANCIEROS.saldo` mantenido al día por `syncFinancieroSaldo` desde pagos validados). Grid `lg:grid-cols-5`. (2) **Vocabulario canónico nuevo de `tipoCartera`** (mayo 2026): `Normal` (verde) · `Prejurídico` (rojo, antes ámbar) · `Último Pago` (morado, NUEVO) · `Penalidad` (naranja, NUEVO). Valores legacy `juridico` / `castigada` se conservan en `TIPO_CARTERA_VALIDOS_READ` para lectura de datos históricos (badge gris "Jurídico (legacy)" / "Castigada (legacy)") pero **NO** se aceptan en escrituras nuevas — `TIPO_CARTERA_VALIDOS` (whitelist de UPDATE) sólo permite los 4 canónicos. (3) **Migración idempotente** [`scripts/add-tipo-cartera-history-column.js`](scripts/add-tipo-cartera-history-column.js): `ALTER TABLE PAGOS_TITULARES ADD COLUMN IF NOT EXISTS "tipoCarteraHistory" JSONB DEFAULT '[]'::jsonb`. Anclada en la fila cuota#0 del titular (mismo row donde ya vive `tipoCartera`). (4) **Nueva función service `pagosTitularesService.cambiarTipoCartera(idPeople, {nuevoTipo, motivo}, actor)`**: valida nuevoTipo contra whitelist + motivo obligatorio, busca la fila cuota#0 del titular, lee `tipoCartera` previo + `tipoCarteraHistory` actual, hace append de la nueva entrada `{fecha, motivo, estadoAnterior, estadoNuevo, realizadoPor, realizadoPorNombre}` y UPDATEa la fila con el nuevo `tipoCartera` + history. Si no existe cuota#0 (contratos sin migrar) lanza ValidationError. (5) **Nuevo endpoint** `POST /api/postgres/people/[id]/cambio-cartera` ([route.ts](src/app/api/postgres/people/[id]/cambio-cartera/route.ts)) — gateado por `requirePermission(PersonPermission.CAMBIO_ESTADO_CARTERA)` con SUPER_ADMIN/ADMIN bypass. `actor` se toma de `session.user.email` y `session.user.name` (no spoofeable desde body). (6) **Nuevo permiso** `PersonPermission.CAMBIO_ESTADO_CARTERA` = `'PERSON.FINANCIERA.CAMBIO_ESTADO_CARTERA'` registrado en `PERMISSIONS_CATALOG` (visible en `/admin/permissions`, sección Financiera). Auto-incluido en SUPER_ADMIN y VALID_PERMISSIONS vía `Object.values(PersonPermission)`. (7) **UI**: botón **naranja "🔄 Cambio Estado Cartera"** al lado del botón morado "Asignar Ejecutivo de Recaudos" en el header del Resumen Financiero. Sólo visible con el permiso. Click abre modal con: banner amber de advertencia, dropdown con los 4 valores canónicos, textarea de motivo obligatorio, checkbox "Confirmo el cambio". Botón "Confirmar Cambio" deshabilitado hasta marcar checkbox + escribir motivo + seleccionar tipo. Tras guardar recarga la lista de pagos para refrescar el badge. (8) **Sincronización** del page `/dashboard/recaudos/asignacion` con el nuevo vocabulario: `ESTADO_CARTERA_META` con nuevos labels/colores + dropdown filtro con las 4 opciones nuevas + signature del state actualizado. (9) **Backend `findTitularesAsignados`** en el repositorio relaja el tipo de `estadoCartera` a `string | null` para aceptar tanto vocabulario nuevo como legacy en filtros (en datos viejos los registros pueden tener cualquier de los 6 valores). Cero impacto en lecturas existentes |
| `local` | fix + feat: **PDF de contrato salía sin valores financieros** + nueva página **Mantenimiento > Usuarios > Generar Contrato** para regenerar sin reenviar WhatsApp. (1) **Root cause**: `/api/contracts/[id]/send-pdf/route.ts:30` y `/api/consent/[id]/auto-approve/route.ts:82` consultaban `SELECT * FROM "FINANCIEROS" WHERE "titularId" = $1` — pero esa columna está NULL/inexistente en la tabla (los datos viven indexados por `contrato`, no por `titularId`). El query devolvía `null` y `fillContractTemplate` renderizaba string vacío en todos los placeholders financieros (`{{totalPlan}}`, `{{valorCuota}}`, `{{saldo}}`, `{{pagoInscripcion}}`, `{{numeroCuotas}}`, `{{formaPago}}`, `{{fechaPago}}`). Detectado con el contrato 01-15194-26 (Liliam Pamela Campodónico Acuña) donde FINANCIEROS tenía totalPlan=1.540.000/valorCuota=110.000/saldo=1.430.000 pero el PDF llegaba sin valores. (2) **Fix**: ambos endpoints ahora hacen `WHERE "contrato" = $1 ORDER BY "_createdDate" DESC LIMIT 1` con `titular.contrato` — mismo patrón que `/api/consent/[id]/contract-data/route.ts:40` que ya estaba bien. (3) **Nuevo endpoint** `POST /api/contracts/[id]/regenerate-drive` ([route.ts](src/app/api/contracts/[id]/regenerate-drive/route.ts)): repite los pasos 1-7 del send-pdf (carga titular + beneficiarios + financial + template → fillContractTemplate → API2PDF → upload a bsl-utilidades vía `documento: titularId`) pero **omite el step 8 de Whapi**. Gateado por `MantenimientoPermission.GENERAR_CONTRATO` vía `requirePermission()` (SUPER_ADMIN/ADMIN bypass). bsl-utilidades sobreescribe el PDF en Drive porque usa `documento` como clave única. (4) **Nueva página `/admin/generar-contrato`** ([page.tsx](src/app/admin/generar-contrato/page.tsx)): sidebar Mantenimiento > Usuarios > "Generar Contrato" (newTab). Banner amber explica que NO reenvía WhatsApp. Input acepta número de contrato (`01-15194-26`) o ID directo (`prs_...` o UUID Wix), reutiliza `/api/postgres/contracts/search` igual que Edición Contrato. Botón verde "Regenerar PDF en Drive" abre modal de confirmación; tras éxito muestra card con URL del PDF generado + respuesta del Drive. (5) **Permiso nuevo** `MantenimientoPermission.GENERAR_CONTRATO` = `'MANTENIMIENTO.USUARIOS.GENERAR_CONTRATO'` registrado en `PERMISSIONS_CATALOG` (visible en `/admin/permissions` sección Usuarios), en `ROUTE_PERMISSIONS` del middleware, en `pagePermissions` del sidebar. SUPER_ADMIN/ADMIN auto-incluyen via `Object.values(MantenimientoPermission)` ya existente. (6) **Uso operativo**: cuando se detecte un error en un contrato ya generado (bug, cambio de datos del titular, ajuste de template), un admin entra a `/admin/generar-contrato`, busca por número de contrato, click "Regenerar PDF en Drive" — el PDF en Drive queda corregido sin molestar al cliente con un nuevo WhatsApp |
| `local` | feat: **Dashboard admin genérico — KPIs compactos + heatmap mes + donut + barras por nivel, sección "Visualizaciones" IA eliminada**. (1) [`DashboardStats.tsx`](src/components/dashboard/DashboardStats.tsx) reorganizado: las 5 tarjetas (`Total Usuarios / Inactivos / Sesiones Hoy / Inscritos Hoy / Advisors Hoy`) ahora caben **en una sola línea** (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`, padding `p-4`, icono `h-5 w-5`, valor `text-2xl`, nombre `text-[10px] uppercase`, descripción `text-[11px]`). Mismo lenguaje visual que los KPIs del AdvisorDashboard pero conservando icono + descripción contextual. (2) **Nuevo componente [`DashboardMonthlyCharts.tsx`](src/components/dashboard/DashboardMonthlyCharts.tsx)** con 3 visualizaciones globales del mes corriente: **(a) Heatmap Día × Hora** (Lun-Dom × 06:00-21:00, celdas 28×28 px, ancho completo, intensidad azul) que cuenta TODOS los bookings cuyo `CALENDARIO.dia` cae en el mes; **(b) Donut SVG "Sesiones del mes"** con 3 buckets disjuntos: Asistieron (verde `#22c55e`, `cancelo IS NOT TRUE AND asistio = true`), No asistieron (naranja `#f97316`, `cancelo IS NOT TRUE AND asistio IS NOT TRUE AND c."dia" < NOW()`), Canceladas (rojo `#ef4444`, `cancelo = true`); **(c) Barras horizontales "Sesiones agendadas por nivel"** con la etiqueta numérica **externa** a la barra (a la derecha, ancho fijo `w-10 tabular-nums`) para que niveles con pocas sesiones (ESS, F3) no pierdan su valor — antes la etiqueta iba adentro de la barra y se truncaba/clipeaba con barras pequeñas. Filtra `cancelo IS NOT TRUE` y ordena DESC. (3) **Backend**: nueva función `getMonthlyAggregates(tz)` en [dashboard.service.ts](src/services/dashboard.service.ts) — 3 queries paralelas (`Promise.all`) sobre `CALENDARIO JOIN ACADEMICA_BOOKINGS` con el patrón `b."eventoId" = c."_id" OR b."idEvento" = c."_id"` (BitmapOr, no COALESCE) para usar los índices `idx_bookings_evento` + `idx_bookings_idevento`. Endpoint `GET /api/postgres/dashboard/monthly?tz=America/Bogota`. TZ del cliente se envía via `Intl.DateTimeFormat().resolvedOptions().timeZone` con validación regex IANA en el endpoint. (4) **Eliminada sección "Visualizaciones"** (componente `<DashboardCharts />` con tarjeta "Sesiones vs. Asistencia") del root `/page.tsx` para no-ADVISOR — la nueva sección de heatmap+donut+barras la reemplaza completamente. El endpoint `/api/postgres/dashboard/charts/*` y el componente `DashboardCharts.tsx` quedan en el repo pero sin renderizado (deuda menor; se pueden quitar después). (5) **Caché client-side**: React Query con `staleTime 5min` + `refetchInterval 10min` (mismo patrón que `DashboardStats`). (6) **Sin impacto en ADVISOR**: la rama `if (userRole === 'ADVISOR') return <AdvisorDashboard />` corta antes — un advisor no ve los KPIs globales ni las charts mensuales globales (sólo SUS datos). (7) **Performance**: 3 queries paralelas + 1 endpoint stats actual = 4 round-trips al cargar el dashboard. Las queries pesadas (heatmap + donut + porNivel) escanean ~3-5k bookings/mes con el BitmapOr y se ejecutan en <200 ms cada una sobre el dataset actual. La caché de 5 min evita repetir esto en cada navegación |
| `local` | feat: **Dashboard personalizado para ADVISOR en `/`** — cuando el usuario logueado tiene rol `ADVISOR`, el root del panel (`/`) deja de mostrar los KPIs/charts IA globales (que son agregados de plataforma) y muestra una vista enfocada en SU actividad del mes corriente. Datos filtrados por su `ADVISORS._id` resuelto desde `session.user.email` — un advisor NUNCA ve datos de otro. (1) **Nuevo componente [`AdvisorDashboard.tsx`](src/components/dashboard/AdvisorDashboard.tsx)** (client) con 3 secciones: **(a) Header** con foto (presigned URL de DO Spaces, fallback a inicial) + saludo "¡Hola {primerNombre}!" + subtítulo con el mes corriente. **(b) Fila de 7 KPIs** del mes: `Sessions / Training / Clubs / Welcome / Conducted / Canceled / Suspended`. Training se separa de "Clubs (otros)" client-side via helper `isTrainingStep(step)` que matchea prefijo `'TRAINING -'` (regla `isTrainingClub()` ya documentada en CLAUDE.md — PRONUNCIATION/GRAMMAR/LISTENING/KARAOKE/CONVERSATION caen en Clubs). **(c) Fila de 2 heatmaps compactos Día×Hora del mes** (Lun-Dom × 06:00-21:00, celdas ~22×22 px): izquierda "Conducted — Día vs Hora" (tono azul interpolado entre `#dbeafe` y `#1d4ed8` por intensidad), derecha "Canceladas — Día vs Hora" (tono rojo). Si la matriz de canceladas está vacía (`max=0`), se renderiza un mensaje verde "¡Excelente! No has cancelado ninguna sesión este mes." en lugar del grid. **(d) Fila de 2 donuts SVG** ligeros (mismo patrón que `welcome-session/page.tsx`, sin Recharts): "Composición por tipo" (Sessions/Training/Clubs/Welcome) y "Composición por estado" (Conducted/Canceled/Suspended), ambos con total al centro y leyenda lateral con %. (2) **Cero queries nuevas en backend** — todo se deriva client-side del payload de `GET /api/postgres/advisors/[id]/control-horas?year=&month=` (el mismo endpoint que alimenta Ctrl Horas, ya optimizado con BitmapOr a ~93 ms para advisors con 150 eventos/mes). Helper `scaleColor`/`mixHex`/`hexToRgb` interpola colores hex para la intensidad del heatmap. (3) **Wiring en [`src/app/page.tsx`](src/app/page.tsx)**: rama nueva `if (userRole === 'ADVISOR') return <DashboardLayout><AdvisorDashboard /></DashboardLayout>` — los demás roles (SUPER_ADMIN, ADMIN, COMERCIAL, etc.) siguen viendo el dashboard genérico con `DashboardStats` + `DashboardCharts`. ESTUDIANTE sigue redirigiendo a `/panel-estudiante`. (4) **Acceso defense-in-depth**: el endpoint `/api/postgres/advisors/[id]/control-horas` ya valida que `session.user.email` matchee el `ADVISORS._id` del path para rol ADVISOR (admin bypassea). Si el email del advisor no está registrado en ADVISORS, el componente muestra "Tu usuario no está registrado como advisor". (5) **Performance**: 2 round-trips secuenciales (resolver `_id` por email → cargar mes); el segundo se cachea via `Cache-Control: no-store` para tener siempre datos frescos al login. Toda la transformación (KPIs, matrices del heatmap, donuts) es `useMemo` sobre el mismo payload — derivar 4 matrices de 7×16 + 7 contadores cuesta <5 ms. (6) **Decisión de UX**: el ADVISOR no ve las gráficas IA globales (sin sentido para él, además costosas) — sólo SUS datos. La sección de Visualizaciones del dashboard genérico permanece sin cambios para los otros roles |
| `local` | perf: **Ctrl Horas — 3 optimizaciones** que eliminan el lag al cargar el mes y al guardar Time Out / Notas. Diagnóstico: en advisors con muchos eventos (Javier Andrés: 150 eventos en mayo) la carga inicial demoraba varios segundos y cada save disparaba un refetch completo del mes. Tres mejoras independientes: **(1) Backend — fix lateral JOIN índice-amigable** ([advisor-event-log.service.ts:140-167](src/services/advisor-event-log.service.ts#L140)): cambio de `WHERE COALESCE(b."eventoId", b."idEvento") = c."_id"` a `WHERE b."eventoId" = c."_id" OR b."idEvento" = c."_id"`. `COALESCE` dentro de WHERE bloquea el uso de los índices `idx_bookings_evento` e `idx_bookings_idevento` (la función envuelve la columna y rompe el index match), forzando Seq Scan sobre 160k bookings por cada uno de los 150 eventos del mes. Con OR explícito Postgres usa `BitmapOr` combinando ambos índices. EXPLAIN ANALYZE para Javier mayo 2026: full query baja a **92.7 ms** (vs varios segundos antes). **(2) Frontend — optimistic update al guardar** ([control-horas/page.tsx](src/app/dashboard/academic/control-horas/page.tsx)): `EventDetailModal.save()` recibe del PATCH la respuesta `{ timeout, notasadvisor, audited }` (que el endpoint ya devolvía desde antes) y la pasa al callback `onSaved(updated)`. El padre, en vez de hacer `await fetchMonth()` (refetch del mes entero, ~150 eventos), muta sólo el `vigentes[]` del evento editado vía `setData(prev => ...vigentes.map(v => v.eventoId === evId ? {...v, timeout, notasadvisor} : v))` + sincroniza `selectedCard`. UX: el modal cierra el modo edición instantáneo, los datos en pantalla se actualizan sin loading. Eliminado el `cardsByEvent` useMemo que ya no se necesita (no se busca card refresh tras refetch). **(3) Frontend — caché client por mes** (mismo archivo): nuevo `cacheRef = useRef(new Map<string, MonthlyView>())` indexado por `${advisorId}-${year}-${month}`. `fetchMonth(force=false)` chequea cache primero; si hay hit setea `data` y `loading=false` sin tocar red. Navegación adelante/atrás entre meses ya consultados es **instantánea**. Invalidación: (a) botón Recargar llama `fetchMonth(true)` que bypasea cache y refetch; (b) tras un save de notas se hace `cacheRef.current.delete(key)` para que la próxima visita al mes traiga datos frescos del DB (cambios concurrentes / audit). Caché vive sólo en memoria del componente — al desmontar la página se pierde, no se persiste en localStorage (datos sensibles, cambian con asistencia/cancelaciones desde otros admin) |
| `local` | feat: **Ctrl Horas — admin puede editar Time Out / Notas con auditoría obligatoria si sesión cerrada**. (1) **Migración idempotente** (`scripts/create-advisor-notes-audit-table.js`): CREATE TABLE `ADVISOR_NOTES_AUDIT` con `_id`, `eventoId`, `advisorIdAtEdit`, `actorEmail`, `actorRole`, `motivo` (TEXT NOT NULL), `timeoutBefore/After`, `notasBefore/After`, `sesionEstabaCerrada`, `_createdDate` + índices `(eventoId, _createdDate DESC)` y `(actorEmail, _createdDate DESC)`. Tabla inmutable — solo INSERTs. (2) **Repository** `src/repositories/advisor-notes-audit.repository.ts` con `insert()` y `findByEventoId()`. (3) **Service `updateAdvisorNotes`** ampliado para aceptar `sessionRole` y `motivoAdminEdit` opcional. Lógica: si rol IN (SUPER_ADMIN, ADMIN) bypasea las 3 validaciones del ADVISOR (ownership por email, ventana temporal +30 min, sesión cerrada) — PERO si la sesión está cerrada exige `motivoAdminEdit` no vacío (lanza ValidationError si falta). Si el editor NO es el advisor propio O la sesión estaba cerrada, registra entrada en `ADVISOR_NOTES_AUDIT` con snapshot before/after, actor, role, motivo y flag `sesionEstabaCerrada`. Las ediciones del advisor propio en su evento abierto NO se auditan (flujo normal, ruido). (4) **Endpoint `PATCH /api/postgres/calendario/[eventoId]/notas-advisor`**: extrae `sessionRole` de la sesión NextAuth (no spoofeable desde body) y pasa `motivoAdminEdit` del body al service. (5) **Frontend Ctrl Horas** (`/dashboard/academic/control-horas`): `canEditNotes` cambiado a `vigente && (isAdmin || canEdit)` — el admin ve el botón de editar para cualquier evento vigente, incluso sesiones cerradas y fuera de ventana temporal. Si admin click en "Editar" sobre sesión cerrada → modal yellow "⚠️ Sesión cerrada — edición admin" con checkbox de confirmación + textarea de motivo OBLIGATORIO; sólo al marcar checkbox + escribir motivo se habilita el botón "Continuar a editar". Tras guardar, el toast indica `Guardado (con registro de auditoría)` para confirmar que el cambio quedó en `ADVISOR_NOTES_AUDIT`. Botón de editar en sesión cerrada se muestra con borde ámbar + emoji ⚠️ para distinguirlo del editar normal (azul) |
| `local` | feat: **cron health-check** — auditoría de ejecución de cron jobs para detectar proactivamente si dejan de correr. Motivado por bug donde el cron `reactivate-onhold` llevaba ~3 meses sin ejecutar (10 estudiantes con OnHold vencido hasta 105 días sin reactivar) y nadie se dio cuenta hasta detectarlos manualmente. (1) **Migración idempotente** (`scripts/create-cron-runs-table.js`): CREATE TABLE `CRON_RUNS` con `_id`, `cronName`, `startedAt`, `finishedAt`, `status` (running/success/partial/error), `processedCount`, `successCount`, `failedCount`, `errorMessage`, `metadata` (JSONB) + índice `(cronName, startedAt DESC)`. (2) **Helper [`src/lib/cron-runs.ts`](src/lib/cron-runs.ts)** con `recordCronRun(name, fn)`: envuelve la ejecución del cron, INSERT al inicio con status='running', UPDATE al final con status real + counts + metadata. Si `fn` lanza, marca status='error' con `errorMessage` y re-lanza (no oculta fallos). Si CRON_RUNS no existe aún (deploy antes de migración), degrada a no-op con warning — nunca bloquea al cron real. Helpers `getLastRun(name)` y `isStale(run, maxHours=26)`. (3) **Endpoints cron actualizados** (`/api/cron/reactivate-onhold` y `/api/cron/expire-contracts`): refactorizados para envolver toda la lógica de negocio en `recordCronRun()`. Retornan `{ processedCount, successCount, failedCount, metadata: { details } }` que se persiste en CRON_RUNS. Comportamiento externo idéntico (mismo JSON response). (4) **Endpoint nuevo `GET /api/cron/health-check`** (sólo SUPER_ADMIN/ADMIN): retorna `{ now, crons: { 'reactivate-onhold': {lastRun, lastStatus, hoursSinceLastRun, stale, lastProcessed/Success/Failed, pendingNow, ...}, 'expire-contracts': {...} } }`. `stale=true` si han pasado >26h sin ejecución (crones son diarios + 2h margen). Para reactivate-onhold también cuenta `pendingNow` = estudiantes con OnHold vencido AHORA — si el cron corrió OK pero `pendingNow > 0`, indica que algo más anda mal (ej. bug en el procesamiento per-estudiante). (5) **Uso operativo**: bookmark a `https://lgs-plataforma.com/api/cron/health-check` (login admin) → revisión diaria; si `stale: true` o `pendingNow > 0` mantenido, investigar logs del cron-worker en Digital Ocean. (6) **Diagnóstico paralelo**: si el cron-worker (definido en `.do/app.yaml` como Worker Node.js que llama al endpoint a las 03:00/04:00 UTC) no está desplegado o caído, el health-check lo detectará en la próxima revisión. **Nota deuda técnica**: `.do/app.yaml` referencia repo `dtalero78/let-s-go-speak2` pero el repo activo es `dtalero78/LGS2026` — si DO usa app.yaml, hay que corregirlo |
| `local` | fix: **`deactivateOnHold` sincroniza ACADEMICA — bug "puede entrar pero no agendar"**. Detectado patrón sistémico: estudiantes con OnHold ya desactivado podían loguear pero NO agendar. Causa raíz: `deactivateOnHold` en 3 lugares actualizaba PEOPLE (`estadoInactivo=false`, `fechaOnHold=NULL`) y USUARIOS_ROLES (`activo=true`) pero **NO** tocaba `ACADEMICA.estadoInactivo`. Como `student-booking.service.ts:289-296` bloquea si `ACADEMICA.estadoInactivo=true OR PEOPLE.estadoInactivo=true`, el registro de ACADEMICA quedaba en true permanentemente, bloqueando los nuevos bookings aunque login y panel funcionaran. **Fix**: agregado `UPDATE "ACADEMICA" SET "estadoInactivo" = false WHERE "numeroId" = $1` en los 3 puntos donde se reactiva OnHold: (1) `contract.service.deactivateOnHold` (botón "Reactivar Estudiante" del admin en `/student/[id]` Tab Contrato), (2) `panel-estudiante.service.resolveStudentFromSession` (auto-reactivación al login del estudiante cuando `fechaFinOnHold < hoy`), (3) cron `/api/cron/reactivate-onhold` (job diario de 6:00 AM UTC). Sync best-effort con try/catch — si falla no aborta la operación, queda warning. Cero schema migration, cero cambio de comportamiento para casos sanos, sólo cierra la fuga de desync. Casos históricos ya afectados (~20+ confirmados visualmente) se reparan manualmente cambiando `ACADEMICA.estadoInactivo` de `true` a `false` por `numeroId` |
| `local` | fix: **/panel-advisor — cerrar bypass del middleware (agujero de seguridad)**. Detectado que SERVICIO_JEFE (y cualquier rol autenticado) podía entrar a `/panel-advisor?email=X` aunque NO tuviera `ACADEMICO.ADVISOR.VER_ENLACE`, porque `/panel-advisor` estaba listado en `alwaysAllowedRoutes` de [`src/middleware.ts:75`](src/middleware.ts#L75) — lista que bypasea TODO chequeo de permisos. El sidebar ya ocultaba el item correctamente (`pagePermissions` usa `ADVISOR_VER_ENLACE`), pero la URL directa pasaba. Caso real reportado: SERVICIO_JEFE logueado entrando a `/panel-advisor?email=servicioalcliente.drive@gmail.com` — la página cargaba e intentaba buscar su email en ADVISORS (que no estaba) → "Error al buscar advisor". Si su email hubiera estado registrado en ADVISORS, o si pegaba el email de otro advisor, podría haber espiado paneles sin permiso. **Fix**: removida `/panel-advisor` de `alwaysAllowedRoutes` — ahora el middleware aplica `ROUTE_PERMISSIONS` que exige `ACADEMICO.ADVISOR.VER_ENLACE` (1 línea modificada). **Verificación exhaustiva pre-fix**: validados los 46 advisors activos en BD vs su rol y permiso `VER_ENLACE` — 45/46 pasan limpiamente (rol ADVISOR/COORDINADOR_ACADEMICO/ADMINISTRACION_JEFE/SUPER_ADMIN). 1 caso edge: Lucio Alejandro Coordinador (`l.merino@letsgospeak.cl`) está activo como advisor pero su rol es SERVICIO_JEFE (sin VER_ENLACE) — tiene 0 eventos futuros y 1 evento histórico de jul/2025, su rol será corregido manualmente. Roles que ahora quedan correctamente bloqueados al pegar URL: SERVICIO_JEFE, SERVICIO_ASIST, RECAUDO_ASIST, RECAUDOS_JEFE, APROBACION_*, COMERCIAL, TALERO, READONLY |
| `local` | feat: **Ctrl Horas — header adaptativo con foto y nombre del advisor**. `/dashboard/academic/control-horas` reemplaza el header simple (`⏰ + título`) por una versión adaptativa según rol: (1) **Si rol=ADVISOR** (consulta su propio panel): foto avatar + "¡Hola {primerNombre}!" + subtítulo "⏰ Control de Horas" (mismo formato que panel-advisor para consistencia visual). (2) **Si admin/otro rol** (consulta a otro advisor): foto avatar + "⏰ Control de Horas" como título + subtítulo con nombre completo del advisor seleccionado. Al cambiar advisor en el dropdown, el header se actualiza con la nueva foto+nombre. (3) **Avatar reutilizable**: componente local `AdvisorAvatar` que muestra `<img>` si hay `fotoUrl` o fallback con la inicial del primerNombre (mismo patrón que panel-advisor). Foto cargada vía presigned URL (`/api/postgres/materials/presigned?key=`, TTL 10 min). (4) **Sincronización**: `currentAdvisor` se mantiene actualizado vía 2 useEffects — admin lo deriva de `availableAdvisors` cuando cambia `advisorId`; ADVISOR lo guarda desde el fetch `by-email`. (5) **Tipo `AdvisorOption` ampliado**: agrega `primerNombre?`, `primerApellido?`, `fotoAdvisor?` (no se mapeaban antes; el dropdown solo necesitaba `nombre`/`email`). (6) **Cero impacto en backend**: la info ya está disponible en los endpoints existentes (`/advisors` y `/by-email/[email]`). (7) **Cero efecto en calendario, totales o modal de detalle** — cambio puramente decorativo en el header |
| `local` | feat: **Panel Advisor — selector de advisor para roles administrativos**. `/panel-advisor` ahora muestra un dropdown en el header para que usuarios NO-ADVISOR puedan saltar entre los paneles de distintos advisors sin escribir manualmente `?email=` en la URL. El cambio respeta el RBAC existente y mantiene la vista del ADVISOR exactamente igual. (1) **Gating por permiso, no por rol**: el dropdown aparece sii `hasPermission(ACADEMICO.ADVISOR.VER_ENLACE) && userRole !== 'ADVISOR'`. Se reusa el mismo permiso que ya gatea el acceso a la ruta `/panel-advisor` en el middleware (separado de `ACADEMICO.ADVISOR.LISTA_VER` que rige `/dashboard/academic/advisors`). Si en el futuro se le otorga `VER_ENLACE` a otro rol (COORDINADOR_ACADEMICO, SUPERVISOR, etc.) automáticamente verá el selector — cero cambio de código. La guarda extra `rol !== 'ADVISOR'` impide que un ADVISOR vea el dropdown aunque tenga el permiso (su email se resuelve desde sesión y no cambia). (2) **Auto-selección del primer advisor**: si un usuario con permiso entra a `/panel-advisor` sin `?email=` en la URL, se carga la lista (`GET /api/postgres/advisors`) y se hace `router.replace(`/panel-advisor?email=${first.email}`)` para preservar el bookmarking. Antes mostraba error "No se proporcionó email". (3) **Cambio sin efecto en ADVISOR**: el `useEffect` que carga la lista no se ejecuta si `canPickOtherAdvisor` es false → un ADVISOR nunca dispara ese fetch ni renderiza el dropdown. Su flujo es idéntico al anterior: `searchParams.get('email') || session.email` cuando rol=ADVISOR. (4) **Cero schema migration, cero endpoint nuevo** — solo modifica `src/app/panel-advisor/page.tsx` (4 cambios: imports, state+permiso, useEffect que carga lista, dropdown en JSX) |
| `local` | feat: **Ctrl Horas — control de horas por advisor con calendario mensual, modal de detalle estilo card, registro de sesión y resolución definitiva de zona horaria**. (1) **Schema migration idempotente** (`scripts/create-advisor-event-log-table.js`): ALTER `CALENDARIO` agrega `timeout VARCHAR(5)` (HH:MM, lo escribe el advisor), `notasadvisor TEXT` (distinto de `observaciones`=admin), `sesionCerrada BOOLEAN DEFAULT false`, `fechaCierreSesion TIMESTAMPTZ`. CREATE tabla nueva **`ADVISOR_EVENT_LOG`** (inmutable, sólo INSERTs) que guarda snapshots de eventos en estado **Canceled** (cambio de advisor) o **Suspended** (cancelación del evento), con `canceladoPor` (email admin) + `fechaTransicion` + `motivoTransicion`. APP_CONFIG seed `sesion_requiere_registro=true`. Tabla empieza vacía — sólo crece con cancelaciones futuras. (2) **Helper `withTransaction(fn)`** en [postgres.ts](src/lib/postgres.ts): wrapper BEGIN/COMMIT/ROLLBACK que garantiza atomicidad SQL real. Reservado para hooks donde un INSERT histórico debe ir junto a un UPDATE/DELETE de estado actual. (3) **Hooks transaccionales en `calendar.service`**: `updateEvent` detecta cambio de advisor A→B → valida límite max 2 reasignaciones por evento (3er intento lanza ValidationError), dentro de transacción hace INSERT log con estado=`Canceled` + UPDATE CALENDARIO limpiando `timeout`/`notasadvisor`/`sesionCerrada` para que B empiece fresco. `deleteEvent` SIEMPRE hace INSERT log con estado=`Suspended` antes de borrar (transaccional, sin límite). Endpoint `PUT/DELETE /api/postgres/events/[id]` extrae `actor` de la sesión NextAuth (no spoofeable) + `_motivoCambioAdvisor` (PUT body) o `?motivo=` (DELETE querystring). (4) **Service [advisor-event-log.service.ts](src/services/advisor-event-log.service.ts)**: `buildMonthlyView(advisorId, year, month)` une vigentes (CALENDARIO LEFT JOIN LATERAL ACADEMICA_BOOKINGS para `inscritos`/`asistieron`/`absent`) + históricos (LOG) en una respuesta combinada con `canEdit`/`editReason` calculados por evento. `updateAdvisorNotes(eventoId, sessionEmail, {timeout, notasadvisor, tz})` valida: email matchea ADVISORS, formato `HH:MM` militar (regex `^([01]\\d\|2[0-3]):[0-5]\\d$`), `timeout > horaInicio` derivado de `CALENDARIO.dia AT TIME ZONE tz` (no del string legacy `c.hora`), ventana temporal (NOW >= fechaEvento + 30 min), sesión no cerrada. `closeSession(eventoId, sessionEmail)` requiere `timeout` previamente guardado; si `notasadvisor` vacío → set `"no hubo novedades"`. (5) **3 endpoints nuevos**: `GET /api/postgres/advisors/[id]/control-horas?year=&month=` (vista mensual; advisor propio o admin), `PATCH /api/postgres/calendario/[eventoId]/notas-advisor` (recibe `tz` opcional del cliente), `POST /api/postgres/calendario/[eventoId]/cerrar-sesion`. Endpoint `GET /api/postgres/config/sesion-requiere-registro` expone el flag. (6) **Modales admin con checkbox de confirmación** ([EventModal.tsx](src/components/calendar/EventModal.tsx), [agenda-sesiones/page.tsx](src/app/dashboard/academic/agenda-sesiones/page.tsx)): al editar evento con cambio de advisor, modal yellow exige checkbox "Confirmo: {oldAdvisor} canceló y se reasigna a {newAdvisor}" + textarea de motivo opcional (botón Confirmar deshabilitado hasta marcar checkbox). Al eliminar evento, modal red con checkbox "Confirmo: esta sesión queda SUSPENDIDA para {advisor}" + textarea de motivo. Reemplaza el `window.confirm()` simple. (7) **Página completa `/dashboard/academic/control-horas`** (reemplaza stub): **vista calendario mensual** (grid 7×6 Lun-Dom, como panel-advisor) con bloques pequeños clickeables por día. Cada bloque tiene color según estado + tipo: 🔵 azul=SESSION, 🟢 verde=CLUB, 🟣 morado=WELCOME (vigentes); 🟡 amarillo=Suspended, 🔴 rojo=Canceled (históricos). Tarjetas de totales arriba: Sessions / Clubs / Welcome / Conducted / Canceled / Suspended del mes mostrado. Click en bloque → modal `EventDetailModal` con header del mismo color y card grande (4 secciones: Time In/Out, Asistencia Agend/Attend/Absen, Estado con `canceladoPor` para históricos, Observaciones). En vigentes, el advisor edita Time Out + Notas inline (botón "Editar Time Out / Notas" sólo aparece si rol=ADVISOR Y `canEdit=true`). Históricos siempre read-only. Selector de advisor sólo para admin; ADVISOR resuelve su `_id` vía `/api/postgres/advisors/by-email/[email]`. (8) **Botón verde "Registrar Sesión"** en `/sesion/[id]` al lado de "Ir a Zoom" — sólo visible para el advisor asignado, habilitado cuando NOW >= fechaEvento + 30 min. Modal pide Time Out + Notas (opcional, default "no hubo novedades"). Al confirmar: 2 requests en secuencia (PATCH notas-advisor + POST cerrar-sesion). Una vez cerrada muestra badge "✓ Sesión registrada". Si flag `sesion_requiere_registro=true` y NOW >= +30 min, `window.beforeunload` agrega aviso suave al salir sin cerrar. (9) **UX de captura de Time Out**: `<input type="time">` HTML5 (picker nativo del browser, sin errores de formato, multi-idioma compatible) con **auto-llenado de hora actual** del navegador al abrir el modal o entrar a editar — el advisor puede ajustar si cerró tarde. Recomendado en lugar de input texto libre para minimizar fricción (~2s en lugar de 5-10s) y eliminar errores de formato. (10) **FIX definitivo de zona horaria**: `CALENDARIO.dia` (timestamptz) es la **única fuente de verdad** para la hora del evento. `CALENDARIO.hora` (string text) es legacy — en datos históricos quedó guardado como hora UTC (no local) por eso mostraba "13:00" en vez de "08:00" Bogotá. Frontend usa helper `formatHoraLocal(iso)` que extrae `HH:MM` desde `dia` con TZ del navegador (igual que panel-advisor). Backend valida `timeout > horaInicio` derivando `horaInicio` con `TO_CHAR(dia AT TIME ZONE $tz, 'HH24:MI')` donde `$tz` viene del body PATCH (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Cada advisor ve la hora en SU TZ del navegador y validaciones son consistentes con lo que ve en pantalla. (11) **Permiso `ACADEMICO.CONTROL_HORAS.VER`** (ya existía en enum) ya estaba asignado al rol ADVISOR en `ROL_PERMISOS` — sin migración adicional. Validación de acceso en endpoint: matchea `session.user.email` con `ADVISORS.email` para `params.id` (rol ADVISOR sólo ve SUS datos; admin puede ver cualquiera). (12) **Reglas resumidas**: ventana edición = `+30 min desde inicio` hasta `Registrar Sesión` (luego solo lectura); límite cambios advisor = 2 por evento; cancelar evento = sin límite; vista vigentes en Panel Advisor Y Ctrl Horas; vista Canceled/Suspended SÓLO en Ctrl Horas. Tabla `ADVISOR_EVENT_LOG` arranca vacía — sin backfill de históricos previos |
| `local` | feat: **Ctrl Horas — control de horas por advisor con snapshot inmutable de cancelaciones**. Implementa el flujo completo "Control Horas" del advisor (`/dashboard/academic/control-horas`, ya existía como stub) con: (1) **Migración idempotente** (`scripts/create-advisor-event-log-table.js`): ALTER `CALENDARIO` agrega `timeout VARCHAR(5)` (HH:MM militar, lo escribe el advisor), `notasadvisor TEXT` (distinto de `observaciones`=admin), `sesionCerrada BOOLEAN DEFAULT false`, `fechaCierreSesion TIMESTAMPTZ`. CREATE tabla nueva **`ADVISOR_EVENT_LOG`** (inmutable, solo INSERTs) que guarda snapshots de eventos en estado **Canceled** (cambio de advisor) o **Suspended** (cancelación del evento), con `canceladoPor` (email admin) + `fechaTransicion` + `motivoTransicion`. APP_CONFIG seed `sesion_requiere_registro=true`. Tabla empieza vacía — solo crece con cancelaciones futuras. (2) **Helper `withTransaction(fn)`** en [postgres.ts](src/lib/postgres.ts): wrapper BEGIN/COMMIT/ROLLBACK que garantiza atomicidad SQL real. Reservado para hooks donde un INSERT histórico debe ir junto a un UPDATE/DELETE de estado actual (cualquier fallo → rollback completo). (3) **Hooks en `calendar.service`**: `updateEvent` detecta cambio de advisor A→B → valida límite max 2 reasignaciones por evento (3er intento lanza ValidationError), dentro de transacción hace INSERT log con estado=`Canceled` + UPDATE CALENDARIO limpiando `timeout`/`notasadvisor`/`sesionCerrada` para que B empiece fresco. `deleteEvent` SIEMPRE hace INSERT log con estado=`Suspended` antes de borrar (transaccional, sin límite). Endpoint `PUT/DELETE /api/postgres/events/[id]` extrae `actor` de la sesión NextAuth (no spoofeable) + `_motivoCambioAdvisor` (PUT body) o `?motivo=` (DELETE querystring). (4) **Service [advisor-event-log.service.ts](src/services/advisor-event-log.service.ts)**: `buildMonthlyView(advisorId, year, month)` une vigentes (CALENDARIO LEFT JOIN LATERAL ACADEMICA_BOOKINGS para `inscritos`/`asistieron`/`absent`) + históricos (LOG) en una respuesta combinada con `canEdit`/`editReason` calculados por evento. `updateAdvisorNotes(eventoId, sessionEmail, {timeout, notasadvisor})` valida: email matchea ADVISORS, formato `HH:MM` militar (regex `^([01]\\d\|2[0-3]):[0-5]\\d$`), `timeout > horaInicio`, ventana temporal (NOW >= fechaEvento + 30 min), sesión no cerrada. `closeSession(eventoId, sessionEmail)` requiere `timeout` previamente guardado; si `notasadvisor` vacío → set `"no hubo novedades"`. `isRegistroSesionRequerido()` lee flag de APP_CONFIG. (5) **3 endpoints nuevos**: `GET /api/postgres/advisors/[id]/control-horas?year=&month=` (vista mensual; advisor propio o admin), `PATCH /api/postgres/calendario/[eventoId]/notas-advisor` (advisor edita Time Out / Notas), `POST /api/postgres/calendario/[eventoId]/cerrar-sesion` (cierra sesión). Endpoint `GET /api/postgres/config/sesion-requiere-registro` expone el flag. (6) **Modales admin con checkbox de confirmación** ([EventModal.tsx](src/components/calendar/EventModal.tsx), [agenda-sesiones/page.tsx](src/app/dashboard/academic/agenda-sesiones/page.tsx)): al editar evento con cambio de advisor, modal yellow exige checkbox "Confirmo: {oldAdvisor} canceló y se reasigna a {newAdvisor}" + textarea de motivo opcional (botón Confirmar deshabilitado hasta marcar checkbox). Al eliminar evento, modal red con checkbox "Confirmo: esta sesión queda SUSPENDIDA para {advisor}" + textarea de motivo opcional. Reemplaza el `window.confirm()` simple del delete. (7) **Página completa `/dashboard/academic/control-horas`** (reemplaza stub): calendario mensual con cards estilo imagen pedida — header con fecha+hora+nivel+step+tipo+badge de estado (azul Conducted / verde Cerrada / rojo Canceled / gris Suspended), grid 4 columnas (Time con In/Out, Asistencia con Agend/Attend/Absen, Estado con `canceladoPor` para históricos, Observaciones editables). Botón "Editar Time Out / Notas" solo aparece si rol=ADVISOR Y `canEdit=true` (ventana temporal). Históricos siempre read-only. Selector de advisor solo para admin (uses `/api/postgres/advisors`); para ADVISOR resuelve su `_id` via `/api/postgres/advisors/by-email/[email]`. (8) **Botón verde "Registrar Sesión"** en `/sesion/[id]` al lado de "Ir a Zoom" — solo visible para el advisor asignado (no admin), habilitado cuando NOW >= fechaEvento + 30 min. Modal pide Time Out (HH:MM requerido, validado por regex) + Notas (opcional, default "no hubo novedades"). Al confirmar: 2 requests en secuencia (PATCH notas-advisor + POST cerrar-sesion). Una vez cerrada muestra badge "✓ Sesión registrada" sin posibilidad de re-editar. Si flag `sesion_requiere_registro=true` y NOW >= +30 min, `window.beforeunload` agrega aviso suave al salir sin cerrar. (9) **Permiso `ACADEMICO.CONTROL_HORAS.VER`** (ya existía en enum) verificado en `ROL_PERMISOS` para rol ADVISOR — sin acción adicional (ya lo tenía). Validación de acceso en endpoint: matchea `session.user.email` con `ADVISORS.email` para el `params.id` (rol ADVISOR solo ve SUS datos; admin puede ver cualquiera). (10) **Reglas resumidas**: ventana edición = `+30 min desde inicio` hasta `Registrar Sesión` (luego solo lectura); límite cambios advisor = 2 por evento; cancelar evento = sin límite; vista vigentes en Panel Advisor Y Ctrl Horas; vista Canceled/Suspended SOLO en Ctrl Horas. Tabla `ADVISOR_EVENT_LOG` solo crece con cancelaciones — no se backfillea histórico previo (arranca vacía) |
| `3bf63bd` | feat: **Usuarios Pegados — cabeceras ordenables (asc/desc)** en la tabla `/admin/scripts/usuarios-pegados`. Las 10 columnas (excepto Acción) son clickeables: 1er click ordena ascendente (↑ azul), 2do en la misma cabecera invierte a descendente (↓ azul), click en otra columna resetea a ascendente. Indicador ⇅ gris en cabeceras inactivas como pista visual. Comparador: strings con `localeCompare('es', { sensitivity: 'base', numeric: true })` (ignora acentos/mayúsculas, ordena números embebidos correctamente), números/booleanos orden natural, nulls/undefined siempre al final. Si no se hace click, se mantiene el orden por defecto del servidor (desfase desc, nivel asc). Nuevo componente `<SortableTh>` reutilizable dentro del archivo. Estado: `sortKey: SortKey \| null` + `sortDir: 'asc'\|'desc'` con función `handleSort()` que cicla |
| `c39bae3` | fix: **Usuarios Pegados — leer response al root, no en `json.data`**. La página `/admin/scripts/usuarios-pegados` siempre mostraba "0 totales" aunque el servicio devolviera 404 pegados. Causa: `successResponse()` en `api-helpers.ts` hace spread plano `{ success: true, ...data }` (NO `{ success: true, data: {...} }`); el cliente leía `json.data` (undefined) → `setData(undefined)` → renderizado con `total: 0`. Mismo bug que el ticker (commit `9548593`). Fix: leer `json.calculatedAt`, `json.rows`, `json.total`, `json.cached` directo del root del JSON. Igual ajuste para el modal de resultados de "Aplicar Cambio" (`json.summary`, `json.results`) |
| `local` | feat: **Usuarios Pegados (detector + reconciliador masivo) + Opción B en autoAdvanceStep**. Resuelve el problema sistémico documentado de "estudiantes pegados" — aquellos cuyo `ACADEMICA.step` está por debajo del step real calculado según sus bookings (404 detectados en producción, 32% de los 3.416 estudiantes activos con algún desfase). (1) **Opción B en `autoAdvanceStep`** ([student.service.ts:337-345](src/services/student.service.ts#L337)): la regla estricta `student.nivel === bookingNivel && student.step === bookingStep` se relaja **solo para Jumps** (Step 5/10/15/.../45). Si el booking es de un Jump del nivel actual, se permite continuar la evaluación aunque `student.step` no coincida — `aproboElJump()` y `getEffectiveStepNumber()` siguen decidiendo si avanza y a dónde, así que un Jump no aprobado jamás avanza. Para steps NORMALES la regla estricta sigue intacta. Agrega **guarda anti-retroceso** ([student.service.ts:425-429](src/services/student.service.ts#L425)): si `getEffectiveStepNumber` devuelve un step menor al actual (típico tras Clear Historic que borra bookings sin tocar step), NO retroceder. Cambio quirúrgico: 8 líneas en 1 archivo. No toca `aproboElJump`, `isCurrentStepComplete`, `getEffectiveStepNumber`, `changeStep`, ni los flujos de WELCOME→BN1, ESS, F3→MASTER/IELTS, ni special-nivel. (2) **Servicio `usuarios-pegados.service.ts`** con `findPegados()` (caché 30min, 1 query estudiantes + 1 query bookings + 1 query overrides — escalable a 3.416 estudiantes / 116k bookings) y `aplicarReconciliacion()` (concurrencia 5, máximo 100/operación, idempotente vía recálculo server-side). Por cada estudiante reconciliado: llama `changeStep` (sincroniza ACADEMICA + PEOPLE + USUARIOS_ROLES), escribe entrada en `ACADEMICA.cambioStepHistory` con motivo `[Reconciliación Usuarios Pegados] ...`, agrega comentario en `PEOPLE.comentarios` (areaRemitente=Académico, areaDestinatario=General). Status por estudiante: `ok`/`already_synced`/`error`. Skip silencioso si otro admin lo movió mientras tanto (re-cálculo en momento). (3) **Endpoints**: `GET /api/admin/scripts/usuarios-pegados?force=1` (lista cacheada) y `POST /api/admin/scripts/usuarios-pegados/aplicar` (bulk). Ambos gateados por `session.user.role IN (SUPER_ADMIN, ADMIN)`. `realizadoPor` se toma de la sesión NextAuth (no spoofeable). (4) **Página `/admin/scripts/usuarios-pegados`** ([page.tsx](src/app/admin/scripts/usuarios-pegados/page.tsx)) con tabla, filtros (búsqueda nombre/ID/contrato, nivel, plataforma, desfase mínimo, "solo casos limpios"), selección bulk (Marcar todos visibles / Marcar solo limpios / Desmarcar todo), botón **APLICAR CAMBIO (rojo)** + modal con motivo obligatorio + resumen por nivel + alerta visual si selección incluye `clrHistoric` u `overrides`, botón **Exportar CSV** (formato igual al de IELTS). Columnas: Checkbox, Nombre, ID, **Contrato**, Plataforma, Nivel, Step Actual, Step Real, **Desfase** (badge color por magnitud: gris ≤1, amarillo 2, naranja 3, rojo ≥4), **Clr Historic** (badge 🔧 SI o —), **Overrides** (badge `N ✓` / `N ✗` con tooltip detallando steps), Acción (link a `/student/[id]` nueva pestaña). Modal de resultados con summary de 5 estados + desglose colapsable. (5) **Permiso nuevo** `MantenimientoPermission.SCRIPTS_USUARIOS_PEGADOS` = `'MANTENIMIENTO.SCRIPTS.USUARIOS_PEGADOS'` registrado en `PERMISSIONS_CATALOG` (sección "Scripts"), en `ROUTE_PERMISSIONS` del middleware, en `pagePermissions` del sidebar. SUPER_ADMIN/ADMIN bypassean por `Object.values(MantenimientoPermission)` en `SUPER_ADMIN_PERMISSIONS` y por bypass `isRole` del `PermissionGuard`. (6) **Sidebar Mantenimiento → Scripts → Usuarios Pegados** (nueva pestaña). (7) **Script de diagnóstico standalone** `scripts/diagnostico-estudiantes-pegados.js` ejecutable como `node scripts/diagnostico-estudiantes-pegados.js` — solo lectura, idempotente, genera CSV con detalle. **Diagnóstico inicial en producción (mayo 2026)**: 404 pegados / 3.416 activos (12%). Por nivel: BN1=145, BN2=105, BN3=59, P1=41, otros<50. Por desfase: +1 step=142, +2=98, +3=78, +4=82, +5=4. De los 404, **0** tienen `chkclrhistoric≥1`, **0** tienen `checkinicianivel≥1`, **20** tienen overrides (todos `isCompleted=true`, ninguno freno). **384 casos completamente limpios** (sin flags) → seguros para reconciliación en bulk. **Caso paradigmático Javier Morales** (numeroId 83254667, BN3 Step 11→P1 Step 19 vía cambio manual admin): aprobó Jump BN3 Step 15 el 22-may pero `autoAdvanceStep` no lo movió porque el bulk del 06-may dejó `student.step` desincronizado. Con Opción B, el caso se hubiera resuelto automáticamente |
| `local` | feat: **suspensión administrativa auditable + badge "SUSPENDIDA" clickeable**. (1) **Schema migration idempotente** (`scripts/add-suspenddata-columns.js`): `PEOPLE.suspenddata JSONB` (objeto único con el último evento, no array) + `PEOPLE.suspendcount INTEGER DEFAULT 0`. Estructura: `{accion: 'INACTIVACION'\|'REACTIVACION', motivo, fecha, realizadoPor, realizadoPorNombre}`. (2) **Regla del badge reescrita** (`src/lib/contract-status.ts`): `isAdminSuspended()` ahora usa regla positiva — el badge se muestra **sii** `estadoInactivo=true AND suspenddata.accion='INACTIVACION'`. Elimina la blacklist anterior por `estado`/`fechaOnHold` que generaba falsos positivos en al menos 4 caminos (#3 expiración al login en panel-estudiante.service, #6 special-nivel bloqueo MASTER/IELTS/B2F/TOEFL, #8 WIX legacy inactivateBeneficiario, #9 botón Inactivar individual del beneficiario). Como `suspenddata` solo lo escriben los flujos administrativos del toggle, ningún otro origen de `estadoInactivo=true` (cron expire, OnHold, anulación, bulk bloqueo, special-nivel) dispara el badge. Registros legacy sin suspenddata tampoco muestran badge — correcto porque no fueron suspensión admin. (3) **Backend** (`student.service.toggleStatus`): firma cambiada a `(id, active, {motivo, realizadoPor, realizadoPorNombre})`. Persiste `suspenddata` (sobrescribe — solo último evento) e incrementa `suspendcount` solo al INACTIVAR (REACTIVACION no decrementa). Nuevo método `PeopleRepository.toggleStatusWithSuspendData()` con `COALESCE("suspendcount", 0) + 1`. Endpoint `POST /api/postgres/students/[id]/toggle-status` exige `motivo` (string no vacío) en body; `realizadoPor` se toma de la sesión NextAuth (`session.user.email`, no spoofeable desde body). Sigue sincronizando ACADEMICA + USUARIOS_ROLES como antes. (4) **Frontend `PersonAdmin.tsx`**: reemplaza `window.confirm` del toggle "Estado del Contrato" por **modal con textarea de motivo obligatorio** (verde si reactivar, amarillo si inactivar, botón confirmar deshabilitado si textarea vacío). El botón naranja "Inactivar" individual del beneficiario ahora pasa por el mismo modal y endpoint `/toggle-status` (antes hacía `PATCH /people/[id]` directo sin auditoría ni sync de USUARIOS_ROLES). Estado unificado `suspendTarget: {kind:'contract'\|'beneficiary', activate, beneficiary?}`. (5) **`SuspendidaBadge` clickeable**: dejó de ser elemento informativo y ahora abre modal con motivo destacado en amber + acción + fecha (formato local del navegador) + realizadoPor (con nombre y email si ambos disponibles) + contador total `suspendcount`. Fallback amigable si la persona está inactiva pero sin suspenddata (registros legacy). (6) **Propagación de campos**: `Person.suspenddata?/suspendcount?` y `Student.suspenddata?/suspendcount?` agregados a `types/index.ts` (nuevo type `SuspendDataEntry`); `AcademicaRepository.findProfileById()` agrega `p."suspenddata", p."suspendcount"` al SELECT (necesario para `/student/[id]`); endpoints existentes con `SELECT *` ya los exponen sin cambio. `PersonGeneral.tsx` y `StudentGeneral.tsx` pasan ambos campos al `SuspendidaBadge` |
| `local` | chore: backfill complementario **Credito por numeroCuotas>1**. Para cada contrato en FINANCIEROS con `numeroCuotas > 1`, marca `PEOPLE.plan = 'Credito'` a TITULAR + BENEFICIARIOS con plan NULL/vacío (no sobrescribe valores). Aplicado en producción: **4,298 filas actualizadas** (1,835 titulares + 2,588 beneficiarios + algunos huérfanos). Estado final de `PEOPLE.plan`: Credito 8,603 / Contado 1,103 / NULL 953 / 0 6 / Colaborador 4. Quedan **407 titulares pendientes** (los que no tienen registro en FINANCIEROS o tienen `numeroCuotas <= 1` sin valor en plan). Script: `scripts/backfill-plan-credito-by-cuotas.js` con `--apply` y `--override` opcional. CSV de auditoría: `plan-credito-by-cuotas.csv` |
| `local` | feat: **Tipo Plan (Contado/Credito/Colaborador)** propagado a PEOPLE/FINANCIEROS/PAGOS_TITULARES. (1) **Schema migration idempotente** (`scripts/migrate-plan-to-text.js`): `PEOPLE.plan` ya era TEXT (sin cambio); `FINANCIEROS.plan` agregada como TEXT (no existía); `PAGOS_TITULARES.plan` convertida `INTEGER → TEXT` preservando datos. (2) **Frontend**: paso 6 (Financiero) de `/dashboard/comercial/crear-contrato` agrega dropdown "Tipo Plan" al lado de "Número de cuotas" (grid 2 columnas) con opciones `Contado/Credito/Colaborador`; `PagoTitularWizard.tsx` cambia el input numérico "Plan" a dropdown con las mismas 3 opciones. (3) **Backend**: `/api/postgres/contracts` POST inserta `plan` en las 3 tablas (PEOPLE titular, FINANCIEROS, PAGOS_TITULARES cuota#0) con validación whitelist; `PATCH /api/postgres/people/[id]` rechaza valores no canónicos; `pagosTitularesService.create` y `update` agregan misma validación. (4) **Backfill aplicado en producción** (`scripts/backfill-plan-text.js`): regla `'1' → Contado`, `'2','3','4','12','13','14' → Credito`, `'100' → Colaborador`, `'0'/NULL → quietos`. Resultado: **5,409 PEOPLE + 1 PAGOS_TITULARES + 37 FINANCIEROS** actualizados. **2,195 filas pendientes** de revisión manual (titulares con plan NULL o '0'). CSVs generados: `plan-actualizados.csv` y `plan-pendiente-revision.csv`. Sin ruptura de código existente (verificado: ningún componente leía PEOPLE.plan como número antes) |
| `local` | fix: **`plataforma` perdida en bookings creados vía admin enroll**. El SELECT de estudiantes en `enrollment.service.ts` (líneas 56-67 y 76-89) quedó sin la columna `plataforma` tras el refactor del commit `daadaf2` que agregó el chequeo INACTIVO. Resultado: 110 bookings creados desde 2026-05-21 vía endpoint admin (`POST /api/postgres/events/[id]/enroll`) quedaron con `ACADEMICA_BOOKINGS.plataforma=NULL`. Self-bookings desde panel-estudiante (que usan `student-booking.service.ts`) no se afectaron. **Fix**: re-agregado `COALESCE(p."plataforma", a."plataforma") as "plataforma"` en ambos SELECTs. **Backfill aplicado en producción**: `scripts/fix-bookings-plataforma-null.js` restauró 81/110 (los recuperables vía PEOPLE matcheando por `_id` o `numeroId`). Los 29 restantes son bookings huérfanos sin PEOPLE asociado. Scripts: `inspect-bookings-plataforma-null.js` (diagnóstico read-only), `fix-bookings-plataforma-null.js` (backfill idempotente con dry-run/apply) |
| `local` | feat: nuevo ítem **"Control Horas"** en sidebar Académico. Página stub `/dashboard/academic/control-horas` con mensaje "En construcción". Permiso `ACADEMICO.CONTROL_HORAS.VER` (nuevo enum `AcademicoPermission.CONTROL_HORAS_VER`) registrado en `PERMISSIONS_CATALOG` (visible en `/admin/permissions`, sección Control Horas), mapeado en `pagePermissions` del sidebar + `ROUTE_PERMISSIONS` del middleware. SUPER_ADMIN/ADMIN bypassean automáticamente vía `PermissionGuard.hasFullAccess`. Otros roles requieren marcar el permiso explícitamente |
| `local` | feat: **indicador de festivos Chile/Colombia/Ecuador en los 3 calendarios principales**. Helper centralizado: `src/data/festivos.json` (diccionario `YYYY-MM-DD → [{c, n}]` con 2026-2027 precargados, ~60 entradas), `src/lib/festivos.ts` (`getHolidays(date)` lookup O(1), tipo `CountryCode = 'CL' \| 'CO' \| 'EC'`), `src/components/common/HolidayBadge.tsx` (renderiza indicador discreto + tooltip CSS al hover con `bg-gray-900/95`, prop `placement: 'top' \| 'bottom'` default `top`), `src/components/common/CountryFlag.tsx` (SVG inline de las 3 banderas, ~250 bytes cada una — reemplaza emoji `🇨🇱 🇨🇴 🇪🇨` que en Windows se renderizan como texto "CL"/"CO"/"EC" por falta de fuente con flags; Ecuador se distingue de Colombia con círculo central simulando escudo). **Regla visual**: 1 país con festivo → su bandera SVG; 2+ países → 🌎 (emoji genérico, renderiza OK en todos los SO). Aplicado en: (1) `CalendarView.tsx` (Calendario de Eventos mensual, `/dashboard/academic/agenda-sesiones`) — **además se cambió el inicio de semana de Dom a Lun** (`getDay+6)%7` para offset de lunes, weekDays array reordenado); (2) `agenda-academica/page.tsx` (vista semanal) — tooltip con `placement="bottom"` para que no quede tapado por los nombres de día (Lun/Mar/Mié/etc.); (3) `panel-advisor/page.tsx` (calendario mensual de advisor, ya iniciaba en Lun). Cero deps nuevas, cero impacto en BD/endpoints/permisos. Mantenimiento futuro: editar `festivos.json` 1×/año para agregar el año siguiente (10 min) |
| `local` | feat: **scope multi-tenancy por plataforma en módulo Recaudos**. El campo `USUARIOS_ROLES.plataforma` del usuario logueado define qué titulares + qué candidatos (asistentes/jefes) ve en `/dashboard/recaudos/asignacion`, `/dashboard/recaudos/gestion` y el modal "Asignar Ejecutivo de Recaudos" del `/person/[id]`. **Reglas** (resueltas server-side, no spoofeables del body): `SUPER_ADMIN`/`ADMIN` → ven todo (bypass); `plataforma=NULL` → ven todo (backward-compat); `plataforma='Internacional'` → todo; `plataforma='Chile'` → SOLO Chile (aislado); `plataforma='Colombia'` → todas EXCEPTO Chile ("el resto", incluye NULL); otras plataformas (Ecuador, Perú, etc.) → SOLO su plataforma. Match case-insensitive (`LOWER = LOWER`) para tolerar variantes legacy. **Helper centralizado** en `src/lib/recaudos-scope.ts` (`computePlataformaScope()`, `getSessionPlataforma()`, `buildPlataformaWhereSql()`) generan el SQL `AND ...` reutilizable. Aplicado en: (1) `PagosTitularesRepository.findTitularesAsignados` — filtra titulares por `p."plataforma"`; (2) `PagosTitularesRepository.findAllWithTitular` — mismo filtro para Centro de Validación; (3) `pagosTitularesService.listAsignaciones` — además filtra el set de `gestorIn` por scope (un jefe Chile solo ve gestores Chile); (4) `pagosTitularesService.listForGestion` — ahora acepta session + computa scope; (5) `/api/postgres/users/by-role` (dropdown del modal) — solo muestra candidatos con plataforma dentro del scope cuando se piden roles RECAUDOS. Jefes pueden auto-asignarse (su propia fila aparece en el dropdown porque su plataforma matchea su propio scope). NULL en columna evaluada: en filtro `include` → no matchea (oculto); en filtro `exclude` → visible (NULL es "fuera del set excluido"). Sin schema migration |
| `3c278a9` | chore: agregar columna `plataforma VARCHAR(50)` (nullable) a `USUARIOS_ROLES`. Script idempotente `scripts/add-plataforma-usuarios-roles.js` con `ADD COLUMN IF NOT EXISTS`. Sin backfill por defecto — flag `--backfill` opcional copia el valor desde `PEOPLE.plataforma` matcheando por email (`DISTINCT ON (LOWER(email))` ordenado por `_updatedDate DESC NULLS LAST`, solo afecta filas con plataforma NULL/vacía). Aplicado en producción: columna creada, todos los registros con `plataforma=NULL` esperando carga manual. Visible automáticamente en `/dblgs` (lee schema dinámicamente) |
| `local` | chore: **scripts de análisis de contratos vencidos** (sólo lectura). `scripts/inspect-finalcontrato-vencidos.js` produce resumen agregado de `PEOPLE` con `finalContrato < cutoff` (default 2026-05-19): cuántos están en `estado='FINALIZADA'`, `aprobacion='FINALIZADA'`, `estadoInactivo=true`; distribución por estado y aprobación; inconsistentes (vencidos sin alguno de los dos campos FINALIZADA). `scripts/export-finalcontrato-vencidos.js` genera 2 CSVs: `finalcontrato-vencidos-todos.csv` (todos los vencidos con campos completos) y `finalcontrato-vencidos-inconsistentes.csv` (con columna `diagnostico`: ninguno_finalizada/falta_estado/falta_aprobacion + columna `flag_inactivo` para detectar los que faltan inactivar). Usado como input para curar el subset de bloqueo masivo |
| `local` | fix+chore: **bug colateral en bloqueo cuando titular y beneficiario son la misma persona física**. Detectado tras bulk-bloqueo de 1460 contratos: 150 beneficiarios con extensión vigente quedaron con `ACADEMICA.estadoInactivo=true` y `USUARIOS_ROLES.activo=false` aunque su `PEOPLE.estadoInactivo` siguió en `false`. Causa: cuando un TITULAR comparte `numeroId` y `email` con su propio BENEFICIARIO (figura como su propio benef), bloquear el titular vía `UPDATE PEOPLE WHERE _id` + `UPDATE ACADEMICA WHERE numeroId` + `UPDATE USUARIOS_ROLES WHERE email` también inactiva indirectamente al beneficiario porque ACADEMICA/USUARIOS_ROLES son una sola fila por persona física. Visibles vía `isAdminSuspended()` (título rojo + badge ⚠️ SUSPENDIDA en `/student/[id]`). **Fix aplicado en producción**: `scripts/fix-bloqueo-side-effects.js` restauró 146 ACADEMICA + 145 USUARIOS_ROLES. **Patch preventivo** en `bloqueo-contrato.service.ts` (UI) y `scripts/bulk-bloqueo-from-csv.js`: antes de cada `UPDATE ACADEMICA` o `UPDATE USUARIOS_ROLES`, query verifica si existe OTRO `PEOPLE BENEFICIARIO` activo (`estadoInactivo IS NULL OR = false`) con mismo `numeroId`/`email` y `_id <> $current`. Si existe, se omite el UPDATE de la tabla compartida — el titular queda inactivo en PEOPLE pero la ACADEMICA/login de la persona física sigue activa porque hay otro benefiario que la necesita. Scripts diagnóstico/correctivos generados: `inspect-contrato.js` (debug por contrato), `inspect-bloqueo-side-effects.js` (detección de afectados), `fix-bloqueo-side-effects.js` (restauración idempotente, dry-run por defecto). CSVs: `casos-a-revisar.csv` (3 contratos: 1 titular vigente + 2 sin titular en BD), `bloqueo-side-effects.csv` (150 afectados). |
| `local` | feat: **"Bloqueo Contrato"** + **permisos individuales por ítem de Mantenimiento**. (1) Nueva página `/admin/bloqueo-contrato` (Mantenimiento > Usuarios, nueva pestaña, gateada por `MANTENIMIENTO.CONTRATOS.BLOQUEAR`). Recibe número de contrato → busca titular → valida `finalContrato < hoy` (regla estricta UTC date-only; muestra modal de inconsistencia si el titular aún está vigente) → busca beneficiarios del mismo contrato → para cada uno decide BLOQUEAR vs SKIP: si `finalContrato` coincide con titular o difiere y `< hoy` (extensión vencida) → bloquea; si difiere y `>= hoy` (extensión vigente) → respeta. Muestra resumen en dos paneles (rojo "Se bloquearán" / verde "NO se bloquearán — extensión vigente") con nombre, ID, fecha y motivo por persona. Confirmación modal antes de ejecutar. Acción aplica el patrón estándar de inactivación: PEOPLE (`estadoInactivo=true`, `aprobacion='FINALIZADA'`, `estado='FINALIZADA'`) + ACADEMICA (`estadoInactivo=true` by numeroId) + USUARIOS_ROLES (`activo=false` by email). Arquitectura limpia Service → API Route → Component: `bloqueo-contrato.service.ts` (`lookupByContrato`, `executeBloqueo`), `POST /api/admin/bloqueo-contrato/lookup` y `POST /api/admin/bloqueo-contrato/execute` con `handlerWithAuth`. Errores estándar (`ValidationError`/`NotFoundError`). (2) **Permisos individuales para TODOS los ítems de Mantenimiento**. Nuevos enum values en `MantenimientoPermission`: `BLOQUEAR_CONTRATO`, `CLEAR_HISTORIC`, `EDICION_CONTRATO`, `ENVIO_MENSAJES`, `CREAR_ROL`, `AVISOS_TICKER`, `AVISOS_BANNER`, `ACTUALIZAR_VIDEOS` (suma 9 con el existente `MIGRAR_CONTRATO`). Registrados en `PERMISSIONS_CATALOG` (visibles en `/admin/permissions`) y mapeados en `pagePermissions` del sidebar + `ROUTE_PERMISSIONS` del middleware. SUPER_ADMIN auto-incluye todos via `Object.values(MantenimientoPermission)` en `SUPER_ADMIN_PERMISSIONS`; SUPER_ADMIN/ADMIN bypassean automáticamente via `PermissionGuard.hasFullAccess`. Otros roles ven SOLO los ítems para los que estén marcados — el sidebar ya filtraba per-item (líneas 444-458 de DashboardLayout). Quedan SUPER_ADMIN-only por seguridad: Permisos (`/admin/permissions`, otorgaría escalación), Juegos (HTML estático). |
| `local` | feat+chore: **bloqueo de agendamiento a estudiantes INACTIVOS** (frontend + backend) y **normalización de `numeroId` PEOPLE/ACADEMICA**. (1) En el modal **"Agendar Nueva Clase"** del `/student/[id]` (Tab Académica): si `student.estadoInactivo === true` muestra banner; rojo bloqueante para no-administradores ("No se puede agendar… Consulte el Área de Servicio") y ámbar informativo para SUPER_ADMIN/ADMIN. Botón "Guardar Evento" deshabilitado + alert defensivo en `handleSaveNewEvent` si alguien bypasea por DOM. `StudentAcademic.tsx` declara `isStudentInactive`/`canBypassInactive`/`blockSchedulingByInactive` derivados de `userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN`. (2) **Defensa server-side** en `enrollment.service.enrollStudents`: las queries de carga de estudiantes ahora exponen `peopleEstadoInactivo` y `academicaEstadoInactivo` por separado; bloquea si CUALQUIERA es true. El bypass solo aplica si `sessionRole === 'SUPER_ADMIN'` o `sessionRole === 'ADMIN'`. **`sessionRole` se pasa exclusivamente desde el route handler** (`/api/postgres/events/[id]/enroll`) leyendo `(session?.user as any)?.role` — el body **no** puede spoofearlo. Aplica también al bulk-enroll desde la agenda del calendario (mismo endpoint). Mensaje devuelto: `"No se puede agendar para estudiante(s) con estado INACTIVO: NOMBRE (numeroId). Consulte el Área de Servicio."`. (3) **Scripts de normalización numeroId** (ejecutados en producción): `scripts/inspect-people-academica-numeroid.js` (read-only diagnóstico), `scripts/fix-numeroid-normalize-sync.js` (3 pasos: normaliza PEOPLE → normaliza ACADEMICA → sync caso D donde email único), `scripts/export-numeroid-inconsistencies.js` (5 CSVs para revisión manual). Regla de normalización: `UPPER(REGEXP_REPLACE("numeroId", '[.\\s\\-]', '', 'g'))` — quita puntos, dashes y espacios; uppercase de K (RUT chileno). Ejecutado con `--apply --skip-sync` (saltando Step 3 por casos dramáticos con IDs completamente distintos). Resultado: **235 PEOPLE + 143 ACADEMICA normalizados**. CSVs generados post-normalización: case C (189 emails compartidos), 299 benefiarios sin ACADEMICA, 77 ACADEMICA sin benef, 7181 duplicados PEOPLE, **16 candidatos case D pendientes para revisión manual** |
| `f7aa315` | feat: **badge "Estado:" en headers de `/person/[id]` y `/student/[id]`**. Nuevo componente compartido `src/components/common/EstadoBadge.tsx` que renderiza `PEOPLE.estado` con colores por valor: ACTIVA `bg-green-100`, On Hold `bg-sky-100`, CON EXTENSION `bg-emerald-200`, FINALIZADA `bg-red-500`, PENDIENTE `bg-orange-200`, RETRACTADO `bg-gray-300`, ANULADO `bg-red-900`, null/vacío `bg-black` "Null". Aplicado en `/person/[id]` después de "Vigencia: X" y en `/student/[id]` después de "Step: X" — etiqueta `Estado:` desambigua respecto al badge `aprobacion` (decisión comercial) del header derecho. En `/student/[id]` el contenedor cambia a `flex-wrap gap-x-4 gap-y-2` para soportar el badge inline. NO se quitan los badges calculados existentes (`❌ Finalizada`, `⏸️ OnHold`) — conviven con `Estado:` porque son fuentes distintas (tiempo real desde finalContrato vs DB de cron/extension/OnHold); ej. `CON EXTENSION` sólo lo refleja el badge nuevo |
| `ba2668a` | chore: **scripts para detectar y corregir celulares Chile con prefijo `57`**. Análisis detectó 17 registros con `plataforma='Chile'` cuyo celular comenzaba en `57` (prefijo Colombia) cuando debería ser `56` (Chile). Scripts: `scripts/inspect-chile-celular-57.js` (lectura), `scripts/fix-chile-celular-57.js` (general, quita el `57` con doble verificación `plataforma='Chile'` + `contrato LIKE '01-%'`), `scripts/fix-chile-celular-57-to-56.js` (targeted reemplazo `57→56` para 3 casos identificados manualmente como números chilenos: Cecilia Alvarez `57999738907→56999738907`, Fernando Barraza `57974951768→56974951768`, Natalia Castillo `57984862154→56984862154`). Ejecutado en producción: 3 corregidos, 14 restantes para revisión manual |
| `5224c83` | fix: **no doble-prefijar celular en edición de beneficiarios** (`PersonAdmin.tsx → handleSaveBeneficiary`). El concat de `celularPrefijo + celular` se aplicaba SIEMPRE — incluso en modo edición donde el input ya carga el celular completo. Resultado: cualquier intento de cambiar el celular de un beneficiario re-aplicaba `+57` y dejaba el valor original. Caso concreto: Karen Ximena Guzman Torres con `5756981272074` (doble prefijo 57+56+chileno) no se podía corregir. Fix: en modo edición (`isEditMode && editingBeneficiaryId`), `normalizedCelular` se construye sólo desde `beneficiaryData.celular` limpiado de no-dígitos, sin re-concatenar prefijo |
| `a0fd692` | feat: **máquina de estados `PEOPLE.estado` + nuevo valor `Retractado` + reglas OnHold/Extensión**. Modela el ciclo de vida operativo del contrato separado de `aprobacion` (decisión comercial). **Mapeo aprobacion → estado**: `Aprobado→ACTIVA`, `Pendiente→PENDIENTE`, `Retractado→RETRACTADO` (nuevo), `Contrato nulo/Devuelto/Rechazado→ANULADO`. **OnHold y Extensión son procesos independientes** con contadores separados: `extensionCount` sólo cuenta extensiones manuales (`extendByDays`/`extendToDate`), `onHoldCount` sólo OnHolds. `deactivateOnHold` sigue extendiendo `finalContrato` por días pausados pero ya NO toca `extensionCount` ni `extensionHistory` — la traza queda en `onHoldHistory`. **OnHold bloqueado** si `onHoldCount >= 2` (máx 2 holds por contrato) o `extensionCount > 0` (ya tuvo extensión manual). **Extensión manual** setea `estado='CON EXTENSION'`; cuando `finalContrato` venza, el cron lo pasa a `'FINALIZADA'`. **Aprobación** setea `estado='ACTIVA'`. **PATCH `/api/postgres/people/[id]`** mapea `aprobacion→estado` automáticamente si no viene `estado` explícito; rechaza con `ValidationError` cuando se intenta cambiar de `Aprobado` a `Contrato nulo`/`Devuelto`/`Rechazado` (esos sólo aplican pre-aprobación). El mensaje incluye contexto: OnHold activo, extensión activa, cantidad de beneficiarios con registro académico. **Frontend** (`PersonAdmin.tsx`): dropdown agrega 'Retractado' con ícono ↩️; oculta opciones pre-aprobación cuando el contrato ya está aprobado; `handleEstadoChange` bloquea client-side con alert explicativo; modal de confirmación muestra alerta amber adicional para `Pendiente`/`Retractado` post-aprobación recordando verificar OnHold/Extensión/beneficiarios activos. Misma política aplicada en `panel-estudiante.service` (auto-reactivación OnHold al login). Endpoint `/api/postgres/approvals/[id]` PUT acepta 'Retractado' y escribe ambos campos. Sin schema migration |
| `7449d64` | fix: Usuarios Asignados (`/dashboard/recaudos/asignacion`) ordena por `fechaContrato DESC` (contrato más reciente arriba) en vez de alfabéticamente por apellido. `primerApellido` queda como criterio secundario. NULLs al final |
| `ba18196` | feat: columna **"Estado Contrato" (Activo/Finalizada)** en tabla Usuarios Asignados. Lee `PEOPLE.estadoInactivo` (false=Activo verde, true=Finalizada rojo). `findTitularesAsignados` agrega `p."estadoInactivo"` y `p."aprobacion"` al SELECT con alias entrecomillados. Incluido en exportar Excel |
| `f3b42a4` | fix: **limpieza de ~35 errores preexistentes de TypeScript**. Al destapar la salida de `tsc` (tras arreglar un stray `}` en `edicion-contrato/page.tsx:98`), se materializaron varios errores ocultos por `ignoreBuildErrors:true`. Fixes: (1) `api-helpers.ts` HandlerFn/AuthHandlerFn ahora usan `NextRequest` (rutas tipadas con NextRequest fallaban por contravariancia); (2) `lib/postgres.ts` parseJsonbFields/stringifyJsonbFields tipan intermedio `any` para evitar TS2862 (generic T solo-lectura), Pool.on('error', err:any), nuevo shim `src/types/pg-overrides.d.ts` declarando `pg` (pg/esm/index.mjs sin tipos); (3) `lib/permissions.ts` cuatro funciones server-side `await getPermissionsForRole`, las "sync" usan `getPermissionsByRoleSync`; (4) `lib/custom-permissions.ts → getPermissionsForRole` async; (5) `config/roles.ts → roleHasPermission/countRolePermissions` async, `VER_ENLACE` renombrado a `ADVISOR_VER_ENLACE`; (6) `hooks/usePermissions.ts → isRole`/`isAnyRole` aceptan `Role \| string` (resuelve ~8 callers); (7) `middleware.ts` cast `'admin'` a string; (8) `forgot-password verify-identity/verify-otp`: `new Response()` → `NextResponse.json()`; (9) `advisors/[id]/stats` rows.map((r:any)); (10) `financial/route.ts` usa `buildDynamicWhere([])` y `clause` (no `whereClause`); (11) `students/contract/route.ts` handler signature `(request, _ctx, session)`; (12) `api/permissions/route.ts` matrix con Promise.all sobre async map; (13) `api/user/permissions await getPermissionsByRole`; (14) `admin/banner` onError envuelto en `{}`; (15) `admin/permissions` cast Permission a string en comparación 'undefined'; (16) `agenda-sesiones` `typeLabel` fuera del try, `inscritos ?? 0`; (17) `informes/usuarios` `cancelo?: boolean` en interface; (18) `infoacademic-user` labelFormatter `readonly any[]`; (19) `CalendarView`+`DailyAgenda` `_createdDate?` en interface; (20) `PersonAdmin` `edad`+`celularPrefijo` en setters. Sin cambios funcionales — sólo tipos. Resultado: `tsc --noEmit` exit 0 |
| `c22119d` | fix: stray `}` en `src/app/admin/edicion-contrato/page.tsx:98` que rompía TS check con `TS1381`. Era ruido de copy/paste — el ejemplo de ID `<code>prs_177...}</code>` no necesitaba llaves |
| `7504997` | feat: **Recaudos > Asignación** — nueva vista `/dashboard/recaudos/asignacion` "Usuarios Asignados" con filtro role-based server-side. Permiso nuevo `RecaudosPermission.ASIGNACION_VER` (`RECAUDOS.ASIGNACION.VER`). **Filtro por rol del logueado** (server-side, no se puede burlar desde cliente): SUPER_ADMIN/ADMIN ven todos; RECAUDOS_JEFE ve titulares cuyo gestor sea RECAUDOS_JEFE o RECAUDO_ASIST activos (puede refinar por gestor específico dentro del set); RECAUDO_ASIST ve sólo sus propios titulares (ignora cualquier `gestorRecaudo` que mande); otros roles → 403. Sólo titulares con `gestorRecaudo IS NOT NULL`. Arquitectura Repository → Service → API → Page: `pagos-titulares.repository.findTitularesAsignados()` con LEFT JOIN FINANCIEROS + 2 LATERAL sobre PAGOS_TITULARES (cuota#0 para tipoCartera; agregados de validados con numCuota>0 para ultimaFechaPago/ultimaCuotaPagada). `pagos-titulares.service.listAsignaciones(session, opts)` resuelve filtro role-based antes de tocar repo. Endpoint `GET /api/postgres/recaudos/asignaciones` gateado por `ASIGNACION_VER`. Página con 8 columnas: Titular (link a `/person/[id]?tab=financiera` nueva pestaña), Fecha Contrato, Fecha Último Pago, Contrato, Última Cuota Pagada, Saldo a la Fecha, Estado Cartera (badge color), **Día Vencimiento** (sólo el día del mes — UTC — de la última fecha de pago = cadencia del titular). Filtros: Buscar, Estado Cartera, Gestor (deshabilitado para RECAUDO_ASIST), Contrato desde/hasta. Paginación + Exportar Excel. Sidebar Recaudos → Asignación (newTab) |
| `31e2051` | feat: cuota#0 default `tipoCartera='normal'` al crear contrato + display de Estado Cartera/Cuotas Pagadas/Valor Cuota en pestaña Financiera de `/person/[id]`. Grid reorganizado a 3 columnas. **Cuotas Pagadas** (X/Y): conteo en vivo de pagos validados con `numCuota > 0` (cuota#0 inscripción no cuenta). **Valor Cuota**: `financial.tarifa` (=FINANCIEROS.valorCuota). **Estado Cartera**: badge con color por valor leído del registro cuota#0 (Normal verde, Prejurídico ámbar, Jurídico naranja, Castigada rojo). UI de edición de `tipoCartera` queda para después |
| `bdc1afe` | feat: campo **`tipoCartera VARCHAR(20) DEFAULT 'normal'`** en `PAGOS_TITULARES`. Valores: `normal`/`prejuridico`/`juridico`/`castigada`. Script `scripts/add-tipo-cartera-column.js` idempotente. Backend: `PagoTitular.tipoCartera` en interface, `UPDATABLE_FIELDS` incluye `tipoCartera`, `update()` valida que el valor esté en el set permitido (constante `TIPO_CARTERA_VALIDOS`). Sin UI de edición todavía — disponible vía `PATCH /api/postgres/pagos-titulares/[id]` |
| `7dd0676` | chore: scripts para detectar/corregir fechas TZ-shifted en PAGOS_TITULARES creadas antes del fix TZ-local (commit 1da263d). `scripts/inspect-pagos-dates.js` lista los últimos 20 pagos con flag visible si `fechaPago != (_createdDate AT TIME ZONE 'America/Bogota')::date`. `scripts/fix-pagos-tz-shifted-dates.js` corrige pagos cuya fechaPago esté 1-2 días por encima del local Bogotá. Sólo afecta registros con `_createdDate < '2026-05-21'` (corte del despliegue del fix). Dry-run por defecto; aplica con `--apply`. Ejecutado en producción: 2 registros corregidos del contrato `02-10575-26` |
| `fb96dfb` | feat: **Recibo de pago PDF con numeración `LGS-####` + permiso `PAGOS_RECIBO`**. Nueva columna idempotente `PAGOS_TITULARES.numeroRecibo VARCHAR(20)` (script `add-numero-recibo-column.js`). Permiso `PersonPermission.PAGOS_RECIBO` registrado en `PERMISSIONS_CATALOG` (sección Financiera). Repo `assignNumeroRecibo(id)` genera consecutivo atómico `LGS-####` (MAX+1, padded 4 dígitos); idempotente — si ya tiene numeroRecibo lo conserva. Service `generarRecibo(id)` valida `validado=true`, asigna numeroRecibo si falta, genera HTML inline con header indigo + logo LGS + bloque de campos (Recibí de, La suma de, Forma de pago, Cuota No., Periodo, Recibe conforme), llama a API2PDF (`https://v2018.api2pdf.com/chrome/html`), retorna `{pdfUrl, numeroRecibo}`. Footer: línea de firma + "Departamento de Recaudos · Let's Go Speak". Sin sección de contacto. Endpoint `POST /api/postgres/pagos-titulares/[id]/recibo` gateado por `PAGOS_RECIBO`. UI: botón índigo `DocumentTextIcon` en Acciones de la tabla Pagos del Titular (solo si `p.validado && permiso`); botón "Recibo" indigo en `/dashboard/recaudos/gestion` junto a "Validar" (solo en validados). Click → POST → abre `pdfUrl` en nueva pestaña |
| `0d198bc` | feat: filtro **"Gestor de Recaudo"** en Centro de Validación de Pagos. Repo `findAllWithTitular` acepta `gestorRecaudo` opcional; service y endpoint propagan. UI: dropdown adicional con los usuarios RECAUDO_ASIST/RECAUDOS_JEFE activos (carga via `displayUsers`). Grid de filtros pasa de 5 a 6 columnas |
| `17c3e2e` | fix: aliases del JOIN PEOPLE entre comillas para preservar camelCase en `findAllWithTitular`. PostgreSQL convertía `AS titular_primerNombre` (sin comillas) a snake_case minúscula `titular_primernombre`. El frontend leía `row.titular_primerNombre` (camelCase) → recibía undefined → columna Titular del Centro de Validación mostraba "undefined undefined". Fix: entrecomillar los 6 aliases del SELECT |
| `local` | feat: **`PAGOS_TITULARES` integración con crear-contrato + sync de saldo + protecciones server-side**. Esta entrada cubre toda la segunda iteración sobre el módulo de pagos. **Nuevas columnas (idempotentes):** `inscripcion NUMERIC(12,2)` (script `add-inscripcion-column.js`), `cuotasTotal INTEGER` y `plan` cambiado de `NUMERIC(12,2)` → `INTEGER` (script `add-cuotastotal-column.js`, `ALTER COLUMN plan TYPE INTEGER USING ROUND(plan)`). **Creación automática de cuota #0** desde `/api/postgres/contracts` POST: justo después del INSERT a FINANCIEROS, se crea un registro en `PAGOS_TITULARES` con `numCuota=0`, `validado=true`, `fechaValidacion=CURRENT_DATE`, `validadoPor`=email del comercial, `gestorRecaudo`=`USUARIOS_ROLES._id` del comercial (resuelto desde `titular.asesor` email; fallback al email crudo), `vlrTotalProg`=`form.totalPlan`, `valorCuota`=`form.valorCuota`, `valorPagado`=`form.pagoInscripcion`, `inscripcion`=`form.pagoInscripcion` (etiqueta semántica), `saldo`=`form.saldo`, `medioPago`, `fechaVencimiento`=`form.fechaPago`, `fechaPago`=hoy, `cuotasTotal`=`form.numeroCuotas`. Best-effort: si falla NO rompe la creación del contrato. **`syncFinancieroSaldo(idPeople)` (Opción 2: sólo validados cuentan)** en `pagos-titulares.service.ts`: suma `valorPagado + descuento` de pagos validados (no `inscripcion` para evitar doble conteo en cuota #0), parsea `FINANCIEROS.totalPlan` (texto legacy), calcula `nuevoSaldo = max(0, totalPlan − sumaValidados)` y actualiza `FINANCIEROS.saldo` (escribe **entero, sin decimales** — el frontend usa `parseCurrency` que asume `.` = separador de miles; un `.00` daría valores 100× más grandes). También actualiza `FINANCIEROS.cuotasPagadas` con `COUNT(*) WHERE validado=true AND numCuota > 0` (la cuota #0 = inscripción NO cuenta). Se invoca en `validar()` y al final del paso 5 de creación de contrato. **Wizard de registro mejorado** (`PagoTitularWizard.tsx`): auto-popula desde pagos existentes — `vlrTotalProg`/`valorCuota` se toman de cuota #0, `numCuota` = `max(numCuota) + 1`, `fechaVencimiento` = `último pago.fechaPago + 1 mes` (helper `addOneMonth` con manejo de overflow ene 31 → feb 28). Campos restringidos a sólo lectura (fondo gris, no editables): Fecha de Pago, Fecha de Vencimiento, Total del Programa, # Cuota, Valor Cuota, Saldo. Editables: Plan, Valor Pagado, Descuento, Medio de Pago, # Referencia, Pago Tercero, ID Tercero, Documentos. `MoneyInput` gana prop `readOnly?: boolean`. Label "Valor Total Programado" renombrado a "Total del Programa". `# Factura` se eliminó del wizard de registro — ahora se captura al validar. **Modal de validación con # Factura requerido**: `POST /api/postgres/pagos-titulares/[id]/validar` acepta `{ numeroFactura }` en body (obligatorio). Frontend abre un modal pequeño al hacer click en validar pidiendo el `# Factura` con aviso de irreversibilidad. Backend lo persiste en `PAGOS_TITULARES.numeroFactura` junto con `validado=true`, `fechaValidacion=CURRENT_DATE`, `validadoPor`. **Tabla en `/person/[id]` Financiera** ahora muestra columnas: `# Cuota · Fecha · Gestor · Valor Pagado · Descuento · Saldo · Validado · Fecha Validación · Validado por · # Factura · Acciones`. Gestor se resuelve contra una lista ampliada (`displayUsers`) que incluye `RECAUDO_ASIST`, `RECAUDOS_JEFE`, `COMERCIAL`, `SUPER_ADMIN`, `ADMIN` (para mostrar nombre del comercial en cuota #0); el dropdown de Asignar Ejecutivo de Recaudos sigue limitado a roles `RECAUDO_*`. Tarjeta "Cuotas Restantes" pasa de fórmula incorrecta `Math.ceil(saldo / valorCuota)` a `numeroCuotas − cuotasPagadas` (lee directo de `FINANCIEROS.cuotasPagadas` mantenido por sync). **Defensa server-side en endpoints**: nuevo helper `src/lib/api-permissions.ts` → `requirePermission(session, permission)` que carga permisos de `ROL_PERMISOS` directo del repositorio con cache 5 min (SUPER_ADMIN/ADMIN bypass). Aplicado en los 5 endpoints de pagos-titulares (GET list/POST require `PAGOS_VER`/`PAGOS_REGISTRAR`, GET id/PATCH require `PAGOS_VER`/`PAGOS_REGISTRAR`, DELETE requiere `PAGOS_ELIMINAR`, validar requiere `PAGOS_VALIDAR`). **Fix TLS DO Spaces en dev**: `src/lib/spaces.ts` ahora pasa un `NodeHttpHandler` con `httpsAgent: new https.Agent({ rejectUnauthorized: false })` cuando `NODE_ENV !== 'production'` o `DO_SPACES_INSECURE_TLS=1`. Evita error "unable to verify the first certificate" al subir archivos desde local. En producción la verificación TLS se mantiene estricta |
| `local` | feat: **`PAGOS_TITULARES`** — registro y validación de pagos por titular. Nueva tabla auto-creada `PAGOS_TITULARES` (26 columnas + 4 índices + FK a PEOPLE) con `scripts/create-pagos-titulares-table.js` (CREATE TABLE IF NOT EXISTS, idempotente). Campos: `_id`, `idPeople` (FK), `numeroId`, `gestorRecaudo` (USUARIOS_ROLES._id), `plataforma`, `pagoTercero` (texto libre — quién pagó en nombre del titular), `idTercero` (alfanumérico), `fechaPago` (DATE, default hoy), `fechaVencimiento` (DATE), `fechaValidacion` (DATE), `plan`/`vlrTotalProg`/`numCuota`/`valorCuota`/`valorPagado`/`saldo`/`descuento` (numeric), `medioPago`, `numeroReferencia`/`numeroFactura` (alfanuméricos), `documentosAdjuntos` (JSONB array de `{url, nombre, tipo, fechaSubida}`), `validado` (bool), `createdBy`, `validadoPor`, `_createdDate`, `_updatedDate`. **Regla saldo (calculada server-side)**: `saldo = max(0, valorCuota - valorPagado - descuento)` — clamp a 0 si negativo. **Auto-inherit en create**: `numeroId`/`plataforma`/`gestorRecaudo` se copian del titular si no se envían. **Validación**: una vez `validado=true` no se puede editar ni borrar. Arquitectura: `src/repositories/pagos-titulares.repository.ts` (extends BaseRepository con jsonbFields), `src/services/pagos-titulares.service.ts` (lógica saldo, inherit, lock validados), endpoints `GET/POST /api/postgres/pagos-titulares`, `GET/PATCH/DELETE /api/postgres/pagos-titulares/[id]`, `POST /api/postgres/pagos-titulares/[id]/validar`. UI: nueva sección "Pagos del Titular" en pestaña Financiera de `/person/[id]` (tabla con fecha, cuota, valorPagado, descuento, saldo, medio, refs, estado, acciones validar/eliminar). Componente `src/components/person/PagoTitularWizard.tsx` — modal de un solo paso con auto-save en localStorage (key `pago-titular-draft-{titularId}`, TTL 72h, banner "Continuar/Descartar"); inputs con máscara financiera; saldo calculado en vivo (read-only); subida de documentos vía el endpoint existente `/api/contracts/[id]/upload-url` (DO Spaces). 4 permisos nuevos en `PersonPermission` (`PAGOS_VER`/`REGISTRAR`/`VALIDAR`/`ELIMINAR`) + nuevo módulo `Module.RECAUDOS` con permiso `RecaudosPermission.GESTION_VER`. Nuevo grupo sidebar **Recaudos > Gestión** (icono `BanknotesIcon`) con stub page `/dashboard/recaudos/gestion` (en construcción) — gateado por `RECAUDOS.GESTION.VER` en sidebar + middleware + ROUTE_PERMISSIONS. `ids.payment()` agregado al generador (`pag_` prefix). Todos los permisos registrados en `PERMISSIONS_CATALOG`, `VALID_PERMISSIONS` (update route) y `SUPER_ADMIN_PERMISSIONS` |
| `local` | feat: campo **`gestorRecaudo`** en PEOPLE para asignar Ejecutivo de Recaudos al titular. Nueva columna `PEOPLE.gestorRecaudo VARCHAR(255)` (almacena `USUARIOS_ROLES._id` de un usuario con rol `RECAUDO_ASIST` o `RECAUDOS_JEFE`, solo aplica a `tipoUsuario='TITULAR'`). Script idempotente `scripts/add-gestor-recaudo-column.js` con `ADD COLUMN IF NOT EXISTS`. Nuevo permiso `PersonPermission.ASIGNAR_GESTOR_RECAUDO` (`PERSON.FINANCIERA.ASIGNAR_GESTOR_RECAUDO`) registrado en catálogo `/admin/permissions`. Nuevo endpoint `GET /api/postgres/users/by-role?roles=...&activeOnly=true` que lista USUARIOS_ROLES filtrados (usado por el dropdown). `PATCH /api/postgres/people/[id]` ahora acepta `gestorRecaudo` con validación backend: solo TITULAR, debe ser un `_id` existente con `activo=true` y rol válido; envío de `null`/`''` limpia la asignación. UI en `PersonFinancial.tsx`: botón "Asignar/Reasignar Ejecutivo de Recaudos" (purple, gateado por `ASIGNAR_GESTOR_RECAUDO`) en la esquina derecha del header "Resumen Financiero del Titular"; display del gestor asignado en la sección "Información de Pagos" (badge de rol + nombre + email), o "⚠️ Pendiente asignar Ejecutivo de Recaudos" si está null. Modal con dropdown de candidatos. Sin historial — solo guarda el último asignado |
| `local` | feat: botón **"Agregar Documentación"** dentro de los modales **Extender Vigencia** y **Activar OnHold** en `/student/[id]`. Nuevo componente compartido `src/components/student/UploadDocButton.tsx` (`size?: 'sm' \| 'md'`, `label?`, `onUploaded?`) que extrae el flujo de subida que vivía inline en `StudentGeneral.tsx`. Reutiliza los endpoints existentes `POST /api/contracts/[id]/upload-url` (sube a DO Spaces) y `POST /api/contracts/[id]/documents` (asocia URL+nombre+tipo al `PEOPLE.documentacion`). El archivo se sube inmediatamente al pickear (no transaccional con Confirmar) — si cancelas el modal el doc queda guardado, igual que el botón original. Footer del modal cambia de `justify-end` a `justify-between` con el botón pequeño a la izquierda y Cancelar/Confirmar a la derecha. Botón deshabilitado si no hay `peopleId` o ya hay archivos en cola |
| `local` | fix: botón **"Pausar Estudiante (OnHold)" / "Reactivar Estudiante"** ahora respeta el permiso `STUDENT.CONTRATO.ACTIVAR_HOLD`. Antes el botón se renderizaba siempre, ignorando el toggle de `/admin/permissions` aunque el permiso existía en el enum y catálogo. Aplica el mismo patrón que `EXTENDER_VIGENCIA` en `StudentContract.tsx`: si el rol no tiene el permiso → botón deshabilitado + mensaje "Sin permiso para pausar/reactivar estudiante". SUPER_ADMIN/ADMIN bypassean automáticamente vía `isRole`. Los modales internos no requieren gating porque solo se abren al hacer click en el botón ya gateado |
| `local` | fix: **same-moment exclusion en panel de reservas** usa timestamp completo en vez de solo `hora`. Causa: `findBookedHoursForDate` devolvía solo la hora del día (`'00:00'`, `'23:00'`) y el filtro JS comparaba `bookedHoursSet.has(evt.hora)` — esto hacía que un booking pasado a las `00:00` UTC bloqueara cualquier evento futuro a las `00:00` UTC de otro día (caso reportado: JOSÉ LEÓN tenía booking del TRAINING del 19-may 00:00 UTC y por eso no veía el GRAMMAR del 20-may 00:00 UTC en su panel). Fix: nuevo método `BookingRepository.findBookedTimestampsInRange(studentId, startISO, endISO)` que devuelve ISO UTC completo de cada booking dentro de la misma ventana que `findEvents`, y `getAvailableEvents` compara `bookedTimestampsSet.has(evtDate.toISOString())`. Conserva la regla "no doble booking en el mismo momento" sin colisionar horas iguales de días distintos. `findBookedHoursForDate` eliminado (no se usaba en otro lado) |
| `local` | feat: **APLICAR CONFIRMACIÓN** en páginas Exam. Intern. (IELTS/B2 First/TOEFL). Columna `CONFIRMADO` con checkbox por fila + botón rojo "APLICAR CONFIRMACIÓN" + modal con date picker. Al confirmar: los **CHECKED** reciben extensión de contrato `finalContrato = fechaBase + 100 días` (motivo en `extensionHistory`), quedan en su Step especial (47/48/49) activos, `USUARIOS_ROLES.activo=true`, y reciben WhatsApp ("{{primerNombre}}, te felicitamos. Estás inscrito en la preparación para el examen {{prueba}}. Tus sesiones comienzan el {{fechaBase}}. Te esperamos. Gracias por confiar en Let's Go Speak."); los **UNCHECKED** se promueven a `DONE Step 50` + bloqueo total (reutiliza `promoteToDoneAndBlock`). Tabla auto-creada `EXAM_INTERN_AUDIT` (CREATE TABLE IF NOT EXISTS): registra cada estudiante procesado con `accion='EXTENDIDO'\|'BLOQUEADO'`, fechas, estado WhatsApp, admin ejecutor. WhatsApp es best-effort (si falla, los cambios en BD se mantienen y queda registrado el error para reenvío manual). Nuevo `src/services/exam-intern.service.ts`, endpoint `POST /api/postgres/servicio/exam-intern/aplicar-confirmacion`, componente compartido `src/components/exam-intern/ExamInternPage.tsx` que las 3 páginas (`ielts/page.tsx`, `b2first/page.tsx`, `toefl/page.tsx`) ahora consumen como wrappers de ~12 líneas cada uno. 3 permisos nuevos (`EXAM_INTERN_{IELTS,B2F,TOEFL}_APLICAR_CONFIRMACION`) controlan la visibilidad de la columna CONFIRMADO + botón rojo. **Cambio de nomenclatura de `pruebainter`**: valores canónicos pasan de `IELTS/B2F/TOEF` a `IELTS/B2FIRST/TOEFL` (full names) en `resolvePruebaInterTarget`, radios de `SessionStudentsTab`, endpoint GET y service. Como solo había 1 fila con valor en BD (`'IELTS'`, sin cambio), no requiere migración de datos |
| `local` | feat: nuevo grupo **Exam. Intern.** bajo sidebar Servicio con 3 sub-ítems (IELTS funcional, B2 First y TOEFL en construcción). IELTS muestra usuarios de `ACADEMICA` donde `pruebainter='IELTS'` OR `step='Step 47'` con filtros (búsqueda apellido/ID, rango de fechas sobre `fechaPromocionEspecial`, plataforma) y columnas (nombre completo, celular, email, plataforma). Click en fila abre `/student/[id]` en pestaña nueva. Endpoint genérico `GET /api/postgres/servicio/exam-intern?prueba=IELTS\|B2F\|TOEF` con filtros opcionales — sirve también para los otros 2 niveles cuando se activen. Mensaje "No hay usuarios para la prueba IELTS" cuando la consulta retorna vacío. 6 permisos nuevos en `ServicioPermission`: `EXAM_INTERN_{IELTS,B2F,TOEFL}_{VER,EXPORTAR}` — la página requiere `*_VER` y el botón "Exportar CSV" se gatea con `*_EXPORTAR`. Registrados en `PERMISSIONS_CATALOG` (visible en `/admin/permissions`), en `ROUTE_PERMISSIONS` del middleware y en `pagePermissions` del sidebar. Los 3 ítems abren en nueva pestaña (`newTab: true`) |
| `local` | chore: convertir `fechaNacimiento` a `DATE` puro en `PEOPLE` y `ACADEMICA`. Tipo previo `timestamptz` con todos los valores almacenados a `00:00:00 UTC` (distinto al patrón `19:00 -05` de `finalContrato`). `scripts/alter-fechanacimiento-to-date.js` aplica `USING "fechaNacimiento"::date` (cast UTC directo, sin `AT TIME ZONE`) para preservar la fecha tal como está guardada — los 5415 valores en PEOPLE + 981 en ACADEMICA quedaron intactos. ADVISORS ya estaba en DATE desde antes. Script idempotente: detecta tipo actual + pre-check que la hora sea 00 UTC antes de alterar |
| `local` | fix: niveles especiales **IELTS/B2FIRST/TOEFL preservan su Step al bloquearse** por contrato vencido. Cambio sobre el fix anterior: antes los 4 niveles iban a DONE Step 50 cuando vencía el contrato. Ahora se diferencian: **MASTER** (no se eligió prueba internacional) → DONE Step 50 + bloqueo, **IELTS/B2FIRST/TOEFL** (prueba seleccionada) → **se queda en su Step 47/48/49** + bloqueo (`estadoInactivo=true`, `aprobacion='FINALIZADA'`, `USUARIOS_ROLES.activo=false`). Esto preserva la info de qué prueba internacional preparaba el estudiante: si en el futuro le extienden el contrato, retoma exactamente donde estaba. Nueva función `blockInCurrentSpecialStep` en `special-nivel.service.ts`; dispatcher `autoAdvanceSpecialNivel` ramifica por nivel; `autoAdvanceStep` branch de F3 Step 45 también aplica esta lógica post-promoción si el contrato ya estaba vencido al aprobar el Jump (caso Francisca: pruebainter='IELTS' + contrato vencido al aprobar → queda en IELTS Step 47 bloqueada, no en DONE). Francisca restaurada manualmente a IELTS Step 47 bloqueada |
| `local` | fix: simplificar regla de auto-promoción de niveles especiales (MASTER/IELTS/B2FIRST/TOEFL) → **solo `finalContrato` vencido manda a DONE**. Causa: la regla original de "100 días desde `fechaPromocionEspecial` OR `finalContrato < hoy`" hacía que FRANCISCA RODRIGUEZ (numeroId 184905795), tras aprobar F3 Jump con `pruebainter='IELTS'`, fuera promovida correctamente a IELTS Step 47 y un minuto después auto-promovida a DONE Step 50 porque su `finalContrato=2026-04-17` ya estaba vencido. La regla actual unifica los 4 niveles especiales: `autoAdvanceSpecialNivel` devuelve `promoteToDoneAndBlock` ⇔ `isContractExpired(finalContrato)` retorna true; en cualquier otro caso el estudiante se queda en el nivel asignado. Eliminado: helper `daysBetween`, constante `IELS_PROMOTION_DAYS`, y las 4 funciones `promoteFromX` (consolidadas en el dispatcher). `fechaPromocionEspecial` se sigue grabando en `autoAdvanceStep` al rutear desde F3 Step 45 pero solo para auditoría. CLAUDE.md y comentario en `student.service.ts` actualizados |
| `local` | chore: normalizar prefijo de club en `step` (datos sucios Wix). Causa: muchos eventos/bookings tenían `nombreEvento = "TRAINING - Step 7"` pero `step = "Step 7"` (sin prefijo del club), lo que rompía cualquier lógica que detectara tipo de club leyendo el `step`. `scripts/normalize-club-step-prefix.js` copió `nombreEvento → step` cuando el step estaba plano. Tocó: 97 eventos en `CALENDARIO` (solo `tipo='CLUB'`; los 2 SESSION con nombre de club quedan para revisión manual) + 1649 bookings en `ACADEMICA_BOOKINGS` (excluyendo `tipo='COMPLEMENTARIA'` que son quizzes IA, no clubs). Distribución por club: TRAINING, KARAOKE, LISTENING, GRAMMAR, PRONUNCIATION, CONVERSATION. Idempotente — filtro `step NOT LIKE '%-%'` evita reescritura |
| `local` | feat: botón **"Ver Contrato"** en `/person/[id]` con modal de solo lectura. Nuevo permiso `PersonPermission.VER_CONTRATO` (`PERSON.INFO.VER_CONTRATO`), registrado en `PERMISSIONS_CATALOG` (visible en `/admin/permissions`, sección "Información General"). Nuevo componente `src/components/person/PersonContractViewer.tsx` (client) que reutiliza los endpoints existentes (`/api/postgres/contracts/[titularId]`, `/api/postgres/contracts/template?plataforma=`, `/api/consent/[titularId]/status`) y el helper `fillContractTemplate`. Resuelve el `titularId`: si `person.tipoUsuario === 'TITULAR'` usa `person._id`, si es `BENEFICIARIO` usa `person.titularId`. El modal expone únicamente un botón **Cerrar** — sin Imprimir / Solicitar firma / Enviar PDF (esos quedan exclusivos del flujo comercial). Deshabilitado con tooltip cuando la persona no tiene `plataforma` o no se puede resolver el titular. SUPER_ADMIN/ADMIN bypassean por `PermissionGuard.isRole`. Sin cambios de API ni schema |
| `local` | fix: regla de **Jump Step estricta + múltiples intentos**. Causa raíz: el comparador para steps Jump (5, 10, 15…) usaba `clasesDelStep.some(c => c.noAprobo === true)` y bloqueaba la completitud si CUALQUIER booking del step había sido marcado `noAprobo=true`, sin importar si en intentos posteriores el estudiante aprobaba. Caso real: Wilkaris Ramírez (numeroId 32593763) reprobó BN2 Step 10 dos veces y aprobó al cuarto intento — el autoadvance no la promovió y un admin tuvo que cambiar el step manualmente. Fix: nuevo helper `aproboElJump(c)` aplicado en `student.service.ts` (`isCurrentStepComplete`), `progress.service.ts` (diagnóstico "¿Cómo voy?") y `student-booking.service.ts` (`getEffectiveStepNumber`). Regla nueva: Jump aprueba cuando AL MENOS UN booking cumple `(asistio||asistencia)=true AND participacion=true AND noAprobo!==true AND cancelo!==true`. Adicionalmente, `isExitosa` para steps normales ya NO acepta `participacion=true` como señal — solo `asistio||asistencia`. Mensajes diagnósticos del Jump reordenados: aprobado → sin clase → todas canceladas → falta asistir → falta participación → no aprobó. CLAUDE.md actualizado con la nueva regla |
| `local` | chore: normalizar `PEOPLE.vigencia` anómala con `extensionCount = 0` a `'12'`. `scripts/normalize-vigencia-anomalous-with-zero-extensions.js` corrigió 17 filas con valores como `'3'`, `'4'`, `'193'`, `'312'`, `'350'` que tenían `extensionCount=0` (sin extensión real registrada) — errores de captura sin justificación de negocio. Complementa `normalize-vigencia-without-extensions.js` (que cubrió `extensionCount IS NULL`). Idempotente |
| `local` | chore: normalizar `PEOPLE.vigencia` con texto/espacios a `'12'`. `scripts/normalize-vigencia-text-to-12.js` reemplazó 97 filas con valores como `'12 meses'`, `'12 '`, `'12 MESES'`, `'13 meses'` (residuos de captura Wix) por la forma canónica `'12'`. Filtra cualquier valor que no sea `^[0-9]+$`. Idempotente |
| `local` | chore: corregir años desfasados en `PEOPLE.finalContrato`. `scripts/fix-finalcontrato-year-too-high.js` cambió 116 filas con año > 2027 (rango 2028–2052) a año 2026 conservando mes y día — errores de captura de la migración Wix. Idempotente |
| `local` | chore: reemplazar `PEOPLE.vigencia` `'11'` y `'13'` por `'12'` (146 filas, todas eran '13'). `scripts/normalize-vigencia-11-13.js` — off-by-one típicos de captura. Idempotente |
| `local` | chore: backfill `PEOPLE.finalContrato` desde `fechaContrato + 12 meses`. `scripts/backfill-finalcontrato-from-fecha.js` rellenó 851 filas (`UPDATE … WHERE finalContrato IS NULL AND fechaContrato IS NOT NULL`). **Estado final: 10546/10546 (100%) con `finalContrato`**. Cierra la cobertura completa de fechas de contrato — `inicioContrato`, `fechaContrato` y `finalContrato` ahora están al 100% |
| `local` | chore: normalizar `PEOPLE.vigencia` a `'12'` donde `vigencia > 12` AND `extensionCount IS NULL`. La vigencia estándar es 12 meses; valores mayores solo deben existir si hubo extensiones reales (`extensionCount > 0`). `scripts/normalize-vigencia-without-extensions.js` corrigió 368 filas con valores como '13', '24', '92', '5057' que provenían de la migración Wix sin extensiones asociadas. Las 598 filas con `vigencia > 12` Y `extensionCount > 0` se conservan (extensiones legítimas). Idempotente |
| `local` | chore: backfill final de `PEOPLE.inicioContrato` desde `_createdDate` (fecha de creación del registro). `scripts/backfill-iniciocontrato-from-createddate.js` rellenó las 520 filas restantes que no tenían ni `inicioContrato` ni `finalContrato` (residuos sin contrato real de la migración Wix). Cast `(_createdDate AT TIME ZONE 'America/Bogota')::date` para evitar off-by-one. **Estado final: 10547/10547 (100%) con `inicioContrato`** |
| `local` | chore: backfill `PEOPLE.inicioContrato` derivado de `finalContrato - 12 meses` (vigencia estándar). `scripts/backfill-iniciocontrato-from-final.js` rellenó 217 filas (`UPDATE … WHERE inicioContrato IS NULL AND finalContrato IS NOT NULL`). Estado final: 10027/10547 con `inicioContrato`. 520 filas restantes no tienen `finalContrato` tampoco (registros incompletos sin contrato real, no se pueden derivar) |
| `local` | chore: backfill `PEOPLE.fechaContrato` desde `inicioContrato` para registros migrados de Wix. `scripts/backfill-fechacontrato-from-inicio.js` rellenó 9212 filas (`UPDATE … WHERE fechaContrato IS NULL AND inicioContrato IS NOT NULL`). Idempotente; respeta los 52 conflictos preexistentes donde ambos campos no nulos diferían (conserva `fechaContrato` original). Estado final: 10297/10547 (97.6%) filas con `fechaContrato`. Los 250 restantes no tienen ninguna fecha en ninguno de los dos campos |
| `local` | chore: convertir `PEOPLE.inicioContrato` (campo legacy Wix de inicio de contrato) a `DATE` puro. `scripts/normalize-iniciocontrato.js` normalizó 7519 filas (todas con hora distinta de medianoche Bogotá) y alteró la columna. Sin cambios de código — el campo solo se lee para display (`person/[id]/page.tsx`). Nota: `inicioContrato` (poblado en 9810 filas, mayoría WIX) y `fechaContrato` (poblado en 1085 filas, mayoría POSTGRES) son redundantes — significan lo mismo (fecha de firma) en distintas eras de la plataforma. Ambos ya están normalizados |
| `local` | chore: convertir `fechaContrato` (firma del contrato) a `DATE` puro en PEOPLE y ACADEMICA. Mismo síndrome que `finalContrato`: timestamptz con valores almacenados a hora local que el cliente puede ver como ±1 día según su zona. `scripts/normalize-fechacontrato.js` normalizó 1066 filas en PEOPLE + 1 en ACADEMICA y alteró ambas columnas a DATE. Sin cambios de código necesarios — el campo solo se muestra en UI (`StudentContract.tsx`, `person/[id]/page.tsx`) y se escribe en INSERT (`/api/postgres/contracts/route.ts`, `/api/admin/migrar-contrato/route.ts`). Tras el cambio, el valor mostrado es idéntico desde cualquier zona del usuario |
| `local` | fix: **expiración de contratos timezone-independent**. Causa raíz: `PEOPLE.finalContrato` era `timestamptz` con valores almacenados a hora local Bogotá (ej `2026-05-12 19:00 -05` = `2026-05-13 00:00 UTC`); el cast `::date` en server UTC daba el día siguiente y los chequeos de expiración (cron + `panel-estudiante.service.ts` + `auth-postgres.ts` + `special-nivel.service.ts`) nunca veían el contrato como vencido. Fix integral: (1) `scripts/normalize-finalcontrato.js` normalizó 5718 filas a medianoche Bogotá; (2) `scripts/alter-finalcontrato-to-date.js` cambió el tipo de columna a `DATE` puro (sin hora ni TZ) — idempotente, valida tipo actual antes de alterar; (3) nuevo helper `src/lib/contract-expiry.ts` con `isContractExpired(finalContrato)` y `CONTRACT_EXPIRED_SQL('"col"')` que aplican la regla "fecha pura + gracia +1 día": vencido sólo cuando el día UTC es ≥2 días después de `finalContrato`. Esto garantiza que ningún usuario sea bloqueado mientras "todavía sea el último día del contrato" en su zona horaria — Chile, Colombia, Ecuador, Perú, España, Australia o cualquier otra. (4) auth-postgres agrega defensa en profundidad: si `USUARIOS_ROLES.activo=true` pero el contrato está vencido, bloquea login con `EXPIRED` para rol `ESTUDIANTE`. (5) Todos los puntos (cron `expire-contracts`, `panel-estudiante.service.ts`, `special-nivel.service.ts`, `auth-postgres.ts`) ahora usan el mismo helper. Caso DANIEL MARTY (`finalContrato=2026-05-12`, hoy 2026-05-13 UTC): día gracia → puede entrar; 2026-05-14 → bloqueado |
| `local` | feat: permisos granulares de **exportar/imprimir** en Informes — 8 nuevos códigos en `InformesPermission` (`ASISTENCIA_EXPORTAR`, `PROGRAMACION_EXPORTAR`, `ADVISORS_EXPORTAR`, `USUARIOS_EXPORTAR`, `USUARIOS_IMPRIMIR`, `CONTRATOS_EXPORTAR`, `PLANTA_EXPORTAR`, `ESTADISTICAS_EXPORTAR`). Quedan automáticamente válidos vía `Object.values(InformesPermission)` en `VALID_PERMISSIONS`/`SUPER_ADMIN_PERMISSIONS` y se registran en `PERMISSIONS_CATALOG` (visibles en `/admin/permissions`, sección Informes). Botones gateados con `<PermissionGuard>` en: 5 páginas Asistencia (sesiones-clubes, clubes ×2, complementarias, welcome-session, x-pais → `ASISTENCIA_EXPORTAR`); `EventReportTable`+`EventReportFilters` → `PROGRAMACION_EXPORTAR`; `AdvisorScheduleTable`+`AdvisorScheduleFilters`+`AdvisorResumenReportPage` → `ADVISORS_EXPORTAR`; `usuarios` + `infoacademic-user` (CSV) → `USUARIOS_EXPORTAR`; `infoacademic-user` (Imprimir/PDF) → `USUARIOS_IMPRIMIR`; `estadisticas` + `estadisticas/horarios` → `ESTADISTICAS_EXPORTAR`. SUPER_ADMIN/ADMIN bypassean automáticamente por `PermissionGuard` (`isRole`). Los permisos `CONTRATOS_EXPORTAR`/`PLANTA_EXPORTAR` quedan disponibles aunque esas páginas todavía no tengan botón de export |
| `a9075c9` | fix: `resumen/route` — `tz` era usada en `detailParams` pero nunca declarada en el handler; causaba `NULL` en `AT TIME ZONE $3` y error 500 al filtrar por advisor |
| `2f15244` | feat: Advisors Resumen — **modo detalle** al filtrar por advisor: sin advisor → tabla consolidada por advisor; con advisor → sesiones individuales con Fecha/Hora/Tipo/Nivel/Step/Agendados/Asistentes/No Asistieron/% Asistencia + modal de usuarios por sesión. API retorna `sessionDetails[]` adicional cuando `advisorId` presente |
| `97ceb48` | fix: sidebar — remover ítem "Usuarios" duplicado de Informes > Asistencia (apuntaba a `/dashboard/informes/usuarios`, igual que el ítem directo en Informes > Usuarios); sin impacto en ruta, página, API ni permisos |
| `7d70b34` | chore: orden pedagógico en `NIVELES.orden` (WELCOME=1, ESS=2, BN1..BN3=3-5, P1..P3=6-8, F1..F3=9-11, MASTER=12, IELS=13, B2FIRST=14, TOEFL=15, DONE=16). `findAll()` ya ordenaba `ASC NULLS LAST`, así que TODOS los dropdowns que consumen `/api/postgres/niveles` quedan ordenados consistentemente (Actualizar Material/Videos, EventModal, etc.). Script idempotente `scripts/seed-niveles-orden.js` |
| `9fdda78` | feat: **condiciones auto-avance** MASTER/IELS/B2FIRST/TOEFL → DONE Step 50. MASTER: `finalContrato < hoy`. IELS/B2FIRST/TOEFL: 100 días desde `fechaPromocionEspecial` (nueva columna ACADEMICA, idempotente con `ADD COLUMN IF NOT EXISTS`) **o** `finalContrato < hoy`. Helper `promoteToDoneAndBlock()` actualiza ACADEMICA+PEOPLE (`estadoInactivo=true`, `aprobacion='FINALIZADA'`) y bloquea login en USUARIOS_ROLES. Triggers: (1) `autoAdvanceStep` al guardar asistencia/evaluación; (2) `resolveStudentFromSession` al login (antes del check generic de contrato); (3) `changeStep` cuando admin promueve manualmente a `Step 50`/`DONE`. `autoAdvanceStep` escribe `fechaPromocionEspecial=NOW()` al rutear de F3 Step 45 a un nivel especial. Sin cambios en material/video (`findAll` ya retorna los 4) ni en agendamiento semanal (límites 2/3 son los defaults) |
| `1ab00c2` | chore: seed `MASTER`/`IELS`/`B2FIRST`/`TOEFL` en NIVELES (Steps 46/47/48/49); script idempotente `scripts/seed-special-niveles.js`; `nombreNivel = code` para los 4 |
| `e7461bf` | fix: Reiniciar Nivel — `NIVELES_NO_PERMITIDOS` ampliado con `MASTER`/`IELS`/`B2FIRST`/`TOEFL` para evitar reinicio de estudiantes en niveles post-F3 con condiciones de promoción específicas |
| `cd7aaa7` | fix: `booking.repository.findByEventIdWithStudentDetails` — ejecutar `ensurePruebaInterColumn()` antes del SELECT para evitar 500 cuando la columna `pruebainter` aún no existía en producción |
| `a8606f4` | feat: **Pruebas Internacionales** en Step 45 — al aprobar F3 Step 45 (Jump) promueve a uno de 4 niveles según selección en `ACADEMICA.pruebainter`: NULL → MASTER Step 46, IELS → IELS Step 47, B2F → B2FIRST Step 48, TOEF → TOEFL Step 49. Nuevo `special-nivel.service.ts` con dispatcher y 4 funciones `promoteFrom*` (devuelven null hasta definir condiciones por nivel). `autoAdvanceStep` agrega guarda para no auto-avanzar dentro de niveles especiales. `SessionStudentsTab` renderiza box "Pruebas Internacionales" con radios cuando es Step 45. `academic-record` API persiste `pruebainter` (con `ADD COLUMN IF NOT EXISTS`). `BookingRepository.findByEventIdWithStudentDetails` retorna `studentPruebaInter` para precargar selección. Pendiente: crear NIVELES MASTER/IELS/B2FIRST/TOEFL en BD |
| `8423a30` | fix: `/api/nuevo-usuario/[id]` GET — resuelve nombre real desde PEOPLE (priorizando BENEFICIARIO) cuando `ACADEMICA.primerNombre` es valor `tipoUsuario` (TITULAR/BENEFICIARIO) en lugar del nombre real (registros migrados de Wix); evita ver "TITULAR, tu registro ya fue completado" en pantalla |
| `c8f4a36` | fix: actividades-complementarias — instrucciones leen `nivel` y `step` desde la respuesta del API de elegibilidad en vez del URL param; elimina texto duplicado "Step Step 18"; eligibility API retorna `nivel` y `step` del registro ACADEMICA del estudiante en sesión |
| `7615366` | fix: (1) `StudentGeneral` — `toast.success()` en botones WhatsApp de bienvenida y Crear solo perfil (antes solo `console.log`); (2) actividades-complementarias: instrucciones con nivel+step dinámicos desde URL, intentos restantes con texto singular/plural, mensaje a SAC si 0 intentos; (3) ProgressReport: pasa `nivel` en link a complementaria; (4) complementaria.service: steps > 44 inelegibles |
| `0c3c62d` | feat: Advisors **Resumen** — dashboard consolidado: totales por advisor × tipo (Sesiones/Jumps/Training/Essential/Welcome). API `GET .../advisors/resumen` (CTE con CASE WHEN que clasifica cada evento); filtros fecha + advisor + tipoFiltro; 5 KPI cards, stacked bar Recharts, donut distribución, tabla con badges de color y % asistencia, export Excel |
| `86ac63a` | feat: Advisors — **Essential** (ítem entre Welcome y Resumen): sesiones nivel ESS (`tipo='SESSION' AND nivel='ESS'`); mismo `AdvisorScheduleReportPage` con `reportType='essential'`; sidebar, pagePermissions y middleware actualizados |
| `ce23015` | feat: Advisors — **Jumps** (step%5=0), **Training** (CLUB ILIKE 'TRAINING-%'), **Clubes** (CLUB excl. Training, agrupa por tipo de club), **Welcome** (nivel=WELCOME). Mismo componente `AdvisorScheduleReportPage` con `reportType` prop; `advisor-report.config.ts` define título, labels, colores y filtros por tipo; filtros dinámicos (nivel vs tipoClub); KPIs/ranking/charts con labels configurables |
| `a96bed7` | feat: Informes Advisors — **Sesiones** (`/dashboard/informes/advisors/sesiones`, nueva pestaña). Solo SESSION (excluye Jumps step%5=0, Clubs, Welcome). API `GET /api/postgres/reports/programacion/advisors` (CALENDARIO+ADVISORS+BOOKINGS, tz-aware); API `GET .../sesion-detalle` (usuarios agendados por evento). 7 componentes `AdvisorSchedule*`: filtros, 7 KPIs, ranking dinámico (por advisor o por nivel), 4 gráficos Recharts + heatmap, tabla exportable, modal detalle con asistencia por usuario. Modo dual: sin advisor → ranking+charts por advisor; con advisor → por nivel |
| `56dc24d` | fix: `updateEvent` — al editar un evento CLUB, el regex extraía solo el número del step descartando el prefijo (`"TRAINING - Step 3"` → `"Step 3"`), lo que se propagaba a `ACADEMICA_BOOKINGS.step` y hacía que `isTrainingClub()` fallara. Fix: usar `nombreEvento` directamente como `step` (preserva prefijo completo para SESSION y todos los tipos de CLUB) |
| `1759d6d` | fix: `PersonContact` — `telRefUno`/`telRefDos` no existen en PEOPLE; corregido a `telefonoRefUno`/`telefonoRefDos`; además Referencia Familiar apuntaba a campos de Ref1 en lugar de Ref2 |
| `76cf422` | feat: sidebar Programación — elimina ítems obsoletos (Sesiones/Clubes/Welcome stub) y sus entradas en pagePermissions + middleware; renombra: `Calendario Sesiones–Jumps`→`Sesiones - Jumps`, `Calendario Training–Clubs`→`Training - Clubs`, `Calendario–Welcome`→`Welcome` |
| `f6de71d` | feat: Training-Clubs — filas 3-4 reorganizadas: Fila 3: Clubes por Hora · Ranking Training · Ranking Clubes; Fila 4: Donut circular · Heatmap Training (naranja) · Heatmap Clubes (verde) |
| `10f7301` | feat: heatmaps separados por tipo — Sessions-Jumps: heatmapSesiones (azul) + heatmapJumps (rojo); Training-Clubs: heatmapTraining (naranja) + heatmapClub (verde); `HeatmapGrid` acepta prop `palette`; 4 paletas definidas: BLUE/RED/ORANGE/GREEN |
| `8b91221` | feat: Calendario Sesiones-Jumps — layout 3 filas con charts split: Fila 1: Donut SESSION+JUMP · Sessions por Nivel · Sessions por Hora; Fila 2: Sessions Asistencia vs Inscritos · Jumps por Nivel · Jumps por Hora; Fila 3: Jumps Asistencia vs Inscritos · Ranking Advisors Sessions · Ranking Advisors Jumps + Heatmaps; API split SESSION/JUMP rows para charts independientes |
| `ae7e813` | feat: Calendario Training-Clubs — rediseño layout 3 filas: Fila 1 Training (nivel/hora/asistencia), Fila 2 Clubes (tipo/nivel/asistencia), Fila 3 Ranking+Heatmaps; API split TRAINING/CLUB rows; componente `EventReportCharts` refactorizado con helpers `NivelChart`/`HoraChart`/`AsistenciaChart`/`RankingChart`/`HeatmapGrid` |
| `4289c12` | feat: Training-Clubs — desglose por tipo de club: `buildClubsPorTipo()` extrae sub-tipo de `nombreEvento` (`"LISTENING - Step 7"` → `"LISTENING"`); chart "Clubes por Tipo" con barras horizontales; KPIs row al inicio con Training total + cada tipo de club |
| `15af015` | fix: hora local por timezone del cliente — API computa `horaLocal` via `TO_CHAR(dia AT TIME ZONE $tz, 'HH24:MI')`; frontend envía `tz=Intl.DateTimeFormat().resolvedOptions().timeZone`; corrige datos Wix con `hora` en UTC; filtro 06:00–22:00 y heatmap aplican sobre hora local; chart nivel con altura dinámica; heatmap paleta sky con contraste legible |
| `c43302b` | feat: módulo Informes Programación — 3 nuevas vistas de calendario avanzado bajo Informes > Programación: **Calendario Sesiones–Jumps**, **Calendario Training–Clubs**, **Calendario–Welcome**. Arquitectura: API `GET /api/postgres/reports/programacion/eventos-informe` (CALENDARIO JOIN ADVISORS+BOOKINGS, retorna kpis/charts/table); componentes reutilizables `EventReportPage/Filters/Kpis/Charts/Table` en `src/components/informes/`; configuración dinámica por `reportType`; 6 gráficos Recharts (tipo, nivel, hora, asistencia vs inscritos, ranking advisors, heatmap día×hora); tabla exportable con `exportToExcel()`; detección derivada JUMP (step%5=0) y TRAINING (nombreEvento LIKE 'TRAINING-%'); sidebar+middleware+pagePermissions actualizados con `INFORMES.PROGRAMACION` |
| `1e99bf0` | feat: `nuevo-usuario` + `student-setup` — (1) nuevo-usuario: email readonly, confirmar clave con ojo toggle, API guarda `perfilActualizado=NOW()` en USUARIOS_ROLES; (2) student-setup: carga perfil al montar, muestra `detallesPersonales`/`hobbies` solo si están vacíos en ACADEMICA (requeridos si se muestran), `update-profile` API guarda esos campos en ACADEMICA |
| `61fd72b` | feat: Perfil modal — botón **Actualizar mis datos** aparece al pie solo si `USUARIOS_ROLES.perfilActualizado` es `null` (API `/me` ahora incluye ese campo); `student-setup` refactorizado: email pre-cargado desde sesión y `readOnly`, contraseña + confirmación siempre visibles con ojo toggle, botón Cancelar regresa al panel |
| `c10249f` | feat: Borrado Histórico — (1) agrega comentario a `PEOPLE.comentarios` (`areaRemitente='Académico'`/`areaDestinatario='General'`) al ejecutar Clear Historic; (2) tarjeta en Tab Contrato muestra Bookings/Complementarias/Step Overrides en líneas separadas, mismo estilo que Reiniciar Nivel; (3) página `admin/clear-historic`: reemplaza `confirm1`+`confirm2` por un único modal Resumen con datos completos (estudiante, conteos, motivo, autorizadoPor) — mismo patrón que Reiniciar Nivel |
| `ab1bb23` | feat: panel-estudiante — botón **Perfil** en navbar (después de Instructivos); modal muestra avatar con foto/iniciales, nombre completo, badge nivel/step y campos: numeroId, email, celular, fechaNacimiento, domicilio, ciudad, plataforma; icono `UserCircleIcon` |
| `55ea3a4` | fix: Reiniciar Nivel — agrega comentario a `PEOPLE.comentarios` con `areaRemitente='Académico'` / `areaDestinatario='General'` al ejecutar `inicializarNivel()`; mismo patrón que Cambio Step Auditado; texto: `[Reiniciar Nivel] {nivel}, {stepAnterior} → {stepNuevo}. {motivo}. Autorizado por: {autorizadoPor}` |
| `f90c5dc` | fix: deshabilitar redirección student-setup — `panel-estudiante/layout.tsx` reducido a pass-through; estudiantes acceden directamente al panel sin solicitud de actualización de datos al login |
| `2c96056` | feat: sidebar Mantenimiento — ahora visible para roles con `MantenimientoPermission` (ej: `MIGRAR_CONTRATO`); SUPER_ADMIN no se ve afectado (sale en primer check); no-SUPER_ADMIN con permiso ve solo los ítems que tiene permiso (Migrar Contrato); resto de Mantenimiento (Permisos, Avisos, Juegos, Material) permanece SUPER_ADMIN only |
| `6d282ac` | fix: student-setup — botón "Más tarde" quedaba en loop porque `router.push()` reutilizaba respuesta RSC cacheada del redirect del layout; cambiado a `window.location.href` para forzar request HTTP fresco con la cookie `student_setup_skipped=1`; agrega estado visual "Redirigiendo..." |
| `ead90d4` | fix: Cambiar Step — corregir "Step Step N" error; `PUT /step` espera número puro y agrega "Step " internamente (`Step ${newStep}`); modo simple envía `"35"`, modo auditado envía `"Step 35"` a `/cambio-step-auditado` que llama `changeStep()` directamente sin prefijo adicional |
| `29bdf7c` | feat: Tab Contrato — tarjetas con datos reales de ACADEMICA; renombra "Diagnóstico Avance Nivel" → "Gestión Académica Nivel"; API `GET /students/[id]/academic-audit` retorna `cambioStepHistory`, `inicianivel`, `clrhistoric` (columnas creadas con `ADD COLUMN IF NOT EXISTS`); cada tarjeta muestra: detalle, autorizadoPor y fecha en una línea cada uno; "Sin registros" cuando el campo es null/vacío |
| `2725bd3` | fix: Cambiar Step — modal original integra toggle 'Cambio Académico'; OFF=cambio simple como antes (`PUT /step`); ON=expande campos motivo+autorizadoPor+comentario y llama `POST /cambio-step-auditado`; selector de steps muestra 'NivelCod — Step N'; StudentTabs revierte a id `change-step` → abre StudentChangeStep |
| `4c2a6d7` | fix: Reiniciar Nivel — API `/inicializar-nivel` corregía 403 porque `session.user.permissions` siempre es vacío (las permissions no se guardan en JWT); eliminado check; acceso controlado por frontend. Renombrado "Inicializar Nivel" → "Reiniciar Nivel" en modal, submenú, tarjeta placeholder y catálogo de permisos; el código interno `STUDENT.ACADEMIA.INICIALIZAR_NIVEL` no cambia |
| `cc7f449` | feat: Cambio Step Auditado — botón 'Cambiar Step' en submenú Académica usa `StudentCambioStepAuditado`; modal 3 pasos: (1) selector step + motivo + autorizadoPor + comentario opcional; (2) confirmación; (3) resultado; API `POST /students/[id]/cambio-step-auditado` ejecuta `changeStep()` + guarda en `ACADEMICA.cambioStepHistory` (JSONB, `ADD COLUMN IF NOT EXISTS`) + agrega comentario a `PEOPLE.comentarios` (areaRemitente=Académico, areaDestinatario=General); permiso `STUDENT.ACADEMIA.ASIGNAR_STEP` |
| `ff150a6` | fix: Extender Vigencia — cualquier rol con permiso `STUDENT.CONTRATO.EXTENDER_VIGENCIA` puede extender aunque el contrato esté Finalizado; elimina restricción `contratoFinalizado` del botón; fix TS `canOnHold` declarado sin uso y comparación string/number en vigencia |
| `4b0efbf` | fix: Días restantes en Tab Contrato mostraba `—` — `vigencia` llega como string (`COALESCE ::text`) desde API; reemplaza `typeof === 'number'` por `Number()` |
| `f3a16ca` | fix: SUPER_ADMIN y ADMIN bypass `contratoFinalizado` en botón Extender Vigencia |
| `d1ab7b3` | fix: `usePermissions` — SUPER_ADMIN y ADMIN retornan `true` en `hasPermission/hasAllPermissions/hasAnyPermission` sin depender de `ROL_PERMISOS`; `config/roles.ts` agrega `InformesPermission` y `MantenimientoPermission` a `SUPER_ADMIN_PERMISSIONS` |
| `223e457` | fix: `StudentContract` verifica permiso `STUDENT.CONTRATO.EXTENDER_VIGENCIA` con `usePermissions`; corrige llamada a `StudentOnHold` con props individuales |
| `d380c56` | fix: tarjeta Relación con el Estudiante — fallback titular muestra "SIN TITULAR" (gris itálico) cuando no se resuelve |
| `b0b9405` | fix: titular en tarjeta Relación — doble fallback: (1) `GET /api/postgres/people/[titularId]` para contratos nuevos; (2) `GET /api/postgres/contracts/search?pattern=[contrato]&exact=true` para datos Wix sin titularId |
| `20396c3` | fix: Tab Contrato layout 4 filas — Fila 1: 2 tarjetas (Extensión+OnHold); Fila 2: 3 tarjetas (Diagnóstico+Inicialización+Borrado, `md:grid-cols-3`); Fila 3: Últimos Agendamientos full-width con 3 columnas internas; Fila 4: Relación con el Estudiante full-width |
| `3b90d05` | feat: tarjeta "Relación con el Estudiante" en Tab Contrato — texto titular responsable financiero + 4 sub-tarjetas: Contrato, Fecha inicial (`fechaContrato`), Vigencia/fecha final (`finalContrato` en rojo si vencida), Beneficiario con ID; datos reales del beneficiario consultado |
| `6071aea` | feat: rediseño Tab Contrato `/student/[id]` — Extensión de Vigencia y Estado OnHold con `items-stretch` para igual altura; grupos 1–6 con mock data eliminados; reemplazados por grid 2×2 con 4 tarjetas: Diagnóstico Avance Nivel (placeholder azul), Inicialización Nivel (placeholder naranja), Borrado Histórico (placeholder rojo), Últimos Agendamientos (índigo); tarjeta Últimos Agendamientos carga en tiempo real desde nueva API `GET /api/postgres/students/[id]/ultimos-agendamientos` (3 queries paralelas: última sesión asistida, último jump aprobado, último club asistido — cada una con fecha, hora, advisorNombre via JOIN ADVISORS, nivel, step) |
| `5187e0b` | feat: Clear Historic — auditoría obligatoria y proceso solo una vez; nuevas columnas ACADEMICA: `chkclrhistoric` (INTEGER) y `clrhistoric` (JSONB) creadas con `ADD COLUMN IF NOT EXISTS`; lookup retorna `alreadyDone` y `previousAudit`; delete valida `chkclrhistoric >= 1` antes de ejecutar, acepta `motivo` + `autorizadoPor`, guarda auditData en ACADEMICA; página agrega paso `audit` (modal con motivo + autorizadoPor + fecha auto) entre `found` y `confirm1`; estado `blocked` muestra datos de ejecución previa con mensaje "solo una vez" |
| `9980581` | fix: Inicializar Nivel — bloquear proceso para niveles ESS, WELCOME y DONE; `getInicializarNivelInfo` retorna `nivelBloqueado=true`; modal muestra pantalla amber "Nivel no permitido"; servidor valida y lanza `ValidationError` si nivel no permitido |
| `8d2e309` | fix: tabla asistencia `/student/[id]` — columna Advisor mostraba "Cargando..." indefinidamente para bookings legacy de Wix; `findByStudentId` agrega `LEFT JOIN "ADVISORS"` y retorna `advisorNombre = COALESCE(adv."nombreCompleto", b."advisor")`; `StudentAcademic` usa `advisorNombre` como fuente primaria (fallback: mapa local → ID crudo); dropdown de filtro por advisor también resuelto con nombres del servidor |
| `bf8859c` | feat: Inicializar Nivel — nuevo ítem en submenú Académica de `/student/[id]`; modal 3 pasos: (1) info nivel/step/bookings a borrar, (2) auditoría (motivo + autorizadoPor + fecha automática), (3) confirmación con opción Abandonar; columnas `inicianivel` (JSONB) y `checkinicianivel` (INTEGER) creadas con `ADD COLUMN IF NOT EXISTS` en ACADEMICA; proceso solo se puede ejecutar una vez (checkinicianivel >= 1 → pantalla bloqueada con historial de la ejecución); elimina ACADEMICA_BOOKINGS del nivel actual, resetea step al primer step del nivel (desde NIVELES table), sincroniza PEOPLE; permiso `STUDENT.ACADEMIA.INICIALIZAR_NIVEL` en RBAC grupo BENEFICIARIO → Tab Académica |
| `ba40eb2` | fix: actualizar-material — subtítulo incluye nota "esta acción genera registros de auditoría" |
| `6217ca4` | feat: sidebar Informes — filtrar sub-grupos individualmente por permiso: Asistencia→INFORMES.ASISTENCIA, Programación→INFORMES.PROGRAMACION, Advisors→INFORMES.ADVISORS, Planta→INFORMES.PLANTA, Estadísticas→INFORMES.ESTADISTICAS; Usuarios/InfoAcademic User→INFORMES.USUARIOS; Contratos→INFORMES.CONTRATOS |
| `0d5cdc1` | fix: infoacademic-user — retirar porcentaje de barras de progreso del programa; texto muestra solo `X ses · Y/Z steps · N días` |
| `130b653` | fix: infoacademic-user — eje X gráfica semanal convierte ISO week a fecha legible (ej: '17 Feb'); total de sesiones sobre cada columna con LabelList personalizado; barras de progreso muestran sesionesEfectivas/completedSteps/totalSteps/diasEnNivel (API agrega sesionesEfectivas); heatmap con etiquetas de mes encima y L/M/X/J/V a la izquierda; tooltip con fecha completa |
| `5739139` | feat: Migrar Contrato — wizard 8 pasos en Mantenimiento → Usuarios para crear titular + beneficiarios con número de contrato manual; permiso `MANTENIMIENTO.CONTRATOS.MIGRAR` (`MantenimientoPermission`) registrado en RBAC; flujo de beneficiarios iterativo con modal "¿Agregar otro?"; validaciones: vigencia 1–12, ID solo alfanumérico, teléfonos solo dígitos, email con regex, mínimo 1 beneficiario; campos de dinero con máscara `$ 1.050.000`; Módulo `MANTENIMIENTO` agregado al `Module` enum y catálogo de permisos; `InformesPermission` agregado al union type `Permission` |

### Inicializar Nivel — Detalles de implementación

- **Permiso**: `STUDENT.ACADEMIA.INICIALIZAR_NIVEL` — asignable desde `/admin/permissions`
- **Columnas DB nuevas en ACADEMICA** (auto-creadas con `ADD COLUMN IF NOT EXISTS`):
  - `checkinicianivel` INTEGER — contador; `NULL`=no ejecutado, `1`=ejecutado (bloqueado)
  - `inicianivel` JSONB — auditoría: `{fecha, motivo, autorizadoPor, realizadoPor, nivel, stepAnterior, stepNuevo, bookingsEliminados}`
- **API**: `GET /api/postgres/students/[id]/inicializar-nivel` (preflight) + `POST` (ejecutar)
- **Qué borra**: `DELETE FROM ACADEMICA_BOOKINGS WHERE (idEstudiante=$1 OR studentId=$1) AND nivel=$2`
- **Primer step del nivel**: consulta `NIVELES` ordenando por número extraído del step (`REGEXP_REPLACE`)
- **Archivos**: `src/app/api/postgres/students/[id]/inicializar-nivel/route.ts`, `src/components/student/StudentInicializarNivel.tsx`, `src/repositories/academica.repository.ts` (resetNivel, ensureColumns), `src/repositories/booking.repository.ts` (countByNivelAndStudent, deleteByNivelAndStudent), `src/services/student.service.ts` (getInicializarNivelInfo, inicializarNivel)

## Recent Changes (April 2026)

| Commit | Description |
|---|---|
| `c899502` | fix: `findUpcomingByStudentId` usa `COALESCE(c."step", ab."step")` — card azul del panel-estudiante muestra nombre completo del step (ej: "F1 - TRAINING - Step 32"); revierte "Next Club" a "NEXT SESSION" |
| `317cb71` | fix: panel-estudiante — título del card azul muestra "Next Club" o "Next Session" (revertido) según el tipo real del próximo evento (antes era siempre "Next Session" hardcodeado) |
| `1698929` | fix: forgot-password — comparación de celular flexible: acepta con o sin indicativo de país (`57XXXXXXXXXX` vs `XXXXXXXXXX`); el masking siempre muestra 8 asteriscos sin importar la longitud |
| `e705911` | feat: pantalla Actualización de Datos para estudiantes (`/student-setup`) — campos: email, celular, fechaNacimiento, domicilio, ciudad, contraseña (opcional), foto; botón "Más tarde" no marca `perfilActualizado` (vuelve a preguntar en el siguiente login); `reutilizable via Server Layout` |
| `4e0cbf5` | fix: informe X País — JOIN con ACADEMICA para resolver `plataforma` cuando `booking.plataforma` es null; elimina "Sin plataforma" en bookings PANEL_EST/POSTGRES/COMP; `bookEvent` acepta y propaga `plataforma` del estudiante |
| `dfe2795` | fix: verificación de celular en forgot-password solicita número completo con indicativo (sin signos, solo dígitos) en vez de últimos 4 |
| `a7722cb` | feat: flujo "¿Olvidaste tu contraseña?" — 4 pasos con modales en login: (1) verificar email en ACADEMICA+USUARIOS_ROLES, (2) últimos 4 del ID + celular → OTP WhatsApp, (3) código OTP, (4) nueva contraseña (6-10 chars, toggle ver/ocultar); modal "datos no coinciden" → redirect login; actualiza USUARIOS_ROLES.password y ACADEMICA.clave |
| `b1dc7d0` | feat: `/nuevo-usuario` captura `domicilio`, `ciudad`, `fechaNacimiento` y foto (presigned → `lgs-bucket/fotos/`) — actualiza PEOPLE (domicilio, ciudad, fechaNacimiento, edad, email), ACADEMICA (fechaNacimiento, edad, foto), USUARIOS_ROLES (celular, numberid, contrato); foto vía presigned URL sin timeout |
| `6f36d0a` | fix: Envío Mensajes y Crear Rol movidos bajo submenú Usuarios en Mantenimiento |
| `619d72a` | feat: sidebar Mantenimiento — nuevo grupo 'Material' (Actualizar Videos) y 'Usuarios' (Clear Historic, Edición Contrato, Envío Mensajes, Crear Rol) |
| `aad66e1` | fix: `resolveStudentFromSession` expone `foto` desde ACADEMICA en el profile — `StudentHeader` puede mostrar la foto del estudiante |
| `4842356` | feat: `StudentHeader` rediseñado — avatar circular con foto de DO Spaces o iniciales del nombre; subtítulo "Panel de gestión para Usuarios"; nivel/step a la derecha; diseño responsivo (móvil compacto, desktop completo) |
| `0677295` | feat: captura `fechaNacimiento` en `/nuevo-advisor` (paso 3) y `/advisor-setup` — campo DATE en ADVISORS; guarda via `create` y `update-profile`; incluido en `ADVISOR_COLUMNS` |
| `5adcfec` | feat: agregar columna `fechaNacimiento` (DATE) a ADVISORS — creada en producción e incluida en ADVISOR_COLUMNS |
| `88db424` | fix: infoacademic-user print — ocultar toast/usuario con `@media print`; márgenes `@page` optimizados; tooltip en botón imprimir indica desactivar encabezados del browser |
| `4e3bbef` | feat: InfoAcademic User (`/dashboard/informes/infoacademic-user`) — reporte ejecutivo con KPIs, distribución semanal, progreso programa ESS→F3, heatmap 52 semanas, tabla detalle; print/PDF con logo + watermark + `@media print`; sidebar Informes → InfoAcademic User |
| `2b2b670` | feat: informe Asistencia Usuario (`/dashboard/informes/usuarios`) — busca beneficiario por `numeroId`, filtros fecha/nivel, tabla fecha/tipo/advisor/nivel/step/asistió/participó/noAprobo (sin Zoom), CSV exportable, mensaje cuando no hay agendamientos; API `GET /api/postgres/reports/asistencia/usuario` |
| `22e8555` | fix: `/nuevo-advisor` — toggle ver/ocultar contraseña igual que `advisor-setup` |
| `5d0e0d2` | feat: `/nuevo-advisor` agrega campos `numeroId` y `domicilio` (paso 1) y foto (paso 3 antes del link Zoom); endpoint público `photo-presign-public` para upload sin auth; `create` guarda `fotoAdvisor`, `domicilioadvisor` y `numberid` en ADVISORS/USUARIOS_ROLES |
| `eb5e03c` | feat: foto advisor en Lista de Advisors — componente `AdvisorAvatar` carga presigned URL lazy por advisor; fallback a iniciales si sin foto; usa `GET /api/postgres/materials/presigned` existente |
| `28ab4a4` | fix: actualizar-datos advisor — clave se guarda en texto plano (sin bcrypt); sistema soporta ambos formatos en auth |
| `113ad95` | fix: `by-email` advisor incluye `fotoAdvisor` y `domicilioadvisor` en SELECT — el panel-advisor ahora puede mostrar la foto del advisor |
| `bd2e1dd` | fix: actualizar-datos advisor — toggle ver/ocultar clave; celular solo dígitos sin + ni espacios; photo-presign usa ID real del advisor desde sesión (no Date.now) |
| `e04d47b` | feat: mostrar foto del advisor en panel — avatar circular junto al saludo; presigned endpoint acepta `fotosAdvisors/` además de `materials/` |
| `3d6ef5a` | fix: panel-advisor usa email de sesión cuando rol=ADVISOR y no hay email en URL; advisor-setup redirige con email al completar |
| `2eccc62` | fix: clave en actualizar-datos permite letras, números y caracteres especiales (sin espacios); elimina restricción alfanumérica en frontend y backend |
| `b9a794e` | fix: mover actualizar-datos a `/advisor-setup` para evitar loop de redirect — layout aplica solo a `/panel-advisor/*`; `/advisor-setup` está fuera del layout |
| `618425a` | fix: mover verificación `perfilActualizado` del middleware al Server Layout — middleware Edge Runtime no puede importar `pg`; layout.tsx corre en Node.js |
| `a8b04df` | feat: pantalla Actualización de Datos para advisors (`/advisor-setup`) — campos: email, numeroId, clave (6-10 sin espacios), celular, domicilio, foto (DO Spaces `fotosAdvisors/`); `USUARIOS_ROLES.perfilActualizado` controla si debe mostrar; reutilizable para otros roles vía Server Layout |
| `240906a` | fix: `StudentProgress` (admin) muestra nombres de clubs en columna Clubs — agrega `clubNombres` a interfaz `StepProgress` y los renderiza bajo el contador `2/1` (ej: TRAINING, GRAMMAR); columna Diagnóstico sin cambios |
| `03b6415` | fix: `changeStep` actualiza PEOPLE solo en BENEFICIARIOS — prioridad: `academic.usuarioId` (link directo al `_id` de PEOPLE) → `findBeneficiarioByNumeroId` (filtra `tipoUsuario=BENEFICIARIO`); evita actualizar TITULAR cuando comparte `numeroId` con el beneficiario |
| `a31e101` | feat: `autoAdvanceStep` usa `getEffectiveStepNumber` para avance en cascada — al completar steps normales (1-4) avanza directamente al Jump step (5) sin importar el orden; si todos los steps del nivel están completos (devuelve 0) avanza al siguiente nivel; PEOPLE y ACADEMICA actualizados en ambos casos |
| `b600440` | fix: `autoAdvanceStep` normaliza `bookingNivel` — extrae código de nivel de formato `"BN1 - Step 5"` (tituloONivel guardado como nivel) para que la comparación con `student.nivel` no falle; `isCurrentStepComplete` usa `student.nivel` directamente en vez de `bookingNivel` para el lookup de clases |
| `e9c2580` | fix: campos Número ID en Crear Contrato — solo letras mayúsculas y números, sin espacios ni guiones; `onKeyDown` bloquea caracteres inválidos, `onChange` limpia copy-paste y fuerza mayúsculas; aplica a Titular (paso 2) y Beneficiarios (paso 7) |
| `6af2533` | fix: campo Vigencia en Crear Contrato — `type="number"` min=1 max=12; `onKeyDown` bloquea letras/símbolos, `onChange` limpia copy-paste con regex, `onBlur` corrige valores fuera de rango; bloqueo aplica solo a ese campo |
| `908a4fb` | feat: calcular `finalContrato` automáticamente al crear contrato — `finalContrato = hoy + vigencia meses`; se graba en TITULAR y todos los BENEFICIARIOS en el mismo INSERT; si `vigencia = 0` queda NULL |
| `2e6afa9` | feat: auto-aprobar consentimiento genera y sube PDF al Drive — mismo flujo que Enviar PDF (API2PDF → bsl-utilidades) pero sin envío WhatsApp; errores de PDF son no-bloqueantes (el consentimiento se guarda igual) |
| `e853e98` | fix: dropdown Nivel en Actualizar Videos/Sesiones — reemplaza lista estática hardcodeada (incluía F4 inexistente) por carga dinámica desde BD via `GET /api/postgres/niveles`; el dropdown siempre refleja los niveles reales de NIVELES |
| `b76be6b` | fix: Edición Contrato — detectar UUID Wix (`002af1cd-...`) como ID directo además de `prs_...`; placeholder actualizado con los 3 formatos soportados |
| `5e10e51` | feat: página Edición Contrato en Mantenimiento (`/admin/edicion-contrato`) — busca titular por `_id` directo (`prs_...`) o número de contrato; muestra titular, beneficiarios y endpoint; abre `/dashboard/comercial/contrato/[id]` en nueva pestaña; sidebar: ítem "Edición Contrato" bajo Mantenimiento (SUPER_ADMIN, newTab) |
| `450fc7e` | fix: CORS en DO Spaces — endpoint `POST /api/admin/spaces-cors` aplica política CORS al bucket `lgs-bucket` (AllowedOrigins: lgs-plataforma.com + localhost:3001, Methods: GET/PUT/DELETE/HEAD); configurado via script Node + doctl para permitir uploads presigned desde el navegador |
| `b3d184d` | fix: upload video sesiones via presigned URL — evita 504 Gateway Timeout en archivos grandes; nuevo flujo: `POST /presign` genera URL firmada (10 min) → cliente hace `PUT` directo a DO Spaces → `PATCH /sesiones` confirma y actualiza `NIVELES.videoUrl`; el video nunca pasa por el servidor |
| `df81696` | feat: informe Niveles en Estadísticas (`/dashboard/informes/estadisticas`) — reemplaza placeholder "Próximamente"; muestra sesiones/jumps/clubes agendados por nivel con filtro de fechas y nivel, 4 KPIs (Total Sesiones, Nivel Pico, Día más Activo, Club más Agendado), gráfica barras por nivel, barras horizontales por día de semana y jumps por nivel, cards de clubes por tipo, sección "Esta Semana" (lunes–domingo independiente del filtro); API `GET /api/postgres/reports/estadisticas/niveles`; sidebar: ítem "General" renombrado a "Niveles" |
| `f272712` | feat: propagar `inicioContrato` del titular a beneficiarios en aprobación — al aprobar TITULAR copia `inicioContrato` (fecha firma consentimiento) a todos los beneficiarios pendientes del contrato; al aprobar BENEFICIARIO individualmente lo copia desde el titular; campo solo se propaga si el titular ya firmó el consentimiento (no null) |
| `392b715` | feat: modal advertencia + auditoría en auto-aprobar consentimiento — reemplaza `window.confirm` por modal rojo con texto "uso exclusivo del Área de Tecnología"; tabla `auditautoaprov` (auto-creada `CREATE TABLE IF NOT EXISTS`) registra `_id`, `contrato`, `titularId`, `usuarioEmail`, `usuarioNombre`, `ip`, `userAgent`, `_createdDate` en cada ejecución; `ids.audit` agregado al generador |
| `ca10ec1` | fix: reordenar y restylear botones en detalle de contrato (`/dashboard/comercial/contrato/[id]`) — nuevo orden: Ver Contrato (verde sólido emerald-600), Subir documentación (verde suave emerald-100), Editar Contrato (azul, sin cambio), Auto-Aprobar Consentimiento (rojo red-600, al final); botones de cierre (×) en modales con `type="button"` y `title="Cerrar"` |
| `67d76d0` | fix: pestaña Libros en `/sesion/[id]` — usa `tipo=usuario` para mostrar solo `materialUsuario`; igual que panel-estudiante |
| `8ba02e3` | fix: panel-estudiante MaterialsList — mostrar únicamente `materialUsuario`; el campo `material` (advisor) solo es visible en panel-advisor y pestaña Material de `/sesion/[id]` |
| `43da318` | fix: Actualizar Material sidebar — abrir en nueva pestaña (`newTab: true`) |
| `b872f3c` | fix: Material Advisor — corregir lectura de signedUrl (d.signedUrl, no d.data?.signedUrl); manejar URLs legacy Wix (`wix:document://`) mostrando badge "Archivo legacy — reemplazar" y botón "No disponible"; Descargar usa presigned URL para archivos en DO Spaces |
| `e18eeba` | feat: visualizar PPTX/DOCX/XLSX via Microsoft Office Online Viewer en pestaña Material (sesión) — nuevo endpoint `GET /api/postgres/materials/presigned?key=` genera presigned URL (10 min) para archivos en DO Spaces; `materials/nivel/route.ts` expone campo `key` (Spaces key) en cada material; `SessionAdvisorMaterialTab`: botón "Visualizar" (azul) para archivos Office con key en Spaces abre modal con iframe `view.officeapps.live.com/op/embed.aspx?src=<signedUrl>`; botón "Descargar" usa presigned URL para DO Spaces |
| `local` | feat: Actualizar Videos — gestión de videos desde panel admin (Mantenimiento). Ítem `Actualizar Videos` abre `/admin/actualizar-videos` en nueva pestaña con dos sub-páginas: (1) **Instructivos** (`/admin/actualizar-videos/instructivos`) — CRUD de videos instructivos del panel estudiante: subir MP4 a DO Spaces (`videos/instructivos/instructivo-{n}.mp4`), reemplazar, eliminar, editar título/descripción, preview via streaming proxy; config almacenada en `APP_CONFIG.instructivos_config` (JSON). Panel estudiante actualizado: obtiene lista dinámica de instructivos desde `/api/postgres/config/instructivos` (fallback a archivos estáticos si sin video cargado). (2) **Sesiones** (`/admin/actualizar-videos/sesiones`) — gestión por nivel/step: subir MP4 a DO Spaces (`videos/sesiones/{nivel}/{step}.mp4`) actualiza `NIVELES.videoUrl`; editar enlace externo (YouTube) actualiza `NIVELES.video`; borrar limpia campo + elimina de Spaces; preview inline (MP4 vía proxy o YouTube embed). API `/api/postgres/niveles/video` extendida con parámetro `?key=` para stream directo por key de Spaces (usado en preview de instructivos). Nuevas APIs: `/api/admin/videos/instructivos`, `/api/admin/videos/sesiones`, `/api/postgres/config/instructivos` |
| `1c104df` | feat: sesión — renombrar pestaña Material→Libros y nueva pestaña Material (advisor) — `SessionTabs` renombra tab emerald "Material" a "Libros" y agrega tab amber "Material" (`BookOpenIcon`); nuevo componente `SessionAdvisorMaterialTab` muestra material del advisor (`NIVELES.material`) filtrado por `nivel`+`step` del evento via `/api/postgres/materials/nivel?tipo=advisor`; `CalendarioEvent` interface en `/sesion/[id]/page.tsx` agrega campos `nivel` y `step`; API `materials/nivel/route.ts` soporta parámetros opcionales `?nivel=BN1` y `?tipo=usuario\|advisor\|all` |
| `7409c40` | feat: Actualizar Material — gestión de material por nivel/step desde el panel admin. Dos sub-páginas: `/dashboard/academic/actualizar-material/usuarios` (campo `materialUsuario` en NIVELES) y `/dashboard/academic/actualizar-material/advisor` (campo `material` en NIVELES). Operaciones: Descargar (proxy DO Spaces existente), Reemplazar (sube a Spaces con key `materials/{nivel}/{tipo}/{step}-{filename}`), Borrar (borra de NIVELES y de Spaces), Agregar (sube nuevo sin reemplazar). Modal de confirmación en borrar y reemplazar. Registro de auditoría en tabla `MATERIAL_AUDIT` (auto-creada al primer uso): campos `tipo`, `nivel`, `step`, `accion`, `archivoAnterior`, `archivoNuevo`, `realizadoPor`, `_createdDate`. Nuevo permiso `ACADEMICO.MATERIAL.ACTUALIZAR` asignado a SUPER_ADMIN, ADMIN, COORDINADOR_ACADEMICO en ROL_PERMISOS. Sidebar inicia colapsado (`expandedSections: []`) en DashboardLayout |
| `73c088d` | fix: ESS es nivel principal (no paralelo) — `nivel='ESS'` (no `nivelParalelo`); `fechaInicioESS` se guarda cuando `nivel === 'ESS'` (no depende de `isParallel`); auto-promoción usa `nivel === 'ESS'` (no `nivelParalelo`); duración corregida a 30 días; ACADEMICA/PEOPLE UPDATE no limpia `nivelParalelo`/`stepParalelo`; `student-booking.service.ts` marca eventos ESS con `esESS=true` basado en `nivel === 'ESS'` |
| `e9138b4` | feat: ESS parallel level — booking panel, auto-promoción BN1 tras 25 días — estudiantes con `nivelParalelo='ESS'` ven eventos ESS (borde naranja) en el panel de reservas junto a sus eventos del nivel principal; al asignar ESS vía `updateStep`, guarda `fechaInicioESS=NOW()` en ACADEMICA y PEOPLE; `resolveStudentFromSession` auto-promueve a `nivel='BN1'`, `step='Step 1'` cuando `nivelParalelo='ESS'` y han pasado ≥25 días; fix filtro 30 min: eventos <30 min (pero no >60 min pasados) se muestran deshabilitados con badge "Próximamente" en vez de ocultarse (soluciona visibilidad para estudiantes en zonas horarias distintas) |
| `6788d6f` | feat: botón 'Crear solo perfil' en StudentGeneral — nuevo botón azul al lado de 'Mensaje de Bienvenida'; envía WhatsApp con link `?noWelcome=1`; `sendWelcomeWhatsApp` API acepta flag `noWelcome` y genera URL con sufijo; `nuevo-usuario` page lee `useSearchParams` y omite dropdown de Welcome + validación cuando `?noWelcome=1` está presente |
| `bcb2ced` | perf: reemplazar N+1 countActiveEnrollments por batch en getAvailableEvents — `getAvailableEvents` hacía una query por evento en `Promise.all` agotando el pool de 25 conexiones bajo carga concurrente; nuevo método `countActiveEnrollmentsBatch` en `CalendarioRepository` agrupa todos los conteos en una sola query con `ANY($1)` y `GROUP BY`; el loop de anotación pasa de async a síncrono; total: de N+1 a 3 queries por request |
| `d14f2a0` | fix: normalizar timestamps Wix en CALENDARIO + simplificar eventDiaToUTC — SQL aplicado en DO: `UPDATE "CALENDARIO" SET dia=(dia::timestamp AT TIME ZONE 'America/Bogota'), origen='POSTGRES' WHERE origen IS NULL OR origen != 'POSTGRES'` (19.943 registros); backup `CALENDARIO_BACKUP_20260414` intacto (22.819 registros); `eventDiaToUTC` simplificada a `new Date(dia)` — `COLOMBIA_OFFSET_MS` eliminado |
| `42722ff` | fix: corregir minutesUntil y cálculo de semana para eventos migrados de Wix — eventos Wix almacenan hora naive Colombia (UTC-5); nueva función `eventDiaToUTC(dia, origen)` en `student-booking.service.ts` suma `COLOMBIA_OFFSET_MS` (5h) cuando `origen != 'POSTGRES'`; corrige 3 lugares: filtro 30min en `getAvailableEvents`, validación futura y cálculo de semana en `bookEvent`; sustituido por normalización definitiva en DB (d14f2a0) |
| `a14f48c` | fix: clear-historic — botón Cancelar junto a Eliminar historial en estado found; handlerWithAuth corregido a (req, _ctx, session); safeCount/safeDelete toleran tablas inexistentes en local; página abre en nueva pestaña (newTab: true) |
| `400f10d` | feat: Clear Historic — limpiar historial académico de estudiante por numeroId; GET `/api/admin/clear-historic/lookup` verifica PEOPLE+ACADEMICA y cuenta Bookings/Complementarias/StepOverrides (excluye WELCOME); DELETE `/api/admin/clear-historic/student` borra por academicaIds; UI multi-paso: búsqueda → conteos → confirm1 → confirm2 → barra progreso → resumen |
| `local` | feat: sidebar Mantenimiento — nuevo grupo (SUPER_ADMIN) que agrupa Permisos, Avisos (Ticker/Banner), Juegos y nuevo item Clear Historic (`/admin/clear-historic`) |
| `local` | fix: Welcome Session — filtro de fecha timezone-aware: `startDate` y `endDate` se envían como ISO con offset UTC del cliente (`T00:00:00` / `T23:59:59` locales → `.toISOString()`); backend usa `::timestamptz` y `<=` para cubrir eventos hasta fin de día local (ej: 8 PM Colombia = 01:00 UTC día siguiente). Además: JOIN invertido (`ACADEMICA_BOOKINGS` LEFT JOIN `CALENDARIO`) para incluir bookings históricos Wix sin enlace a CALENDARIO; fix duplicados PEOPLE (`tipoUsuario IN BENEFICIARIO/BENEFICIARIA`); WHERE más robusto con `ab."nivel" = 'WELCOME'` y `ab."tituloONivel" ILIKE '%WELCOME%'` |
| `local` | fix: Welcome Session — click en fila abre `/student/[idEstudiante]` en nueva pestaña; fallback a `/person/[_id]` si no tiene registro académico; usa `window.open(..., '_blank', 'noopener,noreferrer')` |
| `8f134c3` | fix: panel-estudiante — `toLocaleDateString` → `toLocaleString` con `Intl.DateTimeFormat().resolvedOptions().timeZone`; la hora de la próxima clase ahora se muestra correctamente según el timezone del cliente; locale genérico `'es'` en lugar de hardcoded `'es-CO'` |
| `884faeb` | feat: Horarios — timezone dinámico según zona horaria del cliente; frontend detecta `Intl.DateTimeFormat().resolvedOptions().timeZone` y lo envía como `?tz=`; API valida con regex IANA y usa `AT TIME ZONE tz` en los 4 queries; subtítulo muestra el tz detectado |
| `b72a0ac` | fix: Horarios — filtrar horario operativo 06:00–22:00 en timezone del cliente; excluir COMPLEMENTARIA y WELCOME; chart x-axis solo muestra 17 barras (06–22) |
| `d09ecbd` | feat: X País — columnas Inasist. y Cancel. en tabla de plataformas; % = asistieron_país / total_dona (participación sobre el total, no tasa por fila); CSV con columnas Total/Métrica/Inasistencias/Canceladas/% Asistencia; Complementarias oculta Inasist./Cancel. vía `hideAbsences` prop |
| `339725c` | feat: Estadísticas - Horarios — nueva página `/dashboard/informes/estadisticas/horarios` con filtros de fecha; API `/api/postgres/reports/estadisticas/horarios` (4 queries paralelas: por hora, día semana, heatmap hora×día, por plataforma); Recharts BarChart + heatmap personalizado + barras horizontales por día; KPI cards (total, hora pico, día pico, país principal); sidebar Estadísticas convertido a submenu con General y Horarios |
| `d5f6716` | feat: extraer Informes de módulo Académico — nuevo InformesPermission enum (INFORMES.*), Module.INFORMES, middleware rutas /dashboard/informes/*, ROL_PERMISOS renombrado en PostgreSQL; VALID_PERMISSIONS actualizado |
| `96e7f24` | feat: permisos granulares por grupo de Informes — 7 nuevos permisos (INFORMES_ASISTENCIA, INFORMES_PROGRAMACION, INFORMES_ADVISORS, INFORMES_USUARIOS, INFORMES_CONTRATOS, INFORMES_PLANTA, INFORMES_ESTADISTICAS); visibles en matriz /admin/permissions; ROL_PERMISOS actualizado para SUPER_ADMIN y ADMIN |
| `e628c86` | feat: sidebar Informes — grupo 'Sesiones' renombrado a 'Programación' (Sesiones, Clubes, Welcome); nuevo grupo 'Advisors' con 6 ítems (Sesiones, Jumps, Training, Clubes, Welcome, Resumen); todos abren en nueva pestaña con permiso VER_INFORMES |
| `a47f65d` | feat: dblgs — filtros nulo/vacío (botón ∅) y rangos de fecha (date pickers Desde/Hasta) en fila de filtros; backend buildWhereClause maneja __gte/__lte y __NULL__/__EMPTY__ sentinels |
| `478773b` | feat: X País — donut por plataforma con tarjetas al extremo derecho — donut segmentado por país con paleta de 9 colores, leyenda País/Total/Métrica/% a la derecha, tarjetas inferiores alineadas a la derecha con valor+país+%, Complementarias muestra solo "Generadas" (asistieron), Jumps usa métrica aprobaron |
| `e05dd40` | feat: Informe Asistencia X País — 6 secciones con desglose por plataforma: SESIONES (SESSION step 0-45 excl. ×5), JUMPS (SESSION ×5, aprobaron=asistio+participacion+!noAprobo), TRAINING (CLUB TRAINING-Step), CLUBES (CLUB GRAMMAR/LISTENING/KARAOKE/PRONUNCIATION/CONVERSATION), WELCOME (nivel=WELCOME), COMPLEMENTARIAS (tipo=COMPLEMENTARIA); panel izquierdo RESUMEN; API `/api/postgres/reports/asistencia/x-pais` con 6 queries paralelas sobre ACADEMICA_BOOKINGS filtradas por fechaEvento |
| `48a8b31` | feat: agregar item X País en sidebar Asistencia — nuevo ítem al final del grupo Asistencia (después de Welcome Session), abre en nueva pestaña, permiso VER_INFORMES |
| `d9a75aa` | feat: Informe Asistencia — Actividades Complementarias — página `/dashboard/informes/asistencia/complementarias` con donut PASSED/FAILED/IN_PROGRESS, filtros fecha/plataforma/nivel (BN1-F3), panel izquierdo con totales; API `/api/postgres/reports/asistencia/complementarias` consulta COMPLEMENTARIA_ATTEMPTS por _createdDate |
| `1c5b888` | feat: guardar plataforma en COMPLEMENTARIA_ATTEMPTS al generar quiz — ALTER TABLE agrega columna plataforma VARCHAR(50); generateQuestions() acepta plataforma opcional; route /generate pasa student.plataforma; UPDATE masivo sincronizó 1029 registros existentes desde ACADEMICA |
| `76a5efc` | feat: Informes Asistencia — 4 páginas de informes bajo Asistencia: (1) Sesiones & Jumps (`/sesiones-clubes`) con filtros independientes por sección, donut charts, CSV; (2) Clubes (`/clubes`) con Training Session (donut) + Clubs por tipo (barras horizontales), filtros independientes, filtro adicional Tipo de Club; (3) Welcome Session (`/welcome-session`) con donut chart; (4) APIs independientes: `/api/reports/asistencia/sesiones`, `/jumps`, `/clubes`, `/training`, `/welcome`. Todos los informes abren en nueva pestaña. Botón Limpiar filtros y Descargar CSV en cada sección. Accesibilidad: htmlFor/id en todos los inputs. |
| `9c420fb` | feat: restructurar Informes en sidebar con 3 niveles — reemplaza Informe Beneficiarios/Reporte General/Mensuales por: Asistencia (Sesiones & Clubes, Complementarias), Sesiones (Programadas, Advisor), Usuarios, Contratos, Planta (Advisors, Administrativos), Estadísticas; páginas placeholder creadas; archivos obsoletos eliminados |
| `29b99fc` | fix: extendByDays reactiva estudiante en PEOPLE, ACADEMICA y USUARIOS_ROLES — al extender vigencia sincroniza: PEOPLE.estadoInactivo=false, ACADEMICA.estadoInactivo=false (por numeroId), USUARIOS_ROLES.activo=true (por email) |
| `fc364a7` | fix: add missing _id to USUARIOS_ROLES INSERT in nuevo-advisor — mismo bug que fc5466e en nuevo-usuario; columna _id no tiene default y causaba Database error al crear advisor |
| `d2b40b9` | fix: dblgs USUARIOS_ROLES — LEFT JOIN ACADEMICA usaba email directo causando filas duplicadas cuando el usuario tiene múltiples registros en ACADEMICA; corregido con DISTINCT ON (LOWER(email)) para traer solo un registro de ACADEMICA por email |
| `local` | fix: PersonAdmin no mostraba beneficiarios con tipoUsuario='BENEFICIARIA' (valor incorrecto en datos Wix); se corrige editando el dato directamente en DBLGS a 'BENEFICIARIO' |
| `015a3ae` | fix: Mensuales por país usa b.plataforma directo de ACADEMICA_BOOKINGS — campo plataforma no es null; se eliminan JOINs a ACADEMICA y PEOPLE innecesarios |
| `69f696e` | fix: Mensuales por país — elimina filtro AND tipo IN ('SESSION','CLUB') que excluía registros con tipo NULL (datos Wix); categoriza con CASE WHEN tituloONivel ILIKE WELCOME→WELCOME, tipo=CLUB→CLUB, resto→SESSION; tabla añade columnas Welcome agendadas/asistidas/% |
| `9548593` | fix: ticker reads from root JSON — successResponse() spreads at root ({success, message, color}), not nested under data. Panel estudiante y editor de ticker usaban j.data (undefined); ahora usan j directamente. Botones Reemplazar/Agregar y animación del ticker ahora funcionan correctamente |
| `36cdca2` | fix: add direct PEOPLE JOIN for plataforma fallback in reports general and mensuales — cuando studentId/idEstudiante es PEOPLE._id (datos Wix), se agrega LEFT JOIN PEOPLE p2 directo. Cadena: b.plataforma → p.plataforma (via ACADEMICA) → a.plataforma → p2.plataforma → 'Sin país' |
| `43e7cd8` | fix: resolve plataforma via ACADEMICA→PEOPLE JOIN in reports mensuales and general — b."plataforma" vacío en datos Wix; usa COALESCE con LEFT JOIN ACADEMICA + PEOPLE (tipoUsuario=BENEFICIARIO) |
| `2e7b1c1` | feat: Reporte Mensuales — GET /api/postgres/reports/mensuales?startDate&endDate runs 7 parallel safeQuery calls (sesiones/TRAINING/JUMP from CALENDARIO by nivel BN1-F3, bookings sesiones/TRAINING/otros-clubs from ACADEMICA_BOOKINGS by nivel, bookings by país); component with horizontal bar charts, dual-bars for asistencia rate, país table; each section CSV-exportable; sidebar Informes adds 'Mensuales' (new tab) |
| `371d2e1` | feat: open Informes sidebar items in new tab — newTab: true flag on Informe Beneficiarios and Reporte General nav items; Link renders with target="_blank" + rel="noopener noreferrer" when newTab is set |
| `46aee55` | feat: add Reporte General to pagePermissions — /dashboard/informes/general now restricted to roles with INFORMES permissions in sidebar; SUPER_ADMIN/ADMIN bypass via hasFullAccess |
| `41e6987` | feat: Reporte General dashboard — GET /api/postgres/reports/general?startDate&endDate runs 5 parallel queries (resumen eventos SESSION/CLUB, complementarias, asistencia por país pivoteada, rendimiento por advisor sorted desc, usuarios activos/inactivos por país); PowerBI-style component with stat cards, progress bars, CSV export per section; page at /dashboard/informes/general; sidebar link added to Informes group |
| `444e419` | feat: move Informe Beneficiarios out of Académico into new Informes group — sidebar now has a dedicated "Informes" section (ChartBarIcon) below Avisos with "Informe Beneficiarios" inside; sectionPermissions updated accordingly |
| `ca4412b` | fix: findBookingById uses CALENDARIO JOIN for correct step/nivel — prevents autoAdvanceStep from using booking's stored step (student's step at booking time) instead of the event's real step; fixes incorrect advances when student was enrolled in a jump step while at an earlier step |
| `135882f` | fix: participacion only counts as exitosa for JUMP steps (multiples of 5) — normal steps: asistio OR asistencia; jump steps: asistio OR asistencia OR participacion. Affects progress.service, student.service, student-booking.service, booking.repository attendance stats SQL |
| `ba4652b` | feat: remove WhatsApp help bubble from student panel header — StudentHeader.tsx no longer renders the "Necesitas ayuda?" WhatsApp link; header now shows only greeting + nivel/step badge + logout button |
| `bd217bd` | feat: sync-field endpoint — Mode 3 concat now supports `filterField`/`filterValue` to restrict update to a specific subset (e.g. `filterField:"nivel", filterValue:"F2"`). Allows level-by-level tituloONivel repairs |
| `e36d9a5` | feat: sync-field endpoint — Mode 3 concat: `sourceFields` (string[]) + `separator` concatenates multiple fields into one (e.g. nivel + " - " + nombreEvento → tituloONivel). Operates in batches of 2000 with `overwrite` support |
| `734c5f4` | feat: sync-field endpoint — Mode 2 same-table field copy: `sourceField` copies one column into another within the same table (e.g. step → nombreEvento in ACADEMICA_BOOKINGS) |
| `27b0da3` | feat: generic POST /api/admin/sync-field endpoint (SUPER_ADMIN only) — Mode 1: cross-table JOIN sync copies a field from sourceTable to targetTable via configurable keys. Replaces sync-plataforma-bookings with a parametrizable approach. SQL injection protection via table whitelist + identifier regex |
| `1542bab` | fix: save fechaAgendamiento in admin panel bookings — enrollment.service.ts now saves `fechaAgendamiento: new Date().toISOString()` when admin enrolls students (origen: POSTGRES). Previously only PANEL_EST bookings had this field populated |
| `5da80c1` | fix: propagate event field changes to bookings on update + show club name in attendance table — calendar.service updateEvent now propagates nombreEvento, titulo, nivel, step, tituloONivel, tipo/tipoEvento to ACADEMICA_BOOKINGS (in addition to advisor/linkZoom); StudentAcademic Step column shows nombreEvento for CLUB rows |
| `882bb82` | feat: add sync-plataforma-bookings admin endpoint + env var auth fallback — POST /api/admin/sync-plataforma-bookings copies plataforma from ACADEMICA to ACADEMICA_BOOKINGS in batches of 2000 (SUPER_ADMIN only); auth-postgres.ts checks ADMIN_EMAIL/ADMIN_PASSWORD env vars before PostgreSQL (local dev) |
| `73ad32d` | fix: STEP_OVERRIDES uses ACADEMICA _id — step-override route resolves ACADEMICA _id + detects duplicates ("USUARIO duplicado en ACADEMICA"); progress.service and student-booking.service updated; peopleId param removed from getEffectiveStepNumber/getAvailableEvents; override badge in ¿Cómo voy? admin: "✎ Override ✓" purple / "✎ Override ✗" orange |
| `ea4ae58` | fix: save plataforma field in ACADEMICA_BOOKINGS on enrollment — enrollment.service.ts and student-booking.service.ts now include student.plataforma when creating bookings |
| `0f59e82` | fix: remove clickable link from beneficiary names in PersonAdmin — names are now plain text |
| `f0f35e5` | fix: step completion now requires specifically a TRAINING club (name starts with "TRAINING -"). PRONUNCIATION, GRAMMAR, LISTENING no longer count. Added `isTrainingClub()` helper in `progress.service.ts`; updated `isCurrentStepComplete` in `student.service.ts` and `getEffectiveStepNumber` in `student-booking.service.ts`. All 3 functions now use CALENDARIO JOIN for real step names and filter cancelled bookings. Jump step logic in `getEffectiveStepNumber` aligned with `progress.service.ts`. |
| `32999ed` | fix: beneficiary link en PersonAdmin usa /student/[academicaId] si tiene registro en ACADEMICA, o /person/[_id] si no tiene |
| `e2c50bc` | fix: middleware — noCacheNext() helper aplica headers no-store a TODOS los returns protegidos (SUPER_ADMIN, alwaysAllowedRoutes, panel-estudiante) — fix definitivo del back-button bypass post-logout |
| `7dc95fd` | fix: banner overlay cubre solo el card del login, no toda la pantalla |
| `7920c6f` | feat: Banner del login — SUPER_ADMIN sube imagen desde /admin/banner (toggle activo/inactivo, preview, eliminar); imagen guardada en APP_CONFIG (banner_image/banner_active); login muestra overlay con imagen y botón cerrar; se omite en misma sesión via sessionStorage |
| `b6f9c5b` | feat: Ticker y Banner agrupados bajo nuevo submenú Avisos (SUPER_ADMIN only) en sidebar |
| `local` | fix: lower complementaria pass threshold from 80% to 50% (`PASS_THRESHOLD = 50` in `complementaria.service.ts`) |
| `f875c7c` | feat: auto-save contract draft to localStorage (72h TTL) — prevents data loss on accidental browser close; shows restore banner with continue/discard options |
| `bb78a51` | feat: add Material Interactivo button in student panel MaterialsList — links to lgsplataforma.com/material-{nivel} for BN1-BN3, P1-P3, F3 |
| `06ff35e` | Fix: /api/wix/* endpoints now accept NextAuth session OR WIX_SECRET header — fixes 401 Unauthorized when admin panel calls sendWhatsApp/sendWelcomeWhatsApp internally |
| `b050c43` | Fix: ticker color picker selection no longer overwritten by useEffect after save (colorTouched flag prevents re-sync once user has interacted) |
| `5043e94` | fix: default ticker message updated to Semana Santa notice (Ecuador/Chile/Colombia); APP_CONFIG table created in production DB with initial record |
| `1118a96` | fix: ticker editor shows default hardcoded message when APP_CONFIG table not yet created (fetchTicker catches error and returns DEFAULT_TICKER) |
| `86f3a36` | feat: Ticker editor — SUPER_ADMIN can manage student panel banner from /admin/ticker (replace/append, color picker, live preview, confirm dialog); message stored in APP_CONFIG table; panel-estudiante reads from DB with fallback |
| `e0db017` | Refactor: standardize non-standard API endpoints — permissions/route + user/permissions use RolPermisosRepository; permissions/update + roles/create use direct repo instead of fetch() proxies with VALID_PERMISSIONS validation; dashboard/stats uses dashboardService.getStats(); /api/wix/* endpoints protected with WIX_SECRET or NextAuth session (dual auth) |
| `0ada99f` | Fix: /admin/permissions — confirmation dialog when saving role with 0 permissions; backend validates all permission codes against known enums before saving |
| `ecffec0` | Fix: PATCH /api/postgres/people/[id] now syncs email and celular to ACADEMICA (by numeroId) and email to USUARIOS_ROLES (by old email) when modified via Modificar beneficiario |
| `3182cb9` | Fix: PersonAdmin beneficiary list now returns both _id (PEOPLE, for inactivate/delete ops) and academicaId (ACADEMICA, for /student navigation link) — fixes 404 on Inactivar button |
| `0d7ccaa` | Fix: WELCOME sessions with attendance (asistio/asistencia=true) excluded from weekly SESSION limit (max 2/week) — student can attend WELCOME + 2 regular sessions same week |
| `efe358b` | Fix: zoom unavailable text changed to "recuerda refrescar el navegador" (was "recuerde"), color set to white for visibility on blue background (panel-estudiante/page.tsx + NextClassCard.tsx) |
| `6b6afec` | Fix: beneficiary links in /person/[id] use ACADEMICA _id (falls back to PEOPLE _id if no academic record); booking.repository preserves prefixed step names (e.g. 'TRAINING - Step 7') |
| `f7cb0b0` | Fix: use NEXTAUTH_URL for server-side redirect instead of internal request.url |
| `d72036c` | feat: add CRM bridge endpoint for cross-app authentication |
| `3e51a11` | Fix: revert booking logic in main — show only student's specific jump step |
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