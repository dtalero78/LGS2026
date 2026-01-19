# Sistema de Autenticación Completo en Wix

## Descripción General

El sistema de autenticación, roles y permisos ahora está **100% centralizado en Wix**. Ya no es necesario modificar código en Next.js para agregar usuarios, cambiar contraseñas o modificar permisos.

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario Ingresa Login                     │
│                   (email + password)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Next.js auth.ts                           │
│                                                              │
│  1. Consulta Wix USUARIOS_ROLES por email                   │
│  2. Verifica que user.activo = true                          │
│  3. Compara password con hash bcrypt de Wix                  │
│  4. Si válido → Crea JWT con rol de Wix                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               JWT Token (almacenado en cookie)               │
│                                                              │
│  {                                                           │
│    email: "admin@lgs.com",                                   │
│    role: "ADMIN",  ← Viene de Wix                            │
│    name: "Administrador"                                     │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            Usuario Navega → Middleware Protege               │
│                                                              │
│  Consulta permisos del rol en Wix ROL_PERMISOS              │
│  Verifica si rol tiene permiso para la ruta                 │
│  Cache de 5 minutos para performance                         │
└─────────────────────────────────────────────────────────────┘
```

## Bases de Datos en Wix

### 1. USUARIOS_ROLES (Usuarios y Contraseñas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `_id` | Text | ID único del usuario |
| `email` | Text | Email del usuario (único) |
| `password` | Text | Hash bcrypt de la contraseña |
| `rol` | Text | Rol del usuario (ADMIN, ADVISOR, etc.) |
| `nombre` | Text | Nombre completo del usuario |
| `activo` | Boolean | Si el usuario puede hacer login |
| `fechaCreacion` | Date | Fecha de creación |
| `fechaActualizacion` | Date | Fecha de última actualización |

**Ejemplo de registro:**
```javascript
{
  _id: "1",
  email: "admin@lgs.com",
  password: "$2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq",
  rol: "ADMIN",
  nombre: "Administrador",
  activo: true,
  fechaCreacion: "2025-01-15",
  fechaActualizacion: "2025-01-15"
}
```

**Contraseña por defecto:** Todos los usuarios tienen `Test123!` (hasheada con bcrypt)

### 2. ROL_PERMISOS (Permisos por Rol)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `_id` | Text | ID único del rol |
| `rol` | Text | Nombre del rol (ADMIN, ADVISOR, etc.) |
| `permisos` | Array | Array de strings con permisos |
| `activo` | Boolean | Si el rol está activo |
| `descripcion` | Text | Descripción del rol |
| `fechaCreacion` | Date | Fecha de creación |
| `fechaActualizacion` | Date | Fecha de última actualización |

**Ejemplo de registro:**
```javascript
{
  _id: "2",
  rol: "ADMIN",
  permisos: [
    "PERSON.INFO.VER_DOCUMENTACION",
    "PERSON.INFO.VER_CONTRATOS",
    "STUDENT.GLOBAL.ENVIAR_MENSAJE",
    // ... 40 permisos más
  ],
  activo: true,
  descripcion: "Administrador - Acceso completo excepto gestión de permisos",
  fechaCreacion: "2025-01-15",
  fechaActualizacion: "2025-01-15"
}
```

## Flujo de Autenticación Detallado

### 1. Login

```typescript
// Usuario ingresa: admin@lgs.com / Test123!

// PASO 1: Next.js consulta Wix
const wixResponse = await fetch(
  `${baseUrl}/api/wix-proxy/user-role?email=admin@lgs.com`
);

// Wix devuelve:
{
  success: true,
  email: "admin@lgs.com",
  password: "$2a$10$7X9vQKXjZ4zF5Y2hL3xKxO...", // Hash bcrypt
  rol: "ADMIN",
  nombre: "Administrador",
  activo: true
}

// PASO 2: Next.js verifica contraseña con bcrypt
const isPasswordValid = await bcrypt.compare("Test123!", wixPassword);

// PASO 3: Si válido, crea JWT con rol de Wix
return {
  id: "admin@lgs.com",
  email: "admin@lgs.com",
  name: "Administrador",
  role: "ADMIN" // ← Del registro de Wix
};
```

### 2. Verificación de Permisos

```typescript
// Usuario con rol ADMIN navega a /dashboard/academic/agenda-sesiones

// PASO 1: Middleware consulta permisos del rol en Wix (con cache de 5 min)
const permisos = await getPermissionsByRole("ADMIN");

// Wix devuelve:
[
  "ACADEMICO.AGENDA.VER_CALENDARIO",
  "ACADEMICO.AGENDA.VER_AGENDA",
  "ACADEMICO.AGENDA.EDITAR",
  // ... más permisos
]

// PASO 2: Verifica si tiene permiso necesario
if (permisos.includes("ACADEMICO.AGENDA.VER_AGENDA")) {
  // ✅ Permitir acceso
} else {
  // ❌ Redirigir a /unauthorized
}
```

## Ventajas del Sistema Centralizado

### ✅ Sin Deployments para Cambios de Usuarios
- **Antes**: Modificar auth.ts → git commit → git push → esperar deploy (5-10 min)
- **Ahora**: Modificar en Wix CMS → cambio inmediato

### ✅ Sin Deployments para Cambios de Permisos
- **Antes**: Modificar roles.ts → git commit → git push → esperar deploy
- **Ahora**: Modificar en /admin/permissions → cambio inmediato

### ✅ Gestión de Contraseñas Segura
- Contraseñas hasheadas con bcrypt (salt rounds: 10)
- Hash almacenado en Wix, nunca en texto plano
- Next.js solo compara hash, no almacena contraseñas

### ✅ Gestión de Usuarios sin Código
- Agregar usuario: Crear registro en Wix USUARIOS_ROLES
- Desactivar usuario: Cambiar `activo: false` en Wix
- Cambiar rol: Modificar campo `rol` en Wix
- Cambiar contraseña: Actualizar campo `password` con nuevo hash

### ✅ Performance Optimizada
- Cache de 5 minutos para permisos en memoria
- Fallback a permisos hardcodeados si Wix falla
- Invalidación automática de cache al modificar permisos

## Cómo Usar el Sistema

### Agregar un Nuevo Usuario

1. **Hashear la contraseña** (puedes usar: https://bcrypt-generator.com/)
   - Input: `MiPassword123!`
   - Output: `$2a$10$abcd1234...xyz`

2. **Crear registro en Wix CMS** (tabla USUARIOS_ROLES):
   ```javascript
   {
     email: "nuevo@lgs.com",
     password: "$2a$10$abcd1234...xyz",
     rol: "ADVISOR",
     nombre: "Nuevo Usuario",
     activo: true,
     fechaCreacion: new Date(),
     fechaActualizacion: new Date()
   }
   ```

3. **Login inmediato** - No se requiere deploy

### Modificar Permisos de un Rol

1. **Login como SUPER_ADMIN** en el panel
2. **Ir a** `/admin/permissions`
3. **Seleccionar el rol** que quieres modificar
4. **Marcar/desmarcar permisos**
5. **Guardar cambios**

Los cambios se guardan en Wix y el cache se invalida automáticamente.

### Cambiar Contraseña de un Usuario

1. **Hashear la nueva contraseña** con bcrypt
2. **Actualizar campo `password`** en Wix CMS (tabla USUARIOS_ROLES)
3. **Actualizar `fechaActualizacion`** a fecha actual

El usuario podrá hacer login inmediatamente con la nueva contraseña.

### Desactivar un Usuario

1. **En Wix CMS**, tabla USUARIOS_ROLES
2. **Cambiar campo `activo`** a `false`
3. **Guardar**

El usuario ya no podrá hacer login (incluso con contraseña correcta).

## Seguridad

### Hashing de Contraseñas
- Algoritmo: **bcrypt** con 10 salt rounds
- No reversible: Imposible obtener contraseña original del hash
- Verificación: `bcrypt.compare(inputPassword, storedHash)`

### Protección de Rutas
- **Nivel 1**: Middleware verifica JWT y permisos de rol
- **Nivel 2**: PermissionGuard en páginas verifica permisos específicos
- **Nivel 3**: PermissionButton oculta botones sin permiso

### Fallback por Seguridad
Si Wix no está disponible:
- Sistema usa permisos hardcodeados en Next.js
- Permite que la aplicación siga funcionando
- Logs de advertencia para debugging

## Roles Disponibles

| Rol | Cantidad Permisos | Descripción |
|-----|-------------------|-------------|
| `SUPER_ADMIN` | 41 | Acceso completo incluyendo gestión de permisos |
| `ADMIN` | 40 | Acceso administrativo general (sin gestión de permisos) |
| `ADVISOR` | 16 | Asesor académico - gestión de estudiantes y clases |
| `COMERCIAL` | 21 | Gestión comercial y contratos |
| `APROBADOR` | 12 | Aprobación de beneficiarios |
| `TALERO` | 15 | Gestión de tareas específicas |
| `FINANCIERO` | 4 | Solo visualización de reportes financieros |
| `SERVICIO` | 9 | Servicio al cliente - welcome sessions |
| `READONLY` | 2 | Solo lectura - sin permisos de modificación |

## Troubleshooting

### ❌ No puedo hacer login con usuario nuevo

**Verificar:**
1. El campo `activo` está en `true` en Wix USUARIOS_ROLES
2. El email está escrito exactamente igual (case sensitive)
3. El hash de contraseña es válido (debe empezar con `$2a$10$`)
4. El rol existe en ROL_PERMISOS

**Logs útiles:**
```bash
# Ver logs de autenticación
# En consola del servidor Next.js verás:
✅ Usuario verificado en Wix: { email: '...', rol: '...', activo: true }
✅ Login exitoso con credenciales de Wix: ADMIN
```

### ❌ Usuario puede hacer login pero no ve nada

**Problema:** El rol no tiene permisos asignados

**Solución:**
1. Verificar que el rol existe en tabla ROL_PERMISOS de Wix
2. Verificar que el rol tiene permisos en el array `permisos`
3. Invalidar cache: POST a `/api/admin/invalidate-permissions-cache`

### ❌ Cambié permisos pero no se aplican

**Problema:** Cache de 5 minutos

**Solución:**
- **Opción 1**: Esperar 5 minutos
- **Opción 2**: Invalidar cache manualmente
- **Opción 3**: Hacer logout y login nuevamente (refresca JWT)

### ❌ Error "Usuario en Wix no tiene contraseña configurada"

**Problema:** Registro en USUARIOS_ROLES no tiene campo `password`

**Solución:**
1. Generar hash bcrypt de la contraseña deseada
2. Actualizar registro en Wix con el hash en campo `password`

## Migración de Usuarios Existentes

Si ya tienes usuarios en el sistema viejo y quieres migrarlos:

1. **Exportar usuarios actuales** (si existen en código)
2. **Hashear todas las contraseñas** con bcrypt
3. **Importar CSV a Wix** con estructura de USUARIOS_ROLES
4. **Verificar** que todos los roles existen en ROL_PERMISOS
5. **Probar login** con cada usuario

## Recursos Útiles

- **Generar hash bcrypt**: https://bcrypt-generator.com/
- **Verificar hash bcrypt**: https://bcrypt.online/
- **Documentación bcrypt**: https://github.com/kelektiv/node.bcrypt.js
- **Wix Data API**: https://www.wix.com/velo/reference/wix-data

## Conclusión

Con este sistema, toda la gestión de usuarios, roles y permisos está centralizada en Wix:

✅ **Agregar usuarios** → Sin deploy
✅ **Cambiar contraseñas** → Sin deploy
✅ **Modificar permisos** → Sin deploy
✅ **Desactivar usuarios** → Sin deploy
✅ **Cambiar roles** → Sin deploy

Todo se hace desde Wix CMS o desde el panel de administración en `/admin/permissions`.
