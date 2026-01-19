/**
 * PermissionButton - LGS Admin Panel
 * Botón que solo se muestra si el usuario tiene los permisos necesarios
 */

'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { Permission, Role } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';

// ============================================================================
// TIPOS
// ============================================================================

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Permiso requerido para mostrar el botón */
  permission?: Permission;
  /** Array de permisos - todos requeridos */
  allPermissions?: Permission[];
  /** Array de permisos - alguno requerido */
  anyPermissions?: Permission[];
  /** Rol requerido */
  role?: Role;
  /** Array de roles - alguno requerido */
  anyRoles?: Role[];
  /** Si true, muestra el botón deshabilitado en lugar de ocultarlo */
  showDisabled?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

// ============================================================================
// COMPONENTE
// ============================================================================

/**
 * PermissionButton - Botón que se renderiza según permisos del usuario
 *
 * @example
 * <PermissionButton
 *   permission={StudentPermission.ELIMINAR_EVENTO}
 *   onClick={handleDelete}
 *   className="btn-danger"
 * >
 *   Eliminar Evento
 * </PermissionButton>
 */
export function PermissionButton({
  children,
  permission,
  allPermissions,
  anyPermissions,
  role,
  anyRoles,
  showDisabled = false,
  className = '',
  disabled,
  ...props
}: PermissionButtonProps) {
  const {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    isRole,
    isAnyRole,
  } = usePermissions();

  // Verificar permisos
  let hasRequiredPermission = true;

  if (permission && !hasPermission(permission)) {
    hasRequiredPermission = false;
  }

  if (allPermissions && !hasAllPermissions(allPermissions)) {
    hasRequiredPermission = false;
  }

  if (anyPermissions && !hasAnyPermission(anyPermissions)) {
    hasRequiredPermission = false;
  }

  if (role && !isRole(role)) {
    hasRequiredPermission = false;
  }

  if (anyRoles && !isAnyRole(anyRoles)) {
    hasRequiredPermission = false;
  }

  // Si no tiene permisos y no se debe mostrar deshabilitado, no renderizar
  if (!hasRequiredPermission && !showDisabled) {
    return null;
  }

  // Si no tiene permisos pero se debe mostrar deshabilitado
  const isDisabled = !hasRequiredPermission || disabled;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={className}
    >
      {children}
    </button>
  );
}
