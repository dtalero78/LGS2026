# Instrucciones para Importar USUARIOS_ROLES con Contraseñas

## ⚠️ IMPORTANTE

Este archivo contiene las instrucciones para **actualizar la tabla USUARIOS_ROLES en Wix** con el nuevo campo `password` que contiene los hashes bcrypt de las contraseñas.

## Cambios Realizados

### Nuevo Campo: `password`

Se agregó el campo `password` a la tabla USUARIOS_ROLES que contiene el hash bcrypt de la contraseña de cada usuario.

**Contraseña por defecto**: `Test123!`

**Hash bcrypt**: `$2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq`

### Usuario Modificado

El email del usuario con rol TALERO se cambió de `talero@lgs.com` a `d_talero@yahoo.com`.

## Pasos para Actualizar en Wix

### Opción 1: Agregar Campo Manualmente (Recomendado)

Si ya tienes la tabla USUARIOS_ROLES creada en Wix:

1. **Abrir Wix CMS** → Base de datos USUARIOS_ROLES

2. **Agregar nuevo campo**:
   - Nombre: `password`
   - Tipo: Text
   - Descripción: Hash bcrypt de la contraseña del usuario

3. **Actualizar cada registro** con el hash de contraseña:
   ```
   $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq
   ```

4. **Actualizar el email del TALERO**:
   - Buscar registro con rol = "TALERO"
   - Cambiar email de `talero@lgs.com` a `d_talero@yahoo.com`

5. **Guardar cambios**

### Opción 2: Reimportar CSV Completo

Si prefieres reimportar la tabla completa:

1. **Hacer backup de la tabla actual** (exportar a CSV desde Wix CMS)

2. **Borrar todos los registros** de USUARIOS_ROLES (o borrar la tabla completa)

3. **Importar el nuevo CSV**:
   - Archivo: `wix-database/USUARIOS_ROLES.csv`
   - Ubicación en Wix: CMS → Import from CSV

4. **Verificar estructura de campos**:
   - `_id` → Text (Primary Key)
   - `email` → Text (Unique)
   - `password` → Text ⭐ NUEVO
   - `rol` → Text
   - `nombre` → Text
   - `activo` → Boolean
   - `fechaCreacion` → Date
   - `fechaActualizacion` → Date

5. **Confirmar importación**

## Estructura del Archivo CSV

```csv
_id,email,password,rol,nombre,activo,fechaCreacion,fechaActualizacion
1,superadmin@lgs.com,$2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq,SUPER_ADMIN,Super Administrador,true,2025-01-15,2025-01-15
2,admin@lgs.com,$2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq,ADMIN,Administrador,true,2025-01-15,2025-01-15
...
```

## Verificar Funcionamiento

Después de importar o actualizar:

1. **Verificar en Wix Backend**:
   - Abrir http-functions.js
   - Asegurarse que get_userRole devuelve el campo `password`

2. **Hacer push del código actualizado** a producción:
   ```bash
   git push
   ```
   Esperar que Digital Ocean despliegue los cambios.

3. **Probar login** con cualquier usuario:
   - Email: `admin@lgs.com`
   - Password: `Test123!`

4. **Verificar logs** en el servidor:
   - Deberías ver: `✅ Usuario verificado en Wix`
   - Seguido de: `✅ Login exitoso con credenciales de Wix: ADMIN`

## Contraseñas de los Usuarios

Todos los usuarios tienen la misma contraseña por defecto:

| Email | Contraseña (texto) | Contraseña (hash bcrypt) |
|-------|-------------------|-------------------------|
| superadmin@lgs.com | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |
| admin@lgs.com | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |
| advisor@lgs.com | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |
| comercial@lgs.com | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |
| aprobador@lgs.com | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |
| **d_talero@yahoo.com** | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |
| financiero@lgs.com | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |
| servicio@lgs.com | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |
| readonly@lgs.com | Test123! | $2a$10$7X9vQKXjZ4zF5Y2hL3xKxO8kR1wZ0nC2mE6vT5bH9sD4gW8uA3vYq |

## Generar Hash para Nuevas Contraseñas

Si quieres crear usuarios con contraseñas diferentes:

1. **Ir a**: https://bcrypt-generator.com/
2. **Ingresar la contraseña** en texto plano
3. **Configurar rounds**: 10
4. **Generar hash**
5. **Copiar el hash** (debe empezar con `$2a$10$`)
6. **Pegar en el campo `password`** del registro en Wix

## Cambiar Contraseña de Usuario Existente

1. **Generar nuevo hash bcrypt** de la nueva contraseña
2. **Ir a Wix CMS** → Tabla USUARIOS_ROLES
3. **Buscar el usuario** por email
4. **Actualizar campo `password`** con el nuevo hash
5. **Actualizar `fechaActualizacion`** a la fecha actual
6. **Guardar**

El usuario podrá hacer login inmediatamente con la nueva contraseña (no requiere deploy).

## Desactivar Usuario

Para desactivar un usuario sin borrarlo:

1. **Ir a Wix CMS** → Tabla USUARIOS_ROLES
2. **Buscar el usuario** por email
3. **Cambiar campo `activo`** de `true` a `false`
4. **Actualizar `fechaActualizacion`**
5. **Guardar**

El usuario no podrá hacer login aunque ingrese la contraseña correcta.

## Troubleshooting

### Error: "Usuario en Wix no tiene contraseña configurada"

**Causa**: El registro en USUARIOS_ROLES no tiene el campo `password` o está vacío.

**Solución**: Agregar hash bcrypt en el campo `password` del usuario.

### Error: "Contraseña incorrecta"

**Causas posibles**:
1. El hash bcrypt es inválido o corrupto
2. La contraseña ingresada no coincide con el hash
3. El hash fue generado con un algoritmo diferente

**Solución**: Regenerar el hash bcrypt y actualizarlo en Wix.

### No puedo hacer login con d_talero@yahoo.com

**Verificar**:
1. El email en Wix es exactamente `d_talero@yahoo.com` (sin espacios)
2. El campo `activo` está en `true`
3. El campo `password` contiene el hash correcto
4. El rol es `TALERO` (sin errores de tipeo)

## Seguridad

### ¿Por qué bcrypt?

- **No reversible**: Imposible obtener la contraseña original del hash
- **Salt automático**: Cada hash es único incluso con la misma contraseña
- **Costoso computacionalmente**: Dificulta ataques de fuerza bruta
- **Estándar de la industria**: Usado por millones de aplicaciones

### ¿Es seguro almacenar el hash en Wix?

Sí, siempre y cuando:
- ✅ Nunca se almacena la contraseña en texto plano
- ✅ Solo se almacena el hash bcrypt
- ✅ El hash se genera con suficientes salt rounds (10 o más)
- ✅ El hash nunca se expone en logs o respuestas API públicas

En este sistema:
- Las contraseñas solo se verifican en el servidor (auth.ts)
- El hash se transmite de forma segura desde Wix
- La comparación se hace con `bcrypt.compare()` que es timing-safe
- Los logs no muestran contraseñas ni hashes completos

## Recursos

- **Generador de hash bcrypt**: https://bcrypt-generator.com/
- **Verificador de hash bcrypt**: https://bcrypt.online/
- **Documentación Wix Data**: https://www.wix.com/velo/reference/wix-data
- **Sistema completo**: Ver [SISTEMA_AUTENTICACION_WIX.md](../SISTEMA_AUTENTICACION_WIX.md)
