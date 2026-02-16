# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LGS Admin Panel is a Next.js 14 administrative dashboard for "Let's Go Speak" language learning platform. The panel provides management interfaces for students, classes, events, and financial data. Uses PostgreSQL (Digital Ocean) as primary database with a layered architecture (Repository → Service → API Route → Hook).

## Lista Completa de Funcionalidades

### Autenticación y Acceso
1. Login con email/contraseña
2. Control de acceso basado en roles (RBAC) con 12 roles
3. Carga dinámica de permisos desde PostgreSQL con caché de 5 minutos
4. Control de acceso por ruta (middleware)
5. Gestión de sesiones con JWT (NextAuth.js)

### Dashboard (Inicio)
6. Tarjetas de estadísticas (Total Usuarios, Inactivos, Sesiones Hoy, Inscritos Hoy, Advisors Hoy)
7. Top 5 estudiantes del mes (por asistencia)

### Módulo Académico
8. Agenda de Sesiones - Vista de calendario mensual
9. Creación de eventos (SESSION, CLUB, WELCOME)
10. Edición de eventos
11. Eliminación de eventos
12. Filtrado de eventos por advisor, tipo, nivel, rango de fechas
13. Gestión de inscripciones por evento
14. Seguimiento de asistencia
15. Vista de agenda diaria
16. Exportación CSV de eventos
17. Agenda Académica - Vista semanal de clases
18. Lista de Advisors con estadísticas
19. Creación de nuevos advisors
20. Detalle de advisor (calendario, estadísticas, eventos)
21. Panel Advisor personal (calendario y métricas propias)
22. Informe de Beneficiarios (reportes por rango de fechas)
23. Exportación PDF/CSV de informes

### Módulo Servicio
24. Welcome Session - Carga y gestión de eventos de bienvenida
25. Seguimiento de asistencia de welcome sessions
26. Lista de Sesiones de clase
27. Filtrado por fecha, estado de asistencia, apellido
28. Usuarios sin Registro - Vista de beneficiarios sin perfil académico
29. Creación de perfiles académicos para beneficiarios
30. Integración con WhatsApp para mensajes
31. Exportación CSV de datos de servicio

### Módulo Comercial
32. Crear Contrato - Formulario wizard multi-paso
33. Selección de país con prefijos telefónicos
34. Generación de PDF de contrato
35. Vista previa de contrato
36. Envío de contrato por WhatsApp
37. Opción de auto-aprobación de contratos
38. Gestión de Prospectos (pipeline comercial)

### Módulo Aprobación
39. Vista de contratos pendientes de aprobación
40. Aprobación/rechazo de contratos con comentarios
41. Filtrado por estado (Pendiente, Aprobado, Rechazado)
42. Descarga y envío de PDF de contratos
43. Paginación y búsqueda de aprobaciones

### Gestión de Permisos (Admin)
44. Interfaz de matriz de permisos (solo SUPER_ADMIN/ADMIN)
45. Vista agrupada por módulo con colores distintos
46. Asignación masiva de permisos ("Select All" por módulo)
47. Creación y edición de roles

### Detalle de Estudiante
48. Información general (datos personales, contacto, plataforma)
49. Tabla de asistencia académica
50. Diagnóstico "¿Cómo voy?" (progreso del estudiante)
51. Agendar nueva clase
52. Gestión de Steps (marcar/asignar steps)
53. Cambiar Step del estudiante
54. Modal de detalles de clase (evaluación, anotaciones, comentarios)
55. Información del contrato (fechas, estado, vigencia)
56. Historial de extensiones (manuales y automáticas)
57. Extensión manual del contrato
58. Sistema OnHold - Activar pausa del contrato
59. Sistema OnHold - Desactivar pausa (extensión automática)
60. Historial de OnHold
61. Envío de mensajes por WhatsApp con plantillas
62. Sección de comentarios del estudiante

### Detalle de Persona (Titular)
63. Información general del titular
64. Contacto y referencias (teléfonos, emails, dirección, emergencia)
65. Información financiera
66. Administración de beneficiarios (agregar, vincular, desvincular)
67. Control de estado de cuenta
68. Comentarios internos

### Detalle de Advisor
69. Información del advisor (nombre, email, Zoom)
70. Calendario de eventos asignados
71. Estadísticas de rendimiento (clases, estudiantes, asistencia)

### Detalle de Sesión
72. Información general de la sesión (fecha, hora, advisor, Zoom, tipo)
73. Roster de estudiantes con marcado de asistencia
74. Material y recursos de enseñanza

### Búsqueda Global
75. Búsqueda por nombre, apellido, número de ID, contrato
76. Búsqueda con debounce (400ms)
77. Resultados multi-tipo (PEOPLE y ACADEMICA)
78. Navegación por teclado en resultados

### ESS (English Speaking Sessions)
79. Nivel paralelo que no bloquea avance en niveles principales
80. Tracking de asistencia ESS independiente
81. Asignación simultánea de nivel principal + nivel paralelo

### Exportación de Datos
82. Exportación CSV (eventos, agenda, sesiones, beneficiarios, aprobaciones)
83. Exportación PDF (contratos, reportes)

### Jobs Automáticos (Cron)
84. Expiración automática de contratos
85. Reactivación automática de OnHold

### Caché y Rendimiento
86. Caché client-side en localStorage con TTL para calendario
87. Caché server-side en memoria para permisos
88. Invalidación automática de caché en operaciones CRUD

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
├── hooks/                   ← HOOKS - Frontend data fetching (5 archivos)
│   ├── use-api.ts               Wrapper de fetch con manejo de errores
│   ├── use-student.ts           Datos de estudiantes (perfil, académico, progreso, onhold, extensiones)
│   ├── use-calendar.ts          Datos del calendario (eventos, bookings, inscripciones)
│   ├── use-advisors.ts          Datos de advisors (lista, stats)
│   └── use-search.ts            Búsqueda global con debounce
│
├── app/api/postgres/        ← API ROUTES - Adaptadores HTTP (52 rutas)
│   ├── students/                Perfil, academic, step, toggle-status, onhold, extend, progress
│   ├── calendar/                Eventos del calendario, CRUD
│   ├── events/                  Eventos, bookings, inscripciones, batch-counts
│   ├── people/                  PEOPLE CRUD, comments, beneficiarios-sin-registro
│   ├── advisors/                Lista, stats, events por advisor
│   ├── search/                  Búsqueda unificada (PEOPLE + ACADEMICA)
│   ├── contracts/               Contratos, búsqueda por patrón
│   ├── dashboard/               Estadísticas del inicio
│   ├── roles/                   CRUD de roles y permisos
│   ├── niveles/                 Niveles y steps
│   ├── financial/               Datos financieros
│   ├── export/                  Exportación CSV (eventos, estudiantes)
│   ├── reports/                 Reportes de asistencia
│   ├── academic/                Historial académico, asistencia, evaluación, actividad
│   ├── approvals/               Aprobaciones pendientes
│   ├── materials/               Material por nivel y usuario
│   ├── permissions/             Permisos del usuario actual
│   └── users/                   Rol de usuario por email
│
├── services/                ← SERVICES - Lógica de negocio (7 archivos)
│   ├── student.service.ts       Perfil (lookup ACADEMICA→PEOPLE), historial, toggle status
│   ├── contract.service.ts      OnHold, extensiones, expiración
│   ├── calendar.service.ts      Crear/editar/eliminar eventos con bookings
│   ├── enrollment.service.ts    Inscribir estudiantes en eventos (validación de capacidad)
│   ├── search.service.ts        Búsqueda unificada en PEOPLE + ACADEMICA en paralelo
│   ├── dashboard.service.ts     Estadísticas del dashboard (queries paralelas)
│   └── progress.service.ts      Reporte "¿Cómo voy?" (diagnóstico del estudiante)
│
├── repositories/            ← REPOSITORIES - Acceso a datos / SQL (10 archivos)
│   ├── base.repository.ts       Clase base: findById, findMany, updateFields, parseJsonb
│   ├── people.repository.ts     Tabla PEOPLE (~10 rutas)
│   ├── academica.repository.ts  Tabla ACADEMICA (~4 rutas)
│   ├── booking.repository.ts    Tabla ACADEMICA_BOOKINGS (~8 rutas)
│   ├── calendar.repository.ts   Tabla CALENDARIO (~6 rutas)
│   ├── advisor.repository.ts    Tabla ADVISORS (~4 rutas)
│   ├── roles.repository.ts      Tablas ROL_PERMISOS + USUARIOS_ROLES (~4 rutas)
│   ├── niveles.repository.ts    Tablas NIVELES + STEP_OVERRIDES (~4 rutas)
│   ├── financial.repository.ts  Tabla FINANCIEROS (~2 rutas)
│   └── comments.repository.ts   Tabla COMENTARIOS (~2 rutas)
│
├── lib/                     ← UTILIDADES compartidas (4 archivos nuevos + existentes)
│   ├── errors.ts                Clases de error: NotFoundError, ValidationError, UnauthorizedError
│   ├── api-helpers.ts           handler(), handlerWithAuth(), successResponse()
│   ├── query-builder.ts         buildDynamicUpdate(), buildDynamicWhere()
│   ├── id-generator.ts          ids.event(), ids.booking(), etc.
│   ├── postgres.ts              Pool de conexión PostgreSQL (existente)
│   ├── auth.ts                  NextAuth.js config (existente)
│   └── middleware-permissions.ts Cache de permisos server-side (existente)
│
├── components/              ← COMPONENTES React organizados por feature
│   ├── layout/                  DashboardLayout, sidebar, navigation
│   ├── student/                 StudentTabs, StudentAcademic, StudentOnHold, StudentContract...
│   ├── search/                  SearchBar (búsqueda global)
│   ├── calendar/                CalendarView, EventModal, EventForm...
│   ├── permissions/             PermissionGuard
│   └── ui/                      Componentes genéricos reutilizables
│
└── types/                   ← TypeScript definitions
    ├── index.ts                 Student, Person, Event, Booking, etc.
    └── permissions.ts           Enums de permisos sincronizados con ROL_PERMISOS
```

### Convenciones importantes

- **`server-only`**: Todos los repositorios, servicios y api-helpers importan `'server-only'` para evitar que se incluyan en bundles del cliente
- **SQL parametrizado**: Todo el SQL usa placeholders `$1, $2, ...` (nunca interpolación de strings)
- **React Query v3**: Se importa de `'react-query'` (NO de `@tanstack/react-query`)
- **handler() wrapper**: Todas las rutas API usan `handler()` o `handlerWithAuth()` de `@/lib/api-helpers` para estandarizar try/catch y respuestas de error
- **JSONB**: Campos como `onHoldHistory`, `extensionHistory`, `evaluacion` se almacenan como JSONB en PostgreSQL. Los repositorios usan `parseJsonb()` de la clase base para deserializarlos

## Development Commands

```bash
# Development
npm run dev                    # Start dev server on port 3001

# Build and Deploy
npm run build                  # Production build with memory optimization
npm run start                 # Start production server on port 3001

# Database Operations
npm run seed:admin            # Create admin user (legacy MongoDB)
npm run db:backup            # Backup database (legacy MongoDB)
```

## Key Implementation Details

### Authentication System
- Uses NextAuth.js with credentials from PostgreSQL `USUARIOS_ROLES` table
- Supports both bcrypt hashed passwords and plain text (legacy compatibility)
- User credentials and roles stored in PostgreSQL
- Admin fallback credentials via environment variables: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Implementation: `src/lib/auth.ts`
- Password verification: Checks PostgreSQL first, then falls back to test users

### Custom Form Validation
- Custom `zodResolver` implementation in `src/lib/zod-resolver.ts`
- Replaced `@hookform/resolvers` to avoid peer dependency issues
- Only supports Zod schemas

### Caching Strategy
- **Client-side**: localStorage-based caching for calendar events with 5-minute TTL
- **Server-side (Middleware)**: In-memory cache for user permissions with 5-minute TTL
- Cache keys include month/date for granular invalidation
- Automatic cache cleanup on expiration
- Cache invalidation on CRUD operations
- Implementation:
  - Calendar: `src/app/dashboard/academic/agenda-sesiones/page.tsx:60-131`
  - Permissions: `src/lib/middleware-permissions.ts`

## Deployment Configuration

### Environment Variables (Digital Ocean)
```
NEXTAUTH_URL=https://your-app-url.ondigitalocean.app
NEXTAUTH_SECRET=your_32_character_secret_key
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-secure-password
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

### TypeScript Build Configuration
- Target: `es2017` (required for MongoDB/BSON compatibility)
- Build errors ignored in production (`ignoreBuildErrors: true`)
- Test files excluded from compilation

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

### Server-Side API Calls
- Always use `process.env.NEXTAUTH_URL` for server-side fetch calls
- Client-side should use relative URLs (`''` baseUrl)
- Avoid hardcoded `localhost:3001` references

### Caching Issues
- localStorage may not persist in some environments
- Check browser dev tools for cache key conflicts
- Verify TTL calculations are working correctly
- Cache is automatically invalidated on event CRUD operations

### Form Validation Issues
- Use the custom `zodResolver` from `src/lib/zod-resolver.ts`
- Do not install `@hookform/resolvers` - causes peer dependency conflicts
- Only Zod schemas are supported

## Database Architecture
- **PostgreSQL** (Digital Ocean Managed Database) as sole data store
- Connection: `src/lib/postgres.ts` with connection pool and SSL
- All SQL is parameterized ($1, $2, ...) to prevent injection
- JSONB fields for flexible data: `onHoldHistory`, `extensionHistory`, `evaluacion`, `steps`, etc.
- Key tables:
  - `PEOPLE`: Personas (titulares y beneficiarios), contratos, OnHold
  - `ACADEMICA`: Registros académicos por estudiante
  - `ACADEMICA_BOOKINGS`: Inscripciones a eventos (asistencia, evaluación)
  - `CALENDARIO`: Eventos (SESSION, CLUB, WELCOME)
  - `ADVISORS`: Profesores/advisors
  - `USUARIOS_ROLES`: Credenciales y roles de usuario
  - `ROL_PERMISOS`: Definiciones de roles con arrays de permisos
  - `NIVELES`: Niveles académicos y steps
  - `STEP_OVERRIDES`: Overrides manuales de steps por estudiante
  - `FINANCIEROS`: Datos financieros
  - `COMENTARIOS`: Comentarios internos por persona

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
    └── 08-financieros.js            ← FINANCIEROS (endpoint Wix no existe aún)
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

- **FINANCIEROS**: El endpoint Wix `/exportarContratos` falla porque la colección `CONTRATOS` no existe en Wix
- **CLUBS, NIVELES_MATERIAL, COMMENTS, STEP_OVERRIDES**: Endpoints Wix no implementados
- **IP rotation**: El ISP rota IPs entre subredes completamente distintas. Por eso se necesita `0.0.0.0/0` en trusted sources durante la migración
- **SSL**: El `?sslmode=require` de DATABASE_URL se stripea automáticamente en `config.js` (igual que en `src/lib/postgres.ts`), usando `ssl: { rejectUnauthorized: false }` en su lugar

### Última migración exitosa: Feb 15, 2026

| Tabla | Registros | Última actualización |
|---|---|---|
| PEOPLE | 9,130 | 2026-02-15 |
| ACADEMICA | 5,169 | 2026-02-15 |
| CALENDARIO | 18,585 | 2026-02-15 |
| ACADEMICA_BOOKINGS | 101,105 | 2026-02-15 |
| ADVISORS | 45 | 2026-02-02 |
| FINANCIEROS | 0 | N/A (endpoint falta) |

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
- Node.js 18+ required
- Next.js 14 with App Router
- TypeScript with `es2017` target
- TailwindCSS for styling
- React Query v3 (`'react-query'`, NOT `@tanstack/react-query`)

### Troubleshooting Tips
1. If build fails with TypeScript errors, check `tsconfig.json` excludes
2. If authentication fails, verify environment variables are set correctly
3. If caching doesn't work, check localStorage permissions in browser
4. If server-side API calls fail, verify `NEXTAUTH_URL` is set for production

### Security Considerations
- All SQL uses parameterized queries ($1, $2, ...) to prevent injection
- All API routes proxy through the application (no direct DB access from frontend)
- JWT tokens expire based on NextAuth configuration
- No sensitive data logged in production builds

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
  clubs: [...]
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

##### Lógica de completitud de Steps

**1. Normal Steps (1-4, 6-9, 11-14, etc.)**
- Requiere **2 sesiones exitosas** (tipo SESSION) + **1 TRAINING club exitoso** (tipo CLUB)
- Una clase es "exitosa" si `asistio === true` OR `asistencia === true` OR `participacion === true`
- Mensajes diagnósticos específicos según lo que falta:
  - `sesExitosas >= 2, clubs === 0` → "Falta un TRAINING SESSION"
  - `sesExitosas === 1, clubs === 0` → "Falta una sesión (¿quieres realizar la actividad...)"
  - `sesExitosas === 1, clubs >= 1` → "Falta una sesión para terminar. Realiza la prueba escrita..."
  - `sesExitosas === 0, clubs >= 1` → "Faltan dos sesiones"
  - `sesExitosas === 0, clubs === 0` → "Faltan dos sesiones y un TRAINING SESSION"

**2. Jump Steps (5, 10, 15, 20, 25, 30, 35, 40, 45) — múltiplos de 5**
- Requiere **1 clase registrada** en el step + `noAprobo !== true`
- Si `noAprobo === true` → "No aprobó el jump"
- Si no hay clases → "Falta la clase del jump"

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