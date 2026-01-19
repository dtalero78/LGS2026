/**
 * Componente para proteger contenido basado en permisos
 */

'use client';

import { ReactNode } from 'react';
import { Permission } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  /** Permiso único requerido */
  permission?: Permission;
  /** Array de permisos - el usuario debe tener TODOS */
  allPermissions?: Permission[];
  /** Array de permisos - el usuario debe tener AL MENOS UNO */
  anyPermissions?: Permission[];
  /** Contenido a mostrar si tiene permisos */
  children: ReactNode;
  /** Contenido alternativo si NO tiene permisos (opcional) */
  fallback?: ReactNode;
  /** Mostrar mensaje por defecto si NO tiene permisos */
  showDefaultMessage?: boolean;
}

export function PermissionGuard({
  permission,
  allPermissions,
  anyPermissions,
  children,
  fallback,
  showDefaultMessage = false,
}: PermissionGuardProps) {
  const { hasPermission, hasAllPermissions, hasAnyPermission, isLoading, isRole } = usePermissions();

  // SUPER_ADMIN y ADMIN tienen acceso total automáticamente
  const hasFullAccess = isRole('SUPER_ADMIN') || isRole('ADMIN');

  if (hasFullAccess) {
    return <>{children}</>;
  }

  // Mientras carga, no mostrar nada
  if (isLoading) {
    return null;
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
    // Si no se especificó ningún permiso, denegar por defecto
    hasAccess = false;
  }

  // Si tiene acceso, mostrar el contenido
  if (hasAccess) {
    return <>{children}</>;
  }

  // Si NO tiene acceso, mostrar fallback o mensaje por defecto
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showDefaultMessage) {
    return (
      <div className="p-6 text-center">
        <p className="text-base text-gray-900">
          No tienes permisos para usar esta sección
        </p>
      </div>
    );
  }

  // Si showDefaultMessage es false, no mostrar nada
  return null;
}
