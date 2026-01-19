/**
 * Componente PermissionGate - LGS Admin Panel
 * Componente para controlar el renderizado basado en permisos
 */

'use client';

import { ReactNode } from 'react';
import { Permission, Role } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';

// ============================================================================
// TIPOS
// ============================================================================

interface PermissionGateProps {
  children: ReactNode;
  /** Permiso requerido para mostrar el contenido */
  permission?: Permission;
  /** Array de permisos - todos requeridos */
  allPermissions?: Permission[];
  /** Array de permisos - alguno requerido */
  anyPermissions?: Permission[];
  /** Rol requerido */
  role?: Role;
  /** Array de roles - alguno requerido */
  anyRoles?: Role[];
  /** Componente a mostrar si no tiene permisos */
  fallback?: ReactNode;
  /** Si true, muestra loading mientras se verifica */
  showLoading?: boolean;
  /** Componente de loading personalizado */
  loadingComponent?: ReactNode;
}

// ============================================================================
// COMPONENTE
// ============================================================================

/**
 * PermissionGate - Renderiza children solo si el usuario tiene los permisos necesarios
 *
 * @example
 * // Verificar un solo permiso
 * <PermissionGate permission={StudentPermission.ELIMINAR_EVENTO}>
 *   <button>Eliminar Evento</button>
 * </PermissionGate>
 *
 * @example
 * // Verificar múltiples permisos (todos requeridos)
 * <PermissionGate allPermissions={[Permission.A, Permission.B]}>
 *   <button>Acción especial</button>
 * </PermissionGate>
 *
 * @example
 * // Verificar rol
 * <PermissionGate role={Role.ADMIN}>
 *   <AdminPanel />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  permission,
  allPermissions,
  anyPermissions,
  role,
  anyRoles,
  fallback = null,
  showLoading = false,
  loadingComponent = <div>Loading...</div>,
}: PermissionGateProps) {
  const {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    isRole,
    isAnyRole,
    isLoading,
    isAuthenticated,
  } = usePermissions();

  // Mostrar loading si está configurado
  if (isLoading && showLoading) {
    return <>{loadingComponent}</>;
  }

  // Si no está autenticado, mostrar fallback
  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  // Verificar permiso único
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Verificar todos los permisos
  if (allPermissions && !hasAllPermissions(allPermissions)) {
    return <>{fallback}</>;
  }

  // Verificar alguno de los permisos
  if (anyPermissions && !hasAnyPermission(anyPermissions)) {
    return <>{fallback}</>;
  }

  // Verificar rol único
  if (role && !isRole(role)) {
    return <>{fallback}</>;
  }

  // Verificar alguno de los roles
  if (anyRoles && !isAnyRole(anyRoles)) {
    return <>{fallback}</>;
  }

  // Si pasa todas las verificaciones, renderizar children
  return <>{children}</>;
}

// ============================================================================
// VARIANTES ESPECIALIZADAS
// ============================================================================

/**
 * AdminOnly - Solo visible para ADMIN y SUPER_ADMIN
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGate anyRoles={[Role.ADMIN, Role.SUPER_ADMIN]} fallback={fallback}>
      {children}
    </PermissionGate>
  );
}

/**
 * SuperAdminOnly - Solo visible para SUPER_ADMIN
 */
export function SuperAdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGate role={Role.SUPER_ADMIN} fallback={fallback}>
      {children}
    </PermissionGate>
  );
}

/**
 * AdvisorOnly - Solo visible para ADVISOR
 */
export function AdvisorOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGate role={Role.ADVISOR} fallback={fallback}>
      {children}
    </PermissionGate>
  );
}

/**
 * ComercialOnly - Solo visible para COMERCIAL
 */
export function ComercialOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGate role={Role.COMERCIAL} fallback={fallback}>
      {children}
    </PermissionGate>
  );
}
