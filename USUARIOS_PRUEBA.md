# Usuarios de Prueba - LGS Admin Panel

Este documento contiene las credenciales de los usuarios de prueba para cada rol del sistema.

## ⚠️ IMPORTANTE: Sistema 100% en Wix

Todos los usuarios, contraseñas y permisos están almacenados en **Wix CMS**. Los usuarios se gestionan directamente en Wix sin necesidad de modificar código ni hacer deploy.

Ver documentación completa: [SISTEMA_AUTENTICACION_WIX.md](./SISTEMA_AUTENTICACION_WIX.md)

## Credenciales de Prueba

**IMPORTANTE**: Todos los usuarios usan la misma contraseña: `Test123!`

Las contraseñas están hasheadas con bcrypt en Wix y se verifican de forma segura durante el login.

| Rol | Email | Contraseña | Descripción |
|-----|-------|------------|-------------|
| **SUPER_ADMIN** | superadmin@lgs.com | Test123! | Acceso completo al sistema incluyendo gestión de permisos |
| **ADMIN** | admin@lgs.com | Test123! | Acceso administrativo general |
| **ADVISOR** | advisor@lgs.com | Test123! | Asesor académico |
| **COMERCIAL** | comercial@lgs.com | Test123! | Gestión comercial y contratos |
| **APROBADOR** | aprobador@lgs.com | Test123! | Aprobación de beneficiarios |
| **TALERO** | d_talero@yahoo.com | Test123! | Gestión de tareas específicas |
| **FINANCIERO** | financiero@lgs.com | Test123! | Gestión financiera |
| **SERVICIO** | servicio@lgs.com | Test123! | Servicio al cliente |
| **READONLY** | readonly@lgs.com | Test123! | Solo lectura (sin permisos de modificación) |

## Cómo Probar

1. **Hacer logout** del usuario actual
2. **Ir a la página de login**: `/login`
3. **Ingresar las credenciales** de uno de los usuarios de prueba
4. **Navegar por el sistema** para ver qué secciones y acciones están habilitadas/deshabilitadas según el rol

## Configurar Permisos (Sin Deploy!)

Para modificar los permisos de cada rol **sin necesidad de hacer deploy**:

1. **Login como SUPER_ADMIN** (superadmin@lgs.com / Test123!)
2. **Ir a**: `/admin/permissions`
3. **Seleccionar el rol** haciendo clic en la tarjeta del rol
4. **Marcar/desmarcar permisos** según necesites
5. **Guardar cambios** con el botón "Guardar Cambios"

Los cambios se guardan en Wix y se aplican inmediatamente (cache de 5 minutos). Haz logout y login para ver los cambios reflejados en tu sesión.

## Agregar o Modificar Usuarios (Sin Deploy!)

Para agregar usuarios o cambiar contraseñas **sin modificar código**:

1. **En Wix CMS**, ir a tabla `USUARIOS_ROLES`
2. **Para agregar usuario**: Crear nuevo registro con:
   - `email`: Email del usuario
   - `password`: Hash bcrypt de la contraseña (usar https://bcrypt-generator.com/)
   - `rol`: Rol del usuario (ADMIN, ADVISOR, etc.)
   - `nombre`: Nombre completo
   - `activo`: true
3. **Para cambiar contraseña**: Actualizar campo `password` con nuevo hash bcrypt
4. **Para desactivar usuario**: Cambiar campo `activo` a false

Ver guía completa: [SISTEMA_AUTENTICACION_WIX.md](./SISTEMA_AUTENTICACION_WIX.md)

## Permisos por Rol (Por Defecto)

Cada rol tiene permisos específicos definidos en `/src/config/roles.ts`:

- **SUPER_ADMIN**: Todos los permisos
- **ADMIN**: Permisos administrativos amplios
- **ADVISOR**: Permisos académicos y de evaluación
- **COMERCIAL**: Permisos de contratos y gestión comercial
- **APROBADOR**: Permisos de aprobación de beneficiarios
- **TALERO**: Permisos específicos de tareas
- **FINANCIERO**: Permisos financieros
- **SERVICIO**: Permisos de servicio al cliente
- **READONLY**: Solo visualización, sin modificaciones

## Probar el Sistema de Permisos

### Ejemplo 1: Probar READONLY
1. Login como `readonly@lgs.com`
2. Verás que muchas acciones están deshabilitadas o muestran "No tienes permisos"
3. Solo podrás ver información, no modificarla

### Ejemplo 2: Probar ADVISOR
1. Login como `advisor@lgs.com`
2. Deberías tener acceso a funciones académicas
3. No deberías tener acceso a funciones comerciales o financieras

### Ejemplo 3: Probar COMERCIAL
1. Login como `comercial@lgs.com`
2. Deberías tener acceso a gestión de contratos
3. No deberías tener acceso a evaluaciones académicas

## Notas Importantes

- **Seguridad**: Estos son usuarios de PRUEBA. En producción deberías usar credenciales reales y seguras.
- **Sesiones**: Las sesiones usan JWT. Después de cambiar permisos, necesitas hacer logout/login para ver los cambios.
- **Personalización**: Puedes personalizar los permisos de cada rol en `/admin/permissions` sin necesidad de modificar código.

## Troubleshooting

### No puedo acceder a ninguna sección
- Verifica que el rol tiene permisos asignados en `/admin/permissions`
- Haz logout y login nuevamente después de cambiar permisos

### Los cambios no se aplican
- Asegúrate de hacer clic en "Guardar Cambios" en `/admin/permissions`
- Haz logout completo y vuelve a hacer login
- Verifica que el archivo `/src/config/custom-roles.json` se haya creado

### Error 403 Forbidden
- El usuario no tiene el permiso necesario para esa acción
- Login como SUPER_ADMIN y asigna el permiso necesario en `/admin/permissions`
