/**
 * Componente para proteger botones y acciones individuales
 */

'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { Permission } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Permiso requerido para la acción */
  permission?: Permission;
  /** Array de permisos - el usuario debe tener TODOS */
  allPermissions?: Permission[];
  /** Array de permisos - el usuario debe tener AL MENOS UNO */
  anyPermissions?: Permission[];
  /** Contenido del botón/acción */
  children: ReactNode;
  /** Si true, oculta el botón si no tiene permisos. Si false, lo deshabilita */
  hideWhenDenied?: boolean;
  /** Tooltip a mostrar cuando está deshabilitado por falta de permisos */
  deniedTooltip?: string;
}

export function ProtectedAction({
  permission,
  allPermissions,
  anyPermissions,
  children,
  hideWhenDenied = false,
  deniedTooltip = 'No tienes permisos para esta acción',
  disabled,
  className = '',
  ...buttonProps
}: ProtectedActionProps) {
  const { hasPermission, hasAllPermissions, hasAnyPermission, isLoading } = usePermissions();

  // Mientras carga, deshabilitar
  if (isLoading) {
    return (
      <button
        {...buttonProps}
        disabled={true}
        className={`${className} opacity-50 cursor-not-allowed`}
      >
        {children}
      </button>
    );
  }

  // Determinar si tiene acceso
  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAllPermissions(allPermissions);
  } else if (anyPermissions && anyPermissions.length > 0) {
    hasAccess = hasAnyPermission(anyPermissions);
  } else {
    // Si no se especificó ningún permiso, permitir por defecto
    hasAccess = true;
  }

  // Si tiene acceso, renderizar botón normal
  if (hasAccess) {
    return (
      <button
        {...buttonProps}
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
    );
  }

  // Si NO tiene acceso y debe ocultarse, no renderizar nada
  if (hideWhenDenied) {
    return null;
  }

  // Si NO tiene acceso, renderizar botón deshabilitado con tooltip
  return (
    <button
      {...buttonProps}
      disabled={true}
      title={deniedTooltip}
      className={`${className} opacity-50 cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
