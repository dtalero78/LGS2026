# Arquitectura del Sistema de Permisos

## 📐 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO (Browser)                         │
│                    email + password                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Auth (NextAuth)                       │
│                    /api/auth/[...nextauth]                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GET /api/wix-proxy/user-role                  │
│                    ?email=usuario@lgs.com                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Wix Backend Function                          │
│                    http-functions.js                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Wix Database                                  │
│                                                                   │
│  ┌─────────────────────┐      ┌──────────────────────────┐      │
│  │  USUARIOS_ROLES     │      │  PERMISOS_PERSONALIZADOS │      │
│  ├─────────────────────┤      ├──────────────────────────┤      │
│  │ email               │      │ email                    │      │
│  │ rol                 │      │ permisos (JSON array)    │      │
│  │ nombre              │      │ notas                    │      │
│  │ activo              │      └──────────────────────────┘      │
│  └─────────────────────┘                                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response: { rol: "ADVISOR" }                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    JWT Token generado                            │
│                    { email, name, role: "ADVISOR" }              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PERMISOS CARGADOS                             │
│                                                                   │
│  1. roles.ts → ADVISOR_PERMISSIONS (default)                    │
│  2. custom-roles.json (si existe override)                       │
│  3. Wix PERMISOS_PERSONALIZADOS (si existe)                     │
│                                                                   │
│  Prioridad: Wix > custom-roles.json > roles.ts                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE (src/middleware.ts)                │
│                    Verifica acceso a rutas                       │
│                    - /dashboard/comercial → [SUPER_ADMIN, ADMIN, COMERCIAL]
│                    - /dashboard/academic → [SUPER_ADMIN, ADMIN, ADVISOR]
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PÁGINA (PermissionGuard)                      │
│                    Verifica permisos específicos                 │
│                    permission={ComercialPermission.MODIFICAR}    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENIDO MOSTRADO                            │
│                    Usuario ve la página/acción permitida         │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo de Verificación de Permisos

### 1. Login del Usuario

```typescript
// Usuario ingresa credenciales
email: "advisor@lgs.com"
password: "Test123!"

// NextAuth llama a authorize()
authorize(credentials) {
  // 1. Consulta Wix para obtener rol
  const wixResponse = await fetch('/api/wix-proxy/user-role?email=advisor@lgs.com')
  // Response: { email: "advisor@lgs.com", rol: "ADVISOR", activo: true }

  // 2. Valida contraseña (en tu sistema)

  // 3. Retorna usuario con rol
  return {
    id: "advisor@lgs.com",
    email: "advisor@lgs.com",
    name: "Advisor de Prueba",
    role: "ADVISOR" // ← Este rol se guarda en el JWT
  }
}
```

### 2. Carga de Permisos

```typescript
// Hook: usePermissions()
const userRole = session?.user?.role // "ADVISOR"

// 1. Intenta cargar desde Wix (si existe)
const wixPermisos = await loadCustomRolesFromWix(email)

// 2. Si no hay en Wix, intenta custom-roles.json
const customPermisos = loadCustomRoles()[userRole]

// 3. Si no hay custom, usa default de roles.ts
const defaultPermisos = getRolePermissions(userRole)

// Resultado final (prioridad)
const userPermissions = wixPermisos || customPermisos || defaultPermisos
```

### 3. Verificación en Middleware

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const userRole = token?.role // "ADVISOR"

  const pathname = request.nextUrl.pathname // "/dashboard/comercial"

  // Define qué roles pueden acceder a qué rutas
  const routePermissions = {
    '/dashboard/comercial': [Role.SUPER_ADMIN, Role.ADMIN, Role.COMERCIAL],
    '/dashboard/academic': [Role.SUPER_ADMIN, Role.ADMIN, Role.ADVISOR],
  }

  // Verifica si el rol tiene acceso
  const allowedRoles = routePermissions['/dashboard/comercial']
  // [SUPER_ADMIN, ADMIN, COMERCIAL]

  const hasAccess = allowedRoles.includes(userRole)
  // false (ADVISOR no está en la lista)

  if (!hasAccess) {
    return NextResponse.redirect(new URL('/', request.url))
    // ← Redirige al home
  }
}
```

### 4. Verificación en Página

```typescript
// src/app/dashboard/comercial/crear-contrato/page.tsx
export default function CrearContratoPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={ComercialPermission.MODIFICAR}>
        {/* Contenido de la página */}
      </PermissionGuard>
    </DashboardLayout>
  )
}

// PermissionGuard internamente hace:
const { hasPermission } = usePermissions()
const userPermissions = [
  "STUDENT.GLOBAL.ENVIAR_MENSAJE",
  "ACADEMICO.AGENDA.CALENDARIO_VER",
  // ... otros permisos de ADVISOR
]

const hasAccess = userPermissions.includes("COMERCIAL.CONTRATO.MODIFICAR")
// false → Muestra mensaje "No tienes permisos para usar esta sección"
```

## 🎯 Tres Capas de Seguridad

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1: MIDDLEWARE (Network Level)                             │
│  ✓ Bloquea rutas antes de cargar la página                      │
│  ✓ Redirecciona a home si no tiene acceso                       │
│  ✓ Basado en ROL (no en permisos granulares)                    │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2: PERMISSION GUARD (Page Level)                          │
│  ✓ Verifica permisos específicos dentro de la página            │
│  ✓ Muestra mensaje "No tienes permisos"                         │
│  ✓ Basado en PERMISOS granulares                                │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3: PERMISSION BUTTON (Action Level)                       │
│  ✓ Deshabilita botones/acciones específicas                     │
│  ✓ Oculta opciones no permitidas                                │
│  ✓ Protección granular por acción                               │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Prioridad de Carga de Permisos

```
┌──────────────────────────────────────────────────────────────┐
│                    PRIORIDAD 1: Wix                           │
│  PERMISOS_PERSONALIZADOS.permisos (por email)                │
│  ✓ Permite override completo                                  │
│  ✓ Gestión desde Wix CMS                                      │
└────────────────────────────┬─────────────────────────────────┘
                             │ Si no existe ↓
┌──────────────────────────────────────────────────────────────┐
│                    PRIORIDAD 2: Archivo Local                 │
│  src/config/custom-roles.json                                 │
│  ✓ Permite personalización sin Wix                            │
│  ✓ Requiere commit para cambiar                               │
└────────────────────────────┬─────────────────────────────────┘
                             │ Si no existe ↓
┌──────────────────────────────────────────────────────────────┐
│                    PRIORIDAD 3: Default                        │
│  src/config/roles.ts (ROLE_PERMISSIONS_MATRIX)                │
│  ✓ Permisos por defecto según matriz oficial                  │
│  ✓ Sincronizado con MATRIZ_PERMISOS.csv                       │
└──────────────────────────────────────────────────────────────┘
```

## 🔐 Ventajas de la Arquitectura con Wix

### ✅ Centralización
- Un solo lugar para gestionar usuarios y roles
- No necesitas modificar código para cambiar roles
- Sincronización automática con otros sistemas Wix

### ✅ Escalabilidad
- Soporta miles de usuarios sin impacto en rendimiento
- Búsquedas indexadas por email
- Historial de cambios automático

### ✅ Flexibilidad
- Permisos por defecto (roles.ts)
- Permisos personalizados por usuario (Wix)
- Override completo cuando sea necesario

### ✅ Auditoría
- Wix mantiene registro de cambios
- Logs de acceso
- Trazabilidad completa

### ✅ Gestión Visual
- Interfaz gráfica en Wix CMS
- No requiere conocimientos técnicos
- Cambios instantáneos (sin deployments)

## 🚀 Migración de Usuarios Actuales

### Opción 1: Migración Manual
1. Exporta usuarios actuales del sistema
2. Importa CSV a Wix
3. Actualiza auth.ts para consultar Wix

### Opción 2: Migración Gradual
1. Mantén usuarios hardcodeados como fallback
2. Primero busca en Wix
3. Si no existe, usa hardcoded
4. Migra usuarios gradualmente

### Código de Migración Gradual

```typescript
async authorize(credentials) {
  // 1. Intenta obtener de Wix
  try {
    const response = await fetch(`/api/wix-proxy/user-role?email=${credentials.email}`)
    if (response.ok) {
      const userData = await response.json()
      if (userData.activo) {
        return {
          id: userData.email,
          email: userData.email,
          name: userData.nombre,
          role: userData.rol,
        }
      }
    }
  } catch (error) {
    console.log('Wix not available, using fallback')
  }

  // 2. Fallback: usuarios hardcodeados
  const testUsers = [/* usuarios de prueba */]
  const user = testUsers.find(u => u.email === credentials.email)
  if (user) {
    return user
  }

  return null
}
```

## 📈 Próximos Pasos

1. ✅ Crear estructura de base de datos
2. ⏳ Configurar colecciones en Wix
3. ⏳ Implementar endpoints de Wix
4. ⏳ Actualizar auth.ts para consultar Wix
5. ⏳ Migrar usuarios existentes
6. ⏳ Probar con diferentes roles
7. ⏳ Documentar para el equipo
8. ⏳ Capacitar administradores en Wix CMS
