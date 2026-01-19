# Sistema de Permisos - LGS Admin Panel

Sistema completo de control de acceso basado en roles (RBAC - Role-Based Access Control) para el panel administrativo de Let's Go Speak.

## 📋 Tabla de Contenidos

- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Roles Disponibles](#roles-disponibles)
- [Catálogo de Permisos](#catálogo-de-permisos)
- [Matriz de Roles y Permisos](#matriz-de-roles-y-permisos)
- [Uso en el Código](#uso-en-el-código)
- [Ejemplos de Implementación](#ejemplos-de-implementación)

---

## 🏗️ Arquitectura del Sistema

### Estructura de Archivos

```
src/
├── types/
│   └── permissions.ts          # Tipos, enums e interfaces
├── config/
│   ├── permissions.ts          # Catálogo de permisos
│   └── roles.ts               # Matriz de roles y permisos
├── lib/
│   └── permissions.ts         # Utilidades server-side
├── hooks/
│   └── usePermissions.ts      # Hooks para React
└── components/
    └── permissions/
        └── PermissionGate.tsx # Componentes de control de acceso
```

### Formato de Códigos de Permiso

Cada permiso sigue el formato jerárquico:

```
[MÓDULO].[SECCIÓN].[ACCIÓN]
```

**Ejemplos:**
- `PERSON.INFO.DESCARGAR_CONTRATO`
- `STUDENT.CONTRATO.EXTENDER_VIGENCIA`
- `ACADEMICO.AGENDA.CREAR_EVENTO`

---

## 👥 Roles Disponibles

| Rol | Código | Descripción | Total Permisos |
|-----|--------|-------------|----------------|
| **Super Admin** | `SUPER_ADMIN` | Acceso total al sistema | 61 |
| **Admin** | `ADMIN` | Administrador con permisos amplios (sin ELIMINAR) | 60 |
| **Advisor** | `ADVISOR` | Profesor/Advisor con permisos académicos (sin acceso a /person/) | 21 |
| **Comercial** | `COMERCIAL` | Área comercial - ventas y contratos | 15 |
| **Aprobador** | `APROBADOR` | Rol de aprobación de contratos | 9 |
| **Talero** | `TALERO` | Administrativo con permisos específicos | 23 |
| **Financiero** | `FINANCIERO` | Área financiera - pagos y estados de cuenta | 11 |
| **Servicio** | `SERVICIO` | Área de servicio al cliente | 13 |
| **Solo Lectura** | `READONLY` | Acceso solo de consulta y reportes | 17 |

---

## 📚 Catálogo de Permisos

### Módulo: PERSON (Endpoint `/person/`)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `PERSON.INFO.DESCARGAR_CONTRATO` | Descargar Contrato | Descarga el contrato del usuario |
| `PERSON.INFO.VER_DOCUMENTACION` | Ver Documentación | Visualiza documentación |
| `PERSON.INFO.ADICION_DOCUMENTACION` | Adición Documentación | Agrega nueva documentación |
| `PERSON.ADMIN.ACTIVAR_DESACTIVAR` | Activar/Desactivar | Toggle de activación del perfil |
| `PERSON.ADMIN.CAMBIO_CELULAR` | Cambio Celular Titular | Cambia el celular del titular |
| `PERSON.ADMIN.CAMBIAR_ESTADO` | Cambiar Estado Actual | Modifica el estado del usuario |
| `PERSON.ADMIN.APROBAR` | Aprobar | Aprueba proceso o solicitud |
| `PERSON.ADMIN.MODIFICAR` | Modificar | Modifica información del usuario |
| `PERSON.ADMIN.ELIMINAR` | Eliminar | Elimina el registro del usuario |
| `PERSON.ADMIN.AGREGAR_BENEFICIARIO` | Agregar Beneficiario | Añade beneficiario al contrato |
| `PERSON.ADMIN.WHATSAPP` | WhatsApp | Abre chat de WhatsApp |

### Módulo: STUDENT (Endpoint `/student/[id]`)

#### Globales
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `STUDENT.GLOBAL.ENVIAR_MENSAJE` | Enviar Mensaje | Envía mensaje al estudiante |
| `STUDENT.GLOBAL.GUARDAR_PLANTILLA` | Guardar Plantilla | Guarda información como plantilla |

#### Academia
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `STUDENT.ACADEMIA.TABLA_FILTROS` | Filtros (Asistencia) | Filtra tabla de asistencia |
| `STUDENT.ACADEMIA.TABLA_DESCARGAR` | Descargar (Asistencia) | Descarga tabla de asistencia |
| `STUDENT.ACADEMIA.EVALUACION` | Evaluación | Accede a evaluación de clase |
| `STUDENT.ACADEMIA.ANOTACION_ADVISOR` | Anotación Advisor | Anota observaciones del advisor |
| `STUDENT.ACADEMIA.COMENTARIOS_ESTUDIANTE` | Comentarios Estudiante | Visualiza/agrega comentarios |
| `STUDENT.ACADEMIA.ELIMINAR_EVENTO` | Eliminar Evento | Elimina evento de clase |
| `STUDENT.ACADEMIA.AGENDAR_CLASE` | Agendar Nueva Clase | Agenda nueva clase |
| `STUDENT.ACADEMIA.MARCAR_STEP` | Gestión de Steps (Marcar) | Marca step como completado en Gestión de Steps |
| `STUDENT.ACADEMIA.ASIGNAR_STEP` | Gestión de Steps (Asignar) | Asigna nuevo step en Gestión de Steps |

#### Contrato
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `STUDENT.CONTRATO.CONSULTA` | Consulta | Consulta detalles del contrato |
| `STUDENT.CONTRATO.ACTIVAR_HOLD` | Activar/Desactivar HOLD | Toggle de estado HOLD |
| `STUDENT.CONTRATO.EXTENDER_VIGENCIA` | Extender Vigencia | Extiende vigencia del contrato |

#### Financiera
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `STUDENT.FINANCIERA.GENERAR_ESTADO` | Generar Estado Cuenta | Genera estado de cuenta |
| `STUDENT.FINANCIERA.REGISTRAR_PAGO` | Registrar Pago | Registra nuevo pago |
| `STUDENT.FINANCIERA.ENVIO_RECORDATORIO` | Envío Recordatorio | Envía recordatorio de pago |

### Módulo: ACADEMICO (Menú Académico)

#### Agenda Sesiones
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `ACADEMICO.AGENDA.CALENDARIO_VER` | Ver Calendario | Vista de calendario |
| `ACADEMICO.AGENDA.LISTA_VER` | Ver Agenda | Vista de lista/agenda |
| `ACADEMICO.AGENDA.FILTRO` | Filtro | Filtra sesiones |
| `ACADEMICO.AGENDA.NUEVO_EVENTO` | Nuevo Evento | Crea nuevo evento |
| `ACADEMICO.AGENDA.EXPORTAR_CSV` | Exportar CSV | Exporta agenda a CSV |
| `ACADEMICO.AGENDA.EDITAR` | Editar | Edita evento existente |
| `ACADEMICO.AGENDA.CREAR_EVENTO` | Crear Evento | Crea evento (global) |
| `ACADEMICO.SESION.IR_A_SESION` | Ir a la Sesión | Accede a gestión de sesión (asistencia, evaluación, comentarios) |

#### Agenda Académica
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `ACADEMICO.ACADEMICA.VER` | Ver Agenda Académica | Vista de agenda académica |
| `ACADEMICO.ACADEMICA.AGENDAMIENTO` | Agendamiento | Gestiona agendamiento |
| `ACADEMICO.ACADEMICA.EXPORTAR_CSV` | Exportar CSV | Exporta a CSV |
| `ACADEMICO.ACADEMICA.ESTADISTICAS` | Estadísticas | Visualiza estadísticas |
| `ACADEMICO.ACADEMICA.EXPORTAR_STATS_CSV` | Exportar Stats CSV | Exporta estadísticas a CSV |

#### Advisor
| Código | Nombre | Descripción |
|--------|--------|-------------|
| `ACADEMICO.ADVISOR.LISTA_VER` | Ver Lista Advisors | Lista de advisors |
| `ACADEMICO.ADVISOR.VER_ENLACE` | Ver enlace | Visualiza enlace del advisor |
| `ACADEMICO.ADVISOR.AGREGAR` | Agregar Advisor | Añade nuevo advisor |
| `ACADEMICO.ADVISOR.ESTADISTICA` | Estadística Advisor | Estadísticas de advisors |

### Módulo: SERVICIO (Menú Servicio)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `SERVICIO.WELCOME.CARGAR_EVENTOS` | Cargar Eventos (Welcome) | Carga eventos de welcome |
| `SERVICIO.WELCOME.EXPORTAR_CSV` | Exportar CSV (Welcome) | Exporta welcome sessions |
| `SERVICIO.SESIONES.CARGAR_EVENTOS` | Cargar Eventos (Sesiones) | Carga eventos de sesiones |
| `SERVICIO.SESIONES.EXPORTAR_CSV` | Exportar CSV (Sesiones) | Exporta lista de sesiones |
| `SERVICIO.USUARIOS.ACTUALIZAR` | Actualizar | Actualiza usuarios sin perfil |
| `SERVICIO.USUARIOS.EXPORTAR_CSV` | Exportar CSV (Usuarios) | Exporta usuarios sin perfil |

### Módulo: COMERCIAL (Menú Comercial)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `COMERCIAL.CONTRATO.MODIFICAR` | Modificar Contrato | Modifica contrato |
| `COMERCIAL.CONTRATO.ENVIAR_PDF` | Enviar PDF | Envía contrato en PDF |
| `COMERCIAL.CONTRATO.DESCARGAR` | Descargar Contrato | Descarga contrato |
| `COMERCIAL.CONTRATO.APROBACION_AUTONOMA` | Aprobación Autónoma | Aprueba contrato autónomo |
| `COMERCIAL.PROSPECTOS.VER` | Ver Prospectos | Visualiza prospectos |

### Módulo: APROBACION (Menú Aprobación)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `APROBACION.GLOBAL.ACTUALIZAR` | Actualizar | Actualiza lista de contratos |
| `APROBACION.GLOBAL.EXPORTAR_CSV` | Exportar CSV | Exporta contratos pendientes |
| `APROBACION.CONTRATO.MODIFICAR` | Modificar Contrato | Modifica contrato pendiente |
| `APROBACION.CONTRATO.ENVIAR_PDF` | Enviar PDF | Envía contrato en PDF |
| `APROBACION.CONTRATO.DESCARGAR` | Descargar Contrato | Descarga contrato |
| `APROBACION.CONTRATO.APROBACION_AUTONOMA` | Aprobación Autónoma | Aprueba contrato autónomo |

---

## 📊 Matriz de Roles y Permisos

### Resumen por Módulo

| Módulo | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|--------|:-----------:|:-----:|:-------:|:---------:|:---------:|:------:|:----------:|:--------:|:--------:|
| **PERSON** | 11/11 | 10/11 | 0/11 | 7/11 | 3/11 | 11/11 | 3/11 | 3/11 | 2/11 |
| **STUDENT** | 17/17 | 17/17 | 9/17 | 3/17 | 2/17 | 6/17 | 5/17 | 5/17 | 4/17 |
| **ACADEMICO** | 16/16 | 16/16 | 10/16 | 0/16 | 0/16 | 4/16 | 0/16 | 3/16 | 6/16 |
| **SERVICIO** | 6/6 | 6/6 | 2/6 | 2/6 | 0/6 | 6/6 | 0/6 | 6/6 | 3/6 |
| **COMERCIAL** | 5/5 | 5/5 | 0/5 | 5/5 | 2/5 | 0/5 | 2/5 | 0/5 | 0/5 |
| **APROBACION** | 6/6 | 6/6 | 0/6 | 0/6 | 6/6 | 0/6 | 3/6 | 0/6 | 0/6 |
| **TOTAL** | **61** | **60** | **21** | **15** | **9** | **23** | **11** | **13** | **17** |

### Permisos Exclusivos por Rol

#### Solo SUPER_ADMIN
- `PERSON.ADMIN.ELIMINAR` - Eliminar usuario (acción destructiva crítica)

#### SUPER_ADMIN + ADMIN
- Acceso completo a todos los módulos

#### ADVISOR
- `STUDENT.ACADEMIA.*` - Gestión académica completa
- `ACADEMICO.AGENDA.*` - Control total de agenda
- ❌ **Sin acceso al módulo PERSON** - No puede acceder al endpoint `/person/[id]`

#### COMERCIAL
- `COMERCIAL.CONTRATO.*` - Gestión de contratos
- `COMERCIAL.PROSPECTOS.VER` - Gestión de prospectos

#### APROBADOR
- `APROBACION.CONTRATO.*` - Aprobación de contratos

#### FINANCIERO
- `STUDENT.FINANCIERA.*` - Gestión financiera

---

## 💻 Uso en el Código

### 1. Server-Side (API Routes / Server Components)

```typescript
import { checkPermission } from '@/lib/permissions';
import { StudentPermission } from '@/types/permissions';

export async function DELETE(req: Request) {
  // Verificar permiso
  const canDelete = await checkPermission(StudentPermission.ELIMINAR_EVENTO);

  if (!canDelete.allowed) {
    return NextResponse.json(
      { error: canDelete.reason },
      { status: 403 }
    );
  }

  // Proceder con la acción
  // ...
}
```

### 2. Client-Side (Componentes React)

#### Usando Hooks

```typescript
'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { StudentPermission } from '@/types/permissions';

export function StudentActions() {
  const { hasPermission } = usePermissions();

  const canDelete = hasPermission(StudentPermission.ELIMINAR_EVENTO);

  return (
    <>
      {canDelete && (
        <button onClick={handleDelete}>
          Eliminar Evento
        </button>
      )}
    </>
  );
}
```

#### Usando PermissionGate

```typescript
'use client';

import { PermissionGate } from '@/components/permissions/PermissionGate';
import { StudentPermission } from '@/types/permissions';

export function StudentActions() {
  return (
    <PermissionGate permission={StudentPermission.ELIMINAR_EVENTO}>
      <button onClick={handleDelete}>
        Eliminar Evento
      </button>
    </PermissionGate>
  );
}
```

### 3. Verificación de Múltiples Permisos

```typescript
// Todos los permisos requeridos
const { hasAllPermissions } = usePermissions();

if (hasAllPermissions([
  StudentPermission.ELIMINAR_EVENTO,
  StudentPermission.AGENDAR_CLASE
])) {
  // Realizar acción
}

// Alguno de los permisos requerido
const { hasAnyPermission } = usePermissions();

if (hasAnyPermission([
  PersonPermission.MODIFICAR,
  PersonPermission.APROBAR
])) {
  // Realizar acción
}
```

### 4. Verificación por Rol

```typescript
import { useIsAdmin, useIsSuperAdmin } from '@/hooks/usePermissions';

export function AdminPanel() {
  const isAdmin = useIsAdmin(); // Admin o Super Admin
  const isSuperAdmin = useIsSuperAdmin(); // Solo Super Admin

  return (
    <>
      {isAdmin && <AdminSection />}
      {isSuperAdmin && <DangerZone />}
    </>
  );
}
```

---

## 🎯 Ejemplos de Implementación

### Ejemplo 1: Proteger una Página Completa

```typescript
// app/admin/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUserRole } from '@/lib/permissions';
import { Role } from '@/types/permissions';

export default async function AdminPage() {
  const role = await getCurrentUserRole();

  if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
    redirect('/dashboard');
  }

  return <AdminDashboard />;
}
```

### Ejemplo 2: API Route Protegida

```typescript
// app/api/students/[id]/delete/route.ts
import { NextResponse } from 'next/server';
import { checkPermission } from '@/lib/permissions';
import { StudentPermission } from '@/types/permissions';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const check = await checkPermission(StudentPermission.ELIMINAR_EVENTO);

  if (!check.allowed) {
    return NextResponse.json(
      { error: 'No tienes permisos para eliminar eventos' },
      { status: 403 }
    );
  }

  // Eliminar evento
  await deleteEvent(params.id);

  return NextResponse.json({ success: true });
}
```

### Ejemplo 3: Componente con Múltiples Permisos

```typescript
'use client';

import { PermissionGate, AdminOnly } from '@/components/permissions/PermissionGate';
import { StudentPermission, PersonPermission } from '@/types/permissions';

export function StudentCard({ student }: { student: Student }) {
  return (
    <div className="card">
      <h2>{student.name}</h2>

      {/* Solo usuarios con permiso específico */}
      <PermissionGate permission={StudentPermission.EXTENDER_VIGENCIA}>
        <button>Extender Vigencia</button>
      </PermissionGate>

      {/* Solo Admins */}
      <AdminOnly>
        <button className="danger">Eliminar</button>
      </AdminOnly>

      {/* Requiere múltiples permisos */}
      <PermissionGate
        allPermissions={[
          StudentPermission.ACTIVAR_HOLD,
          StudentPermission.EXTENDER_VIGENCIA
        ]}
      >
        <button>Gestión Avanzada</button>
      </PermissionGate>
    </div>
  );
}
```

### Ejemplo 4: Menú Dinámico basado en Permisos

```typescript
'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { AcademicoPermission, ComercialPermission } from '@/types/permissions';

export function Navigation() {
  const { hasPermission } = usePermissions();

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      show: true,
    },
    {
      label: 'Agenda Académica',
      href: '/academic/agenda',
      show: hasPermission(AcademicoPermission.CALENDARIO_VER),
    },
    {
      label: 'Gestión Comercial',
      href: '/comercial',
      show: hasPermission(ComercialPermission.VER_PROSPECTOS),
    },
  ];

  return (
    <nav>
      {menuItems
        .filter(item => item.show)
        .map(item => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
    </nav>
  );
}
```

---

## 🔄 Actualizar el Sistema de Autenticación

Para integrar el sistema de permisos con NextAuth, actualiza el archivo de autenticación:

```typescript
// src/lib/auth.ts
import { Role } from '@/types/permissions';

export const authOptions: AuthOptions = {
  // ... configuración existente

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role || Role.READONLY; // Rol por defecto
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
```

---

## 📝 Notas Importantes

### Seguridad
- ✅ **Siempre valida permisos en server-side** para acciones críticas
- ✅ Las validaciones client-side son solo para UX (ocultar botones)
- ✅ Nunca confíes solo en validaciones del frontend

### Escalabilidad
- El sistema está diseñado para agregar nuevos permisos fácilmente
- Los roles se pueden personalizar modificando `src/config/roles.ts`
- Se pueden crear roles personalizados extendiendo el enum `Role`

### Mejores Prácticas
- Usa `PermissionGate` para UI condicional
- Usa `checkPermission` en API routes
- Documenta nuevos permisos en este archivo
- Mantén la matriz de roles actualizada

---

## 🎛️ Interfaz de Administración de Permisos

### Acceso a la Interfaz

La aplicación incluye una **interfaz visual estilo Excel** para gestionar permisos de forma interactiva:

**URL**: [`/admin/permissions`](src/app/admin/permissions/page.tsx)

**Acceso**: Solo SUPER_ADMIN y ADMIN

### Características de la Interfaz

✅ **Vista de matriz completa** - Todos los permisos y roles en formato tabla
✅ **Edición en tiempo real** - Marca/desmarca permisos con checkboxes
✅ **Filtrado por módulo** - Visualiza permisos de módulos específicos
✅ **Estadísticas por rol** - Contador de permisos asignados
✅ **Exportar a CSV** - Descarga la matriz completa
✅ **Guardar cambios** - Persiste configuración personalizada

### Cómo Usar

1. Accede a `/admin/permissions`
2. Selecciona un rol del dropdown
3. Marca/desmarca los checkboxes de permisos
4. (Opcional) Filtra por módulo para facilitar la edición
5. Haz clic en "Guardar Cambios" para persistir

### API Endpoints Disponibles

#### GET `/api/permissions`
Obtiene la matriz completa de permisos

**Response:**
```json
{
  "success": true,
  "data": {
    "roles": ["SUPER_ADMIN", "ADMIN", ...],
    "permissions": [...],
    "matrix": [...]
  }
}
```

#### POST `/api/permissions/update`
Actualiza los permisos de un rol específico

**Body:**
```json
{
  "role": "ADVISOR",
  "permissions": ["STUDENT.ACADEMIA.EVALUACION", ...]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permisos de ADVISOR actualizados correctamente",
  "data": {
    "role": "ADVISOR",
    "permissions": [...],
    "count": 22
  }
}
```

### Permisos Personalizados

El sistema soporta **configuración personalizada** de permisos:

- Los cambios se guardan en `/src/config/custom-roles.json`
- Los permisos personalizados tienen prioridad sobre la configuración por defecto
- Archivo `custom-roles.json` es opcional y no se incluye en el repositorio por defecto

**Ejemplo de `custom-roles.json`:**
```json
{
  "ADVISOR": [
    "STUDENT.ACADEMIA.EVALUACION",
    "STUDENT.ACADEMIA.ANOTACION_ADVISOR",
    "ACADEMICO.AGENDA.CREAR_EVENTO"
  ],
  "COMERCIAL": [
    "COMERCIAL.CONTRATO.MODIFICAR",
    "COMERCIAL.PROSPECTOS.VER"
  ]
}
```

### Funciones para Gestión Personalizada

```typescript
import {
  getPermissionsForRole,
  hasCustomPermissions,
  saveCustomPermissions,
  restoreDefaultPermissions,
  getCustomizedRoles
} from '@/lib/custom-permissions';

// Obtener permisos (personalizados o por defecto)
const perms = getPermissionsForRole(Role.ADVISOR);

// Verificar si un rol tiene permisos personalizados
const isCustom = hasCustomPermissions(Role.ADVISOR);

// Guardar permisos personalizados
saveCustomPermissions(Role.ADVISOR, [/* permisos */]);

// Restaurar permisos por defecto
restoreDefaultPermissions(Role.ADVISOR);

// Obtener lista de roles con personalizaciones
const customRoles = getCustomizedRoles();
```

---

## 🚀 Próximos Pasos

1. ✅ Integrar con NextAuth en `/src/lib/auth.ts`
2. ✅ Crear interfaz de administración de roles en `/admin/permissions`
3. ⏳ Implementar permisos en todos los endpoints API
4. ⏳ Agregar logging de acciones basadas en permisos
5. ⏳ Crear tests unitarios para verificación de permisos

---

## 📞 Soporte

Para dudas o modificaciones al sistema de permisos, consulta:
- [`/src/types/permissions.ts`](src/types/permissions.ts) - Definiciones de tipos
- [`/src/config/roles.ts`](src/config/roles.ts) - Configuración de roles
- [`/src/lib/permissions.ts`](src/lib/permissions.ts) - Utilidades

---

**Última actualización:** 2025-10-11
