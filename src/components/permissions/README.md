# Sistema de Permisos - Guía de Uso

Este directorio contiene componentes y hooks para implementar control de permisos basado en roles.

## Componentes Disponibles

### 1. PermissionGuard

Protege secciones completas de la UI. Si el usuario no tiene permisos, muestra un mensaje o contenido alternativo.

**Ejemplo 1: Proteger una sección completa**
```tsx
import { PermissionGuard } from '@/components/permissions';
import { Permission } from '@/types/permissions';

<PermissionGuard permission={Permission.STUDENT_ELIMINAR_EVENTO}>
  <div>
    <h2>Eliminar Eventos</h2>
    <button>Eliminar Evento</button>
  </div>
</PermissionGuard>
```

**Ejemplo 2: Requerir múltiples permisos (TODOS)**
```tsx
<PermissionGuard allPermissions={[
  Permission.STUDENT_VER_INFORMACION,
  Permission.STUDENT_MODIFICAR_INFORMACION
]}>
  <StudentEditForm />
</PermissionGuard>
```

**Ejemplo 3: Requerir al menos uno de varios permisos**
```tsx
<PermissionGuard anyPermissions={[
  Permission.APROBACION_APROBAR_BENEFICIARIO,
  Permission.APROBACION_RECHAZAR_BENEFICIARIO
]}>
  <ApprovalActions />
</PermissionGuard>
```

**Ejemplo 4: Con contenido alternativo personalizado**
```tsx
<PermissionGuard 
  permission={Permission.COMERCIAL_VER_CONTRATOS}
  fallback={<div>Contacta al administrador para acceso</div>}
>
  <ContractsList />
</PermissionGuard>
```

**Ejemplo 5: Sin mensaje (solo ocultar)**
```tsx
<PermissionGuard 
  permission={Permission.STUDENT_ACADEMIA_EVALUACION}
  showDefaultMessage={false}
>
  <EvaluationSection />
</PermissionGuard>
```

### 2. ProtectedAction

Protege botones y acciones individuales. Puede ocultarlos o deshabilitarlos.

**Ejemplo 1: Botón protegido (deshabilitado si no tiene permisos)**
```tsx
import { ProtectedAction } from '@/components/permissions';
import { Permission } from '@/types/permissions';

<ProtectedAction 
  permission={Permission.STUDENT_ELIMINAR_EVENTO}
  onClick={() => deleteEvent(id)}
  className="btn-danger"
>
  Eliminar Evento
</ProtectedAction>
```

**Ejemplo 2: Botón oculto si no tiene permisos**
```tsx
<ProtectedAction 
  permission={Permission.COMERCIAL_MODIFICAR_CONTRATO}
  hideWhenDenied={true}
  onClick={() => editContract(id)}
>
  Editar Contrato
</ProtectedAction>
```

**Ejemplo 3: Con tooltip personalizado**
```tsx
<ProtectedAction 
  permission={Permission.APROBACION_APROBAR_BENEFICIARIO}
  deniedTooltip="Solo aprobadores pueden realizar esta acción"
  onClick={() => approve(id)}
>
  Aprobar
</ProtectedAction>
```

## Hook: usePermissions

Para lógica personalizada de permisos en tus componentes.

**Ejemplo de uso:**
```tsx
'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/types/permissions';

export function MyComponent() {
  const { 
    hasPermission, 
    hasAllPermissions,
    hasAnyPermission,
    userRole,
    userPermissions 
  } = usePermissions();

  // Verificar permiso individual
  if (hasPermission(Permission.STUDENT_VER_INFORMACION)) {
    // ...
  }

  // Verificar múltiples permisos (TODOS)
  if (hasAllPermissions([
    Permission.STUDENT_VER_INFORMACION,
    Permission.STUDENT_MODIFICAR_INFORMACION
  ])) {
    // ...
  }

  // Verificar múltiples permisos (AL MENOS UNO)
  if (hasAnyPermission([
    Permission.APROBACION_APROBAR_BENEFICIARIO,
    Permission.APROBACION_RECHAZAR_BENEFICIARIO
  ])) {
    // ...
  }

  // Ver rol del usuario
  console.log('Rol:', userRole);

  // Ver todos los permisos
  console.log('Permisos:', userPermissions);

  return <div>...</div>;
}
```

## Permisos Disponibles

Los permisos están definidos en `/src/types/permissions.ts`. Ejemplos:

- `Permission.STUDENT_VER_INFORMACION`
- `Permission.STUDENT_MODIFICAR_INFORMACION`
- `Permission.STUDENT_ELIMINAR_EVENTO`
- `Permission.STUDENT_ACADEMIA_EVALUACION`
- `Permission.COMERCIAL_VER_CONTRATOS`
- `Permission.COMERCIAL_MODIFICAR_CONTRATO`
- `Permission.APROBACION_APROBAR_BENEFICIARIO`
- Y muchos más...

Consulta el archivo completo para ver todos los permisos disponibles.

## Mejores Prácticas

1. **Usa PermissionGuard para secciones completas:** Protege páginas o secciones grandes de UI
2. **Usa ProtectedAction para botones:** Protege acciones individuales como botones de editar/eliminar
3. **Usa usePermissions para lógica compleja:** Cuando necesites condicionales complejos o múltiples verificaciones
4. **Siempre especifica el permiso correcto:** Revisa la lista de permisos disponibles
5. **Considera la experiencia del usuario:** Decide si es mejor ocultar o deshabilitar elementos

## Configuración de Permisos

Los permisos se configuran en `/admin/permissions` (solo accesible por SUPER_ADMIN):

1. Accede a `/admin/permissions`
2. Selecciona un rol para editar
3. Marca/desmarca los permisos deseados
4. Guarda los cambios

Los cambios se aplican inmediatamente sin necesidad de redeployment.
