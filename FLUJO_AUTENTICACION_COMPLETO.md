# Flujo de Autenticación y Autorización Completo

## Resumen Ejecutivo

El sistema de autenticación y autorización de LGS Admin Panel integra **3 capas de seguridad**:

1. **Autenticación** → Verifica identidad del usuario en Wix
2. **Autorización de Rutas** → Middleware bloquea acceso a rutas prohibidas
3. **Autorización de Contenido** → PermissionGuard protege secciones específicas dentro de páginas

---

## Flujo Completo: Desde Login hasta Página Protegida

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USUARIO INGRESA CREDENCIALES                                  │
│    Email: advisor@lgs.com                                        │
│    Password: Test123!                                             │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. NextAuth authorize() en src/lib/auth.ts                       │
│                                                                   │
│    ┌─────────────────────────────────────────────────┐          │
│    │ PASO 1: Consultar Wix USUARIOS_ROLES            │          │
│    │ GET /api/wix-proxy/user-role?email=...          │          │
│    │                                                  │          │
│    │ Wix responde:                                   │          │
│    │ {                                                │          │
│    │   success: true,                                 │          │
│    │   email: "advisor@lgs.com",                     │          │
│    │   rol: "ADVISOR",                               │          │
│    │   nombre: "Advisor de Prueba",                  │          │
│    │   activo: true                                  │          │
│    │ }                                                │          │
│    └─────────────────────────────────────────────────┘          │
│                                                                   │
│    ┌─────────────────────────────────────────────────┐          │
│    │ PASO 2: Verificar contraseña                    │          │
│    │ (En pruebas: comparar con Test123!)             │          │
│    │ (En producción: comparar con hash en Wix)       │          │
│    └─────────────────────────────────────────────────┘          │
│                                                                   │
│    ┌─────────────────────────────────────────────────┐          │
│    │ PASO 3: Crear token JWT con rol de Wix          │          │
│    │ {                                                │          │
│    │   id: "3",                                       │          │
│    │   email: "advisor@lgs.com",                     │          │
│    │   name: "Advisor de Prueba",                    │          │
│    │   role: "ADVISOR"  ← VIENE DE WIX               │          │
│    │ }                                                │          │
│    └─────────────────────────────────────────────────┘          │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. JWT ALMACENADO EN SESIÓN                                      │
│    Token contiene: { role: "ADVISOR" }                           │
│    Usuario redirigido a: /dashboard                              │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. USUARIO INTENTA ACCEDER A /dashboard/comercial/crear-contrato │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. MIDDLEWARE (src/middleware.ts) INTERCEPTA                     │
│                                                                   │
│    ┌─────────────────────────────────────────────────┐          │
│    │ Extrae rol del JWT: "ADVISOR"                   │          │
│    └─────────────────────────────────────────────────┘          │
│                                                                   │
│    ┌─────────────────────────────────────────────────┐          │
│    │ Consulta whitelist de rutas permitidas:         │          │
│    │                                                  │          │
│    │ roleRouteAccess = {                             │          │
│    │   'ADVISOR': [                                  │          │
│    │     '/dashboard/academic',                      │          │
│    │     '/panel-advisor'                            │          │
│    │   ]                                              │          │
│    │ }                                                │          │
│    └─────────────────────────────────────────────────┘          │
│                                                                   │
│    ┌─────────────────────────────────────────────────┐          │
│    │ Verifica si /dashboard/comercial está en lista  │          │
│    │ ❌ NO ESTÁ                                       │          │
│    │                                                  │          │
│    │ BLOQUEA ACCESO → Redirect a /dashboard          │          │
│    └─────────────────────────────────────────────────┘          │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. USUARIO REDIRIGIDO A /dashboard                               │
│    (No puede acceder a rutas comerciales)                        │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ 7. USUARIO INTENTA ACCEDER A /dashboard/academic/agenda-sesiones │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ 8. MIDDLEWARE VERIFICA RUTA                                      │
│                                                                   │
│    '/dashboard/academic' está en allowedRoutes                   │
│    ✅ ACCESO PERMITIDO                                           │
│    → Continúa a la página                                        │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ 9. PÁGINA RENDERIZA (agenda-sesiones/page.tsx)                   │
│                                                                   │
│    <PermissionGuard                                              │
│      permission={AcademicoPermission.FILTRO}                     │
│    >                                                              │
│      {/* Sección de filtros */}                                  │
│    </PermissionGuard>                                            │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ 10. PermissionGuard VERIFICA PERMISO                             │
│                                                                   │
│     usePermissions() → Obtiene rol "ADVISOR" de sesión           │
│                                                                   │
│     getRolePermissions("ADVISOR") en src/config/roles.ts:        │
│     [                                                             │
│       "ACADEMICO.AGENDA.FILTRO", ← TIENE ESTE PERMISO            │
│       "ACADEMICO.AGENDA.VER",                                    │
│       "STUDENT.ACADEMIA.EVALUACION",                             │
│       ...                                                         │
│     ]                                                             │
│                                                                   │
│     hasPermission("ACADEMICO.AGENDA.FILTRO") → ✅ TRUE           │
│                                                                   │
│     → MUESTRA EL CONTENIDO                                       │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ 11. USUARIO VE LA SECCIÓN DE FILTROS                             │
│     Pero NO ve botones de "Eliminar Evento" (sin ese permiso)    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Verificación en Wix: ¿El Usuario Está Activo?

### ¿Cuándo se verifica?

**Durante el login** en [src/lib/auth.ts:23-42](src/lib/auth.ts#L23-L42)

### Pasos exactos:

1. Usuario ingresa email y contraseña
2. `authorize()` consulta `/api/wix-proxy/user-role?email=...`
3. El endpoint llama a Wix: `https://www.lgsplataforma.com/_functions/userRole`
4. Wix consulta tabla `USUARIOS_ROLES`:
   ```javascript
   wixData.query("USUARIOS_ROLES")
     .eq("email", "advisor@lgs.com")
     .find()
   ```
5. Wix retorna:
   ```json
   {
     "success": true,
     "email": "advisor@lgs.com",
     "rol": "ADVISOR",
     "nombre": "Advisor de Prueba",
     "activo": true  ← VERIFICADO AQUÍ
   }
   ```
6. Si `activo === false`, el login **falla** y el usuario no puede entrar
7. Si `activo === true`, se crea el JWT con el rol

### Código en Wix (http-functions.js):

```javascript
export async function get_userRole(request) {
  const email = request.query.email;

  const results = await wixData.query("USUARIOS_ROLES")
    .eq("email", email)
    .find();

  if (results.items.length === 0) {
    return ok({ body: { success: false, error: 'Usuario no encontrado' }});
  }

  const user = results.items[0];

  // ⬇️ AQUÍ SE VERIFICA SI ESTÁ ACTIVO
  if (!user.activo) {
    return ok({ body: { success: false, error: 'Usuario desactivado' }});
  }

  return ok({
    body: {
      success: true,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre,
      activo: user.activo
    }
  });
}
```

---

## ¿Dónde se Establecen los Permisos de Cada Rol?

### Respuesta Corta:
En [src/config/roles.ts](src/config/roles.ts) - **NO en Wix**

### Estructura:

```typescript
// ADVISOR solo puede ver y gestionar académico
const ADVISOR_PERMISSIONS: Permission[] = [
  // PERSON
  PersonPermission.VER_DOCUMENTACION,
  PersonPermission.WHATSAPP,

  // STUDENT
  StudentPermission.ENVIAR_MENSAJE,
  StudentPermission.EVALUACION,
  StudentPermission.AGENDAR_CLASE,
  StudentPermission.MARCAR_STEP,

  // ACADEMICO
  AcademicoPermission.VER_CALENDARIO,
  AcademicoPermission.VER_AGENDA,
  AcademicoPermission.FILTRO,
  AcademicoPermission.NUEVO_EVENTO,
  AcademicoPermission.EDITAR,
  AcademicoPermission.CREAR_EVENTO,
  AcademicoPermission.VER_AGENDA_ACADEMICA,
  AcademicoPermission.VER_ENLACE,

  // SERVICIO (solo welcome sessions)
  ServicioPermission.WELCOME_CARGAR_EVENTOS,
  ServicioPermission.WELCOME_EXPORTAR_CSV,
];

// COMERCIAL solo puede ver comercial y aprobación
const COMERCIAL_PERMISSIONS: Permission[] = [
  // PERSON
  PersonPermission.VER_DOCUMENTACION,
  PersonPermission.ADICION_DOCUMENTACION,
  PersonPermission.CAMBIO_CELULAR,
  PersonPermission.CAMBIAR_ESTADO,
  PersonPermission.MODIFICAR,
  PersonPermission.AGREGAR_BENEFICIARIO,
  PersonPermission.WHATSAPP,

  // STUDENT
  StudentPermission.ENVIAR_MENSAJE,
  StudentPermission.CONSULTA_CONTRATO,
  StudentPermission.GENERAR_ESTADO_CUENTA,

  // COMERCIAL
  ComercialPermission.MODIFICAR,
  ComercialPermission.ENVIAR_PDF,
  ComercialPermission.DESCARGAR,
  ComercialPermission.APROBACION_AUTONOMA,
  ComercialPermission.VER_PROSPECTOS,

  // APROBACION
  AprobacionPermission.ACTUALIZAR,
  AprobacionPermission.EXPORTAR_CSV,
  AprobacionPermission.MODIFICAR_CONTRATO,
  AprobacionPermission.ENVIAR_PDF,
  AprobacionPermission.DESCARGAR,
  AprobacionPermission.APROBACION_AUTONOMA,
];
```

### Exportación Final:

```typescript
export const getRolePermissions = (role: Role): Permission[] => {
  switch (role) {
    case 'SUPER_ADMIN':
      return SUPER_ADMIN_PERMISSIONS; // TODOS los permisos
    case 'ADMIN':
      return ADMIN_PERMISSIONS;
    case 'ADVISOR':
      return ADVISOR_PERMISSIONS; // Solo académico + servicio limitado
    case 'COMERCIAL':
      return COMERCIAL_PERMISSIONS; // Solo comercial + aprobación
    case 'APROBADOR':
      return APROBADOR_PERMISSIONS;
    case 'TALERO':
      return TALERO_PERMISSIONS;
    case 'FINANCIERO':
      return FINANCIERO_PERMISSIONS;
    case 'SERVICIO':
      return SERVICIO_PERMISSIONS;
    case 'READONLY':
      return READONLY_PERMISSIONS; // Solo lectura
    default:
      return [];
  }
};
```

---

## Diferencia: Wix vs. Next.js

| Aspecto | Almacenado en Wix | Almacenado en Next.js |
|---------|-------------------|-----------------------|
| **Usuario → Rol** | ✅ Tabla `USUARIOS_ROLES` | ❌ |
| **Estado activo** | ✅ Campo `activo` en Wix | ❌ |
| **Rol → Permisos** | ❌ | ✅ `src/config/roles.ts` |
| **Catálogo de permisos** | ❌ | ✅ `src/config/permissions.ts` |
| **Rutas permitidas** | ❌ | ✅ `src/middleware.ts` |

### Flujo completo:

1. **Wix dice**: "Este usuario es ADVISOR y está activo"
2. **Next.js dice**: "ADVISOR tiene estos 25 permisos específicos"
3. **Middleware dice**: "ADVISOR puede acceder a estas 2 rutas principales"
4. **PermissionGuard dice**: "ADVISOR puede ver esta sección específica"

---

## Cómo Modificar Permisos

### Cambiar Permisos de un Rol:

Edita [src/config/roles.ts](src/config/roles.ts):

```typescript
const ADVISOR_PERMISSIONS: Permission[] = [
  // ... permisos existentes ...

  // ✅ AGREGAR NUEVO PERMISO
  ComercialPermission.VER_PROSPECTOS, // Ahora ADVISOR puede ver prospectos
];
```

### Cambiar Rol de un Usuario:

En Wix Studio:
1. Abre colección `USUARIOS_ROLES`
2. Busca usuario por email
3. Cambia campo `rol` (ej: de "ADVISOR" a "ADMIN")
4. Usuario debe hacer logout/login para ver cambios

**O por API:**
```javascript
// En Wix backend
await wixData.update("USUARIOS_ROLES", {
  _id: "usuario-id",
  rol: "ADMIN"
});
```

### Desactivar un Usuario:

En Wix Studio:
1. Busca usuario en `USUARIOS_ROLES`
2. Cambia `activo: true` → `activo: false`
3. Usuario no podrá hacer login

---

## Modo Fallback: Sin Wix

Si Wix no está disponible o el usuario no existe en `USUARIOS_ROLES`, el sistema usa **usuarios de prueba locales** definidos en [src/lib/auth.ts:142-206](src/lib/auth.ts#L142-L206).

### Comportamiento:

```javascript
// Si Wix falla o usuario no existe
console.log('⚠️ Usando usuarios de prueba locales (Wix no disponible)');

// Verifica contra usuarios hardcodeados
const testUsers = [
  { email: 'advisor@lgs.com', password: 'Test123!', role: 'ADVISOR' },
  { email: 'comercial@lgs.com', password: 'Test123!', role: 'COMERCIAL' },
  // ...
];
```

**Ventajas:**
- Sistema funciona incluso si Wix está caído
- Desarrollo local sin necesidad de Wix
- Testing con usuarios predefinidos

**Desventajas:**
- No verifica estado `activo` en Wix
- Roles no reflejan cambios en tiempo real de Wix

---

## Logs de Debug

### Para ver el flujo completo:

1. **Login attempt:**
   ```
   🔍 Auth Debug: { inputEmail: 'advisor@lgs.com', inputPassword: '***' }
   ```

2. **Wix verification:**
   ```
   ✅ Usuario verificado en Wix: { email: 'advisor@lgs.com', rol: 'ADVISOR', activo: true }
   ```

3. **Login success:**
   ```
   ✅ Login exitoso con rol de Wix: ADVISOR
   ```

4. **Middleware check:**
   ```
   🔐 Middleware check: { pathname: '/dashboard/academic', userRole: 'ADVISOR' }
   ✅ Access GRANTED to /dashboard/academic for role ADVISOR
   ```

5. **Permission check:**
   ```
   🔐 usePermissions DEBUG: { userRole: 'ADVISOR', permissionsCount: 25 }
   ```

---

## Próximos Pasos

### Para Producción Completa:

1. ✅ **Publicar backend en Wix Studio**
   - Subir `search.jsw` con funciones de roles
   - Subir `http-functions.js` con endpoints
   - Verificar permisos de Public en Wix Studio

2. ✅ **Importar usuarios a Wix**
   - Crear colección `USUARIOS_ROLES` en Wix CMS
   - Importar `wix-database/USUARIOS_ROLES.csv`

3. ⏳ **Configurar contraseñas reales**
   - Actualmente usa contraseñas de prueba
   - En producción: almacenar hashes en Wix o usar OAuth

4. ⏳ **Testing end-to-end**
   - Verificar login consulta Wix correctamente
   - Probar desactivación de usuarios
   - Verificar cambios de rol se reflejan

5. ⏳ **Variables de entorno en Digital Ocean**
   - Asegurar `NEXTAUTH_URL` está configurada
   - Verificar `NEXT_PUBLIC_WIX_API_BASE_URL` apunta a producción

---

## Resumen Final

### ¿Dónde se establecen los permisos de cada rol?
**Respuesta:** En `src/config/roles.ts` del código Next.js

### ¿El login verifica en Wix si está activo?
**Respuesta:** Sí, en `src/lib/auth.ts` líneas 23-42, consulta Wix y verifica `activo: true`

### ¿Qué hace Wix?
- Almacena usuarios y sus roles
- Verifica estado activo/inactivo
- Puede personalizar permisos específicos (opcional)

### ¿Qué hace Next.js?
- Define qué permisos tiene cada rol
- Bloquea rutas según rol (middleware)
- Protege secciones específicas (PermissionGuard)

---

**Fecha de creación:** 2025-10-12
**Branch:** deployment-cleanup
**Archivos relacionados:**
- `src/lib/auth.ts` (líneas 12-238)
- `src/app/api/wix-proxy/user-role/route.ts`
- `src/config/roles.ts`
- `src/middleware.ts`
- `src/backend/FUNCIONES WIX/http-functions.js` (líneas 3339-3646)
