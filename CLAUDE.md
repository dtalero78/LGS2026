# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LGS Admin Panel is a Next.js 14 administrative dashboard for "Let's Go Speak" language learning platform. The panel provides management interfaces for students, classes, events, and financial data, integrating with Wix as the primary data source.

## Lista Completa de Funcionalidades

### Autenticación y Acceso
1. Login con email/contraseña
2. Control de acceso basado en roles (RBAC) con 12 roles
3. Carga dinámica de permisos desde Wix con caché de 5 minutos
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
- **Primary Data Source**: Wix backend via API proxy endpoints (`/api/wix-proxy/*`)
- **Authentication**: Hardcoded admin credentials (no database dependency)
- **Client-Side Caching**: localStorage with TTL for calendar/event data
- **Server-Side Rendering**: Next.js App Router with API routes

### Key Directories
- `src/app/` - App Router pages and API routes
- `src/components/` - Reusable UI components organized by feature
- `src/lib/` - Utilities, authentication, and Wix API integration
- `src/types/` - TypeScript definitions and module declarations

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
- Uses NextAuth.js with credentials from Wix `USUARIOS_ROLES` table
- Supports both bcrypt hashed passwords and plain text (legacy compatibility)
- User credentials and roles stored in Wix backend
- Admin fallback credentials via environment variables: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Implementation: `src/lib/auth.ts`
- Password verification: Checks Wix first, then falls back to test users

### Custom Form Validation
- Custom `zodResolver` implementation in `src/lib/zod-resolver.ts`
- Replaced `@hookform/resolvers` to avoid peer dependency issues
- Only supports Zod schemas

### Wix API Integration
- All data operations proxy through `/api/wix-proxy/*` endpoints
- Server-side API calls use `process.env.NEXTAUTH_URL` for correct URL resolution
- Client-side calls use relative URLs
- Implementation: `src/lib/wix.ts:47-74`

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
NEXT_PUBLIC_WIX_API_BASE_URL=https://www.lgsplataforma.com/_functions
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
- **No MongoDB dependency** - authentication and permissions use Wix backend
- All business data stored in Wix
- Legacy MongoDB code remains but is unused
- Key Wix tables:
  - `USUARIOS_ROLES`: User credentials, roles, and basic info
  - `ROL_PERMISOS`: Role definitions with permission arrays
  - Other business tables: Students, Events, Contracts, etc.

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
POST /api/wix-proxy/toggle-student-onhold
{
  studentId: "abc123",
  setOnHold: true,
  fechaOnHold: "2025-07-01",
  fechaFinOnHold: "2025-07-31",
  motivo: "Vacaciones"
}

// Backend updates PEOPLE table:
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

#### Data Flow - Deactivating OnHold (NEW: Automatic Extension)
```javascript
// User deactivates OnHold via StudentOnHold component
POST /api/wix-proxy/toggle-student-onhold
{
  studentId: "abc123",
  setOnHold: false
}

// Backend (search.jsw:toggleUserStatus):
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
  extensionHistory: [{           // ← NEW: Auto-extension entry
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

#### Backend (Wix)
- **`backend/search.jsw:toggleUserStatus`** (line ~1279-1340)
  - Handles OnHold activation/deactivation
  - Calculates paused days when deactivating
  - Automatically extends `finalContrato`
  - Creates `extensionHistory` entry
  - Updates `extensionCount`

#### Frontend (Next.js)
- **`src/app/api/wix-proxy/toggle-student-onhold/route.ts`**
  - API proxy to Wix `toggleUserStatus` function
  - Passes `studentId`, `setOnHold`, `fechaOnHold`, `fechaFinOnHold`, `motivo`

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

### Deployment Instructions

See detailed deployment guide: [DESPLEGAR_ONHOLD_AUTO_EXTENSION.md](DESPLEGAR_ONHOLD_AUTO_EXTENSION.md)

Quick summary:
1. Open Wix Editor → Velo backend
2. Edit `backend/search.jsw`
3. Find `toggleUserStatus` function (line ~1279)
4. Replace OnHold deactivation logic (6 lines)
5. Save and Publish

### Testing

After deployment:
1. Activate OnHold on a test student (e.g., 10 days)
2. Verify `onHoldCount` incremented
3. Deactivate OnHold
4. Verify `finalContrato` extended by 10 days
5. Verify `extensionCount` incremented
6. Check `extensionHistory` contains entry with OnHold motivo
7. View extension history in frontend modal

## Permissions System (RBAC - Role-Based Access Control)

### Overview
The application implements a comprehensive RBAC system that loads permissions dynamically from Wix. All permission checks are synchronized across:
- **Middleware** (route access control)
- **Frontend UI** (menu visibility and component rendering)
- **API endpoints** (server-side permission verification)

### Architecture

#### 1. Wix as Source of Truth
- **Table**: `ROL_PERMISOS` in Wix database
- **Structure**: Each role has an array of permission strings
- **Wix Endpoint**: `https://www.lgsplataforma.com/_functions/rolePermissions?rol=ROLENAME`
- **Wix Endpoint (All Roles)**: `https://www.lgsplataforma.com/_functions/allRoles`

Example Wix data for TALERO role:
```json
{
  "success": true,
  "rol": "TALERO",
  "permisos": ["ACADEMICO.ADVISOR.LISTA_VER"],
  "descripcion": "Talero - Gestión de servicios y soporte"
}
```

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

Defines all permission constants synchronized with Wix:
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

**Important**: These enums MUST match exactly with Wix permission strings.

#### 2. Middleware Permission System
**File**: `src/lib/middleware-permissions.ts`

Core functions:
- `getPermissionsForRoleFromWix(role)`: Loads permissions from Wix with 5-minute cache
- `hasAccessToRoute(pathname, userPermissions)`: Verifies route access
- `ROUTE_PERMISSIONS`: Maps specific routes to required permissions
- `GENERIC_ROUTE_ACCESS`: Maps parent routes to any child permission

**File**: `src/middleware.ts`

Middleware flow:
1. Check if user is authenticated
2. SUPER_ADMIN/ADMIN get full access
3. For other roles: Load permissions from Wix (cached)
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
  permissionsSource    // 'wix' or 'fallback'
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
- Loads data directly from Wix ROL_PERMISOS table
- Source indicator shows if data is from 'wix' or 'fallback'
- "Volver al Dashboard" button returns to `/` (root/homepage)

#### Modifying Permissions
1. **Via Wix Dashboard** (Recommended):
   - Edit ROL_PERMISOS table directly in Wix
   - Changes take effect within 5 minutes (cache TTL)
   - No code deployment needed

2. **Via API** (Advanced):
   ```typescript
   // Update permissions for a role
   POST /api/roles/update
   {
     "rol": "TALERO",
     "permisos": ["ACADEMICO.ADVISOR.LISTA_VER", "NEW.PERMISSION"]
   }
   ```

#### Creating New Roles
```typescript
POST /api/roles/create
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
1. Check user's role in Wix `USUARIOS_ROLES` table
2. Check role's permissions in Wix `ROL_PERMISOS` table
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
2. Verify `permissionsSource: 'wix'` (not 'fallback')
3. Check `DashboardLayout` logs for menu filtering:
   ```
   Académico: ✅
   Servicio: ❌
   ```

#### Permissions Not Updating
1. Wait 5 minutes for cache to expire
2. Force logout and login again
3. Check if changes were saved in Wix ROL_PERMISOS
4. Verify Digital Ocean deployment completed successfully

### Adding New Permissions

#### Step 1: Add to Wix
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

## File Structure and Key Components

### Authentication Flow
1. User enters credentials on `/login` page
2. NextAuth validates against environment variables in `src/lib/auth.ts`
3. JWT token created with user role
4. Protected routes check session status

### Calendar System
1. Events loaded from Wix via `/api/wix-proxy/calendario-events`
2. Data cached in localStorage with 5-minute TTL
3. Enrollment data loaded separately in batches
4. Cache invalidated on any CRUD operation

### Student Management
1. Search functionality via Wix API (`searchByName`, `searchByDocument`, `searchByContract`)
2. Student details loaded via `/api/wix-proxy/student-by-id`
3. Classes and enrollment data fetched separately

### Data Export
- CSV export functionality for calendar events
- Excel export for student data
- PDF generation for reports using `@react-pdf/renderer`

## Development Notes

### Known Working Configurations
- Node.js 18+ required
- Next.js 14 with App Router
- TypeScript with `es2017` target
- TailwindCSS for styling
- React Query for data fetching

### Troubleshooting Tips
1. If build fails with TypeScript errors, check `tsconfig.json` excludes
2. If authentication fails, verify environment variables are set correctly
3. If caching doesn't work, check localStorage permissions in browser
4. If server-side API calls fail, verify `NEXTAUTH_URL` is set for production

### Security Considerations
- Hardcoded credentials should only be used for demo/development
- All API routes proxy through the application (no direct Wix access from frontend)
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

#### NIVELES (Wix Collection)
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

#### ACADEMICA (Wix Collection)
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

#### PEOPLE (Wix Collection)
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

### Funciones Modificadas

#### 1. updateStudentStep
**Archivo**: `src/backend/FUNCIONES WIX/search.jsw:2097-2177`

**Lógica**:
- Detecta si el nuevo step pertenece a un nivel paralelo consultando `NIVELES.esParalelo`
- Si `esParalelo === true`: Actualiza `nivelParalelo` y `stepParalelo` en ACADEMICA y PEOPLE
- Si `esParalelo === false`: Actualiza `nivel` y `step` (comportamiento original)

**Uso**:
```javascript
// Cambiar estudiante a ESS (nivel paralelo)
await updateStudentStep({
  numeroId: "1234567890",
  newStep: "0"  // ESS Step 0
});
// Resultado: nivelParalelo = "ESS", nivel principal no cambia

// Cambiar estudiante a BN2 (nivel principal)
await updateStudentStep({
  numeroId: "1234567890",
  newStep: "6"  // BN2 Step 6
});
// Resultado: nivel = "BN2", nivelParalelo no cambia
```

#### 2. cargarStepsDelNivel
**Archivo**: `src/backend/FUNCIONES WIX/search.jsw:2327-2580`

**Cambio**: Retorna campo adicional `esParalelo` para indicar si el nivel consultado es paralelo.

```javascript
return {
  success: true,
  steps: [...],
  nivel: "ESS",
  esParalelo: true,  // Nuevo campo
  totalSteps: 1
};
```

#### 3. getStudentProgress (Diagnóstico "¿Cómo voy?")
**Archivo**: `src/backend/FUNCIONES WIX/search.jsw:4896-5198`

**Lógica**:
- Usa solo `nivel` (nivel principal) para generar el diagnóstico
- **EXCLUYE** explícitamente ESS del diagnóstico de steps
- Incluye todas las clases (incluyendo ESS) en la tabla "Todas las clases" para tracking
- Muestra nivel paralelo en la información del estudiante pero NO lo evalúa

**Filtro clave**:
```javascript
const clasesNivelActual = classes.filter(c =>
  c.nivel === nivelPrincipal &&
  c.step !== 'WELCOME' &&
  c.nivel !== 'ESS'  // Excluir ESS del diagnóstico
);
```

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
2. Generar diagnóstico: `getStudentProgress(studentId)`
3. **Resultado**:
   - Diagnóstico por steps: Solo muestra progreso de BN2
   - Tabla "Todas las clases": Incluye sesiones de ESS para referencia
   - No evalúa completitud de ESS

### Despliegue

Ver guía completa de despliegue: [DESPLEGAR_ESS_PARALELO.md](DESPLEGAR_ESS_PARALELO.md)

**Pasos resumidos:**

1. **Base de Datos Wix:**
   - Agregar campo `esParalelo` en NIVELES (Boolean, default: false)
   - Marcar ESS con `esParalelo: true`
   - Agregar campos `nivelParalelo` y `stepParalelo` en ACADEMICA y PEOPLE (Text, opcional)

2. **Backend Wix:**
   - Actualizar funciones `updateStudentStep`, `cargarStepsDelNivel`, `getStudentProgress`
   - Código completo en: [CODIGO_MODIFICADO_ESS_PARALELO.js](CODIGO_MODIFICADO_ESS_PARALELO.js)

3. **Frontend Next.js:**
   - Tipos TypeScript ya actualizados en `src/types/index.ts`
   - Componentes se actualizarán automáticamente al recibir nuevos campos

### Notas Importantes

- **Retrocompatibilidad**: Estudiantes sin nivel paralelo siguen funcionando normalmente
- **ESS Step 0 especial**: Sigue usando lógica de 5 semanas para aprobación automática
- **No migración necesaria**: Los campos nuevos son opcionales, no requieren actualizar registros existentes
- **Jump Steps**: Funcionan igual en niveles paralelos y principales