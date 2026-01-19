/**
 * Utilidades de Permisos - LGS Admin Panel
 * Funciones para verificar y gestionar permisos de usuarios
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  Permission,
  Role,
  PermissionCheck,
  UserWithPermissions,
} from '@/types/permissions';
import { getPermissionsByRole as getDefaultPermissions, roleHasPermission as defaultRoleHasPermission } from '@/config/roles';
import { getPermissionsForRole } from '@/lib/custom-permissions';

// ============================================================================
// VERIFICACIÓN DE PERMISOS
// ============================================================================

/**
 * Verifica si el usuario actual tiene un permiso específico
 * @param permission Permiso a verificar
 * @returns Promise con el resultado de la verificación
 */
export async function checkPermission(permission: Permission): Promise<PermissionCheck> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return {
      allowed: false,
      reason: 'Usuario no autenticado',
    };
  }

  const userRole = (session.user as any).role as Role;

  if (!userRole) {
    return {
      allowed: false,
      reason: 'Usuario sin rol asignado',
    };
  }

  // Obtener permisos (personalizados o por defecto)
  const userPermissions = getPermissionsForRole(userRole);
  const hasPermission = userPermissions.includes(permission);

  return {
    allowed: hasPermission,
    reason: hasPermission ? undefined : 'Permisos insuficientes',
  };
}

/**
 * Verifica si el usuario actual tiene TODOS los permisos especificados
 * @param permissions Array de permisos a verificar
 * @returns Promise con el resultado de la verificación
 */
export async function checkAllPermissions(
  permissions: Permission[]
): Promise<PermissionCheck> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return {
      allowed: false,
      reason: 'Usuario no autenticado',
    };
  }

  const userRole = (session.user as any).role as Role;

  if (!userRole) {
    return {
      allowed: false,
      reason: 'Usuario sin rol asignado',
    };
  }

  // Obtener permisos (personalizados o por defecto)
  const userPermissions = getPermissionsForRole(userRole);
  const missingPermissions = permissions.filter(
    (permission) => !userPermissions.includes(permission)
  );

  if (missingPermissions.length > 0) {
    return {
      allowed: false,
      reason: `Faltan permisos: ${missingPermissions.join(', ')}`,
    };
  }

  return {
    allowed: true,
  };
}

/**
 * Verifica si el usuario actual tiene ALGUNO de los permisos especificados
 * @param permissions Array de permisos a verificar
 * @returns Promise con el resultado de la verificación
 */
export async function checkAnyPermission(
  permissions: Permission[]
): Promise<PermissionCheck> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return {
      allowed: false,
      reason: 'Usuario no autenticado',
    };
  }

  const userRole = (session.user as any).role as Role;

  if (!userRole) {
    return {
      allowed: false,
      reason: 'Usuario sin rol asignado',
    };
  }

  // Obtener permisos (personalizados o por defecto)
  const userPermissions = getPermissionsForRole(userRole);
  const hasAnyPermission = permissions.some((permission) =>
    userPermissions.includes(permission)
  );

  return {
    allowed: hasAnyPermission,
    reason: hasAnyPermission ? undefined : 'No tiene ninguno de los permisos requeridos',
  };
}

// ============================================================================
// OBTENCIÓN DE INFORMACIÓN DEL USUARIO
// ============================================================================

/**
 * Obtiene el usuario actual con sus permisos
 * @returns Promise con el usuario y sus permisos, o null si no está autenticado
 */
export async function getCurrentUserWithPermissions(): Promise<UserWithPermissions | null> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return null;
  }

  const user = session.user as any;
  const userRole = user.role as Role;

  if (!userRole) {
    return null;
  }

  // Obtener permisos (personalizados o por defecto)
  const permissions = getPermissionsForRole(userRole);

  return {
    id: user.id || user.email,
    email: user.email || '',
    name: user.name || '',
    role: userRole,
    permissions,
  };
}

/**
 * Obtiene solo los permisos del usuario actual
 * @returns Promise con el array de permisos, o array vacío si no está autenticado
 */
export async function getCurrentUserPermissions(): Promise<Permission[]> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return [];
  }

  const userRole = (session.user as any).role as Role;

  if (!userRole) {
    return [];
  }

  // Obtener permisos (personalizados o por defecto)
  return getPermissionsForRole(userRole);
}

/**
 * Obtiene el rol del usuario actual
 * @returns Promise con el rol del usuario, o null si no está autenticado
 */
export async function getCurrentUserRole(): Promise<Role | null> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return null;
  }

  return (session.user as any).role as Role || null;
}

// ============================================================================
// FUNCIONES CLIENT-SIDE
// ============================================================================

/**
 * Verifica si un rol específico tiene un permiso (función síncrona para client-side)
 * @param role Rol a verificar
 * @param permission Permiso a verificar
 * @returns true si el rol tiene el permiso
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  // Obtener permisos (personalizados o por defecto)
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

/**
 * Obtiene los permisos de un rol (función síncrona para client-side)
 * @param role Rol del cual obtener permisos
 * @returns Array de permisos del rol
 */
export function getRolePermissions(role: Role): Permission[] {
  // Obtener permisos (personalizados o por defecto)
  return getPermissionsForRole(role);
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Genera una función middleware que verifica un permiso específico
 * Uso: const requirePermission = createPermissionMiddleware(Permission.STUDENT_ELIMINAR_EVENTO);
 */
export function createPermissionMiddleware(permission: Permission) {
  return async (): Promise<boolean> => {
    const check = await checkPermission(permission);
    return check.allowed;
  };
}

/**
 * Genera una función middleware que verifica múltiples permisos (todos requeridos)
 */
export function createAllPermissionsMiddleware(permissions: Permission[]) {
  return async (): Promise<boolean> => {
    const check = await checkAllPermissions(permissions);
    return check.allowed;
  };
}

/**
 * Genera una función middleware que verifica múltiples permisos (alguno requerido)
 */
export function createAnyPermissionMiddleware(permissions: Permission[]) {
  return async (): Promise<boolean> => {
    const check = await checkAnyPermission(permissions);
    return check.allowed;
  };
}
