# Base de Datos de Permisos en Wix

Este documento explica cómo configurar y usar la base de datos de permisos en Wix para el sistema LGS Admin Panel.

## 📊 Estructura de Tablas

### 1. Tabla: `USUARIOS_ROLES`

**Propósito**: Asignar un rol a cada usuario del sistema.

**Campos**:
| Campo | Tipo | Descripción | Requerido | Único |
|-------|------|-------------|-----------|-------|
| `_id` | Text | ID único del registro | Sí | Sí |
| `email` | Text | Email del usuario (usado para login) | Sí | Sí |
| `rol` | Text | Rol asignado (SUPER_ADMIN, ADMIN, ADVISOR, etc.) | Sí | No |
| `nombre` | Text | Nombre completo del usuario | Sí | No |
| `activo` | Boolean | Si el usuario está activo o deshabilitado | Sí | No |
| `fechaCreacion` | Date | Fecha de creación del registro | No | No |
| `fechaActualizacion` | Date | Fecha de última actualización | No | No |

**Roles válidos**:
- `SUPER_ADMIN` - Acceso completo
- `ADMIN` - Administrador general
- `ADVISOR` - Asesor académico
- `COMERCIAL` - Área comercial
- `APROBADOR` - Aprobación de contratos
- `TALERO` - Gestión de tareas
- `FINANCIERO` - Área financiera
- `SERVICIO` - Servicio al cliente
- `READONLY` - Solo lectura

**Archivo CSV**: `USUARIOS_ROLES.csv`

---

### 2. Tabla: `PERMISOS_PERSONALIZADOS` (Opcional)

**Propósito**: Sobrescribir permisos específicos de un usuario que difieren de su rol por defecto.

**Campos**:
| Campo | Tipo | Descripción | Requerido | Único |
|-------|------|-------------|-----------|-------|
| `_id` | Text | ID único del registro | Sí | Sí |
| `email` | Text | Email del usuario | Sí | Sí |
| `permisos` | Text | Array JSON con lista de permisos personalizados | Sí | No |
| `fechaActualizacion` | Date | Fecha de última actualización | No | No |
| `notas` | Text | Notas sobre por qué tiene permisos personalizados | No | No |

**Formato del campo `permisos`**:
```json
["PERSON.INFO.VER_DOCUMENTACION", "STUDENT.GLOBAL.ENVIAR_MENSAJE", "ACADEMICO.AGENDA.CALENDARIO_VER"]
```

**Archivo CSV**: `PERMISOS_PERSONALIZADOS.csv`

---

## 🚀 Instrucciones de Instalación en Wix

### Paso 1: Crear las Colecciones en Wix

1. Ingresa a tu panel de Wix
2. Ve a **CMS (Content Manager)** → **Collections**
3. Crea una nueva colección llamada **`USUARIOS_ROLES`**
4. Configura los campos según la tabla de arriba
5. Habilita **Permissions**: "Anyone can read" (para que la API pueda consultarla)

### Paso 2: Importar Datos

1. En la colección `USUARIOS_ROLES`, haz clic en **"Import"**
2. Sube el archivo `USUARIOS_ROLES.csv`
3. Mapea los campos correctamente
4. Importa los datos

### Paso 3: (Opcional) Crear Colección de Permisos Personalizados

1. Crea una nueva colección llamada **`PERMISOS_PERSONALIZADOS`**
2. Configura los campos según la tabla de arriba
3. Importa el archivo `PERMISOS_PERSONALIZADOS.csv`

---

## 🔌 Integración con el Admin Panel

### Endpoints API Necesarios

Necesitarás crear los siguientes endpoints en Wix:

#### 1. `GET /api/wix-proxy/user-role`

**Propósito**: Obtener el rol de un usuario por email

**Request**:
```javascript
GET /api/wix-proxy/user-role?email=advisor@lgs.com
```

**Response**:
```json
{
  "email": "advisor@lgs.com",
  "rol": "ADVISOR",
  "nombre": "Advisor de Prueba",
  "activo": true
}
```

**Código Wix Backend** (`backend/http-functions.js`):
```javascript
import { ok, notFound, serverError } from 'wix-http-functions';
import wixData from 'wix-data';

export async function get_userRole(request) {
  const email = request.query.email;

  if (!email) {
    return serverError({ body: { error: 'Email is required' } });
  }

  try {
    const results = await wixData.query('USUARIOS_ROLES')
      .eq('email', email)
      .find();

    if (results.items.length === 0) {
      return notFound({ body: { error: 'Usuario no encontrado' } });
    }

    const user = results.items[0];
    return ok({
      body: {
        email: user.email,
        rol: user.rol,
        nombre: user.nombre,
        activo: user.activo
      }
    });
  } catch (error) {
    console.error('Error fetching user role:', error);
    return serverError({ body: { error: 'Error al obtener rol del usuario' } });
  }
}
```

#### 2. `GET /api/wix-proxy/user-permissions` (Opcional)

**Propósito**: Obtener permisos personalizados de un usuario

**Request**:
```javascript
GET /api/wix-proxy/user-permissions?email=advisor@lgs.com
```

**Response**:
```json
{
  "email": "advisor@lgs.com",
  "permisos": [
    "STUDENT.GLOBAL.ENVIAR_MENSAJE"
  ]
}
```

---

## 📝 Uso en el Admin Panel

### Actualizar `src/lib/auth.ts`

Reemplaza la lógica de usuarios hardcodeados con una llamada a Wix:

```typescript
async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  // Llamar a Wix para obtener el rol del usuario
  const response = await fetch(`${process.env.NEXT_PUBLIC_WIX_API_BASE_URL}/user-role?email=${credentials.email}`);

  if (!response.ok) {
    return null;
  }

  const userData = await response.json();

  // Validar contraseña (debe estar en tu sistema de autenticación de Wix)
  // Por ahora usamos la lógica actual de validación

  if (userData && userData.activo) {
    return {
      id: userData.email,
      email: userData.email,
      name: userData.nombre,
      role: userData.rol,
    };
  }

  return null;
}
```

### Actualizar `src/lib/custom-permissions.ts`

Agregar función para cargar permisos desde Wix:

```typescript
export async function loadCustomRolesFromWix(email: string): Promise<Permission[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_WIX_API_BASE_URL}/user-permissions?email=${email}`
    );

    if (response.ok) {
      const data = await response.json();
      return data.permisos || [];
    }
  } catch (error) {
    console.error('Error loading permissions from Wix:', error);
  }

  return [];
}
```

---

## 🔐 Ventajas de Usar Wix

1. **Centralizado**: Un solo lugar para gestionar usuarios y roles
2. **Sin código extra**: No necesitas commits para cambiar roles
3. **Auditable**: Wix mantiene historial de cambios
4. **Escalable**: Puedes agregar miles de usuarios sin modificar código
5. **Interfaz gráfica**: Los admins pueden gestionar roles desde Wix CMS

---

## 📋 Gestión de Usuarios

### Agregar un Nuevo Usuario

1. Ve a Wix CMS → `USUARIOS_ROLES`
2. Haz clic en **"Add Item"**
3. Completa los campos:
   - **email**: Email del usuario
   - **rol**: Selecciona el rol apropiado
   - **nombre**: Nombre completo
   - **activo**: true
   - **fechaCreacion**: Fecha actual
4. Guarda el registro

### Cambiar Rol de un Usuario

1. Ve a Wix CMS → `USUARIOS_ROLES`
2. Busca el usuario por email
3. Edita el campo **rol**
4. Actualiza **fechaActualizacion**
5. Guarda los cambios

### Desactivar un Usuario

1. Ve a Wix CMS → `USUARIOS_ROLES`
2. Busca el usuario por email
3. Cambia **activo** a `false`
4. Guarda los cambios

---

## 🎯 Siguientes Pasos

1. ✅ Crear las colecciones en Wix
2. ✅ Importar los datos CSV
3. ✅ Crear los endpoints en Wix backend
4. ⏳ Actualizar `auth.ts` para consultar Wix
5. ⏳ Probar con diferentes usuarios
6. ⏳ Documentar el proceso para el equipo

---

## 🐛 Troubleshooting

### Usuario no puede iniciar sesión
- Verifica que el email exista en `USUARIOS_ROLES`
- Verifica que el campo `activo` sea `true`
- Revisa los logs del backend de Wix

### Permisos no se aplican correctamente
- Verifica que el rol sea válido (mayúsculas)
- Limpia la caché del navegador (cookies y localStorage)
- Haz logout y login nuevamente

### Error al consultar la API
- Verifica que las colecciones tengan permisos de lectura
- Verifica que la URL del endpoint sea correcta
- Revisa los logs en Wix backend

---

## 📚 Referencias

- [Matriz de Permisos](../MATRIZ_PERMISOS.csv)
- [Documentación de Permisos](../PERMISOS.md)
- [Usuarios de Prueba](../USUARIOS_PRUEBA.md)
- [Wix Data API](https://www.wix.com/velo/reference/wix-data)
