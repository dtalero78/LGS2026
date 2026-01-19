# Sistema de Permisos - Quick Start

Este directorio contiene la configuración del sistema de permisos RBAC (Role-Based Access Control) de LGS Admin Panel.

## 📁 Archivos en este directorio

### `permissions.ts`
Catálogo completo de **61 permisos** organizados por módulo:
- PERSON (11 permisos)
- STUDENT (17 permisos)
- ACADEMICO (16 permisos)
- SERVICIO (6 permisos)
- COMERCIAL (5 permisos)
- APROBACION (6 permisos)

### `roles.ts`
Matriz de **9 roles** con sus permisos asignados:
- SUPER_ADMIN (61 permisos)
- ADMIN (60 permisos)
- ADVISOR (22 permisos)
- TALERO (23 permisos)
- SERVICIO (13 permisos)
- COMERCIAL (15 permisos)
- FINANCIERO (11 permisos)
- APROBADOR (9 permisos)
- READONLY (17 permisos)

## 🚀 Uso Rápido

### Server-Side (API Routes)

```typescript
import { checkPermission } from '@/lib/permissions';
import { StudentPermission } from '@/types/permissions';

export async function DELETE(req: Request) {
  const check = await checkPermission(StudentPermission.ELIMINAR_EVENTO);

  if (!check.allowed) {
    return NextResponse.json(
      { error: check.reason },
      { status: 403 }
    );
  }

  // Proceder con la acción
}
```

### Client-Side (Componentes React)

```typescript
import { usePermissions } from '@/hooks/usePermissions';
import { StudentPermission } from '@/types/permissions';

function MyComponent() {
  const { hasPermission } = usePermissions();

  return (
    <>
      {hasPermission(StudentPermission.ELIMINAR_EVENTO) && (
        <button onClick={handleDelete}>Eliminar</button>
      )}
    </>
  );
}
```

### Client-Side (PermissionGate)

```typescript
import { PermissionGate } from '@/components/permissions';
import { StudentPermission } from '@/types/permissions';

function MyComponent() {
  return (
    <PermissionGate permission={StudentPermission.ELIMINAR_EVENTO}>
      <button onClick={handleDelete}>Eliminar</button>
    </PermissionGate>
  );
}
```

## 📚 Documentación Completa

Ver [/PERMISOS.md](../../PERMISOS.md) para documentación completa del sistema.

## 🔧 Modificar Roles

Para cambiar los permisos de un rol, edita `roles.ts`:

```typescript
// Ejemplo: Agregar permiso al rol ADVISOR
const ADVISOR_PERMISSIONS: Permission[] = [
  // ... permisos existentes
  StudentPermission.NUEVO_PERMISO, // ← Agregar aquí
];
```

## ➕ Agregar Nuevos Permisos

1. Agrega el enum en `/src/types/permissions.ts`
2. Agrega la definición en `permissions.ts` (este archivo)
3. Asigna el permiso a roles en `roles.ts`

## 🔍 Buscar Permisos

```bash
# Ver todos los permisos de un módulo
grep "STUDENT\." src/config/permissions.ts

# Ver permisos de un rol
grep "ADVISOR_PERMISSIONS" src/config/roles.ts -A 30
```

## ⚠️ Importante

- **Siempre valida permisos en server-side** para acciones críticas
- Las validaciones client-side son solo para UX (ocultar botones)
- El único rol con permiso `ELIMINAR` es `SUPER_ADMIN`

---

**Ver también:**
- [Tipos de permisos](../types/permissions.ts)
- [Utilidades](../lib/permissions.ts)
- [Hooks](../hooks/usePermissions.ts)
- [Componentes](../components/permissions/)
