/**
 * Hook de React para verificar permisos del usuario
 */

'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Permission, Role } from '@/types/permissions';
import { getRolePermissions } from '@/lib/permissions';

export function usePermissions() {
  const { data: session, status } = useSession();
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsSource, setPermissionsSource] = useState<'wix' | 'fallback' | 'loading'>('loading');

  const userRole = (session?.user as any)?.role as Role | undefined;
  const isLoading = status === 'loading' || permissionsLoading;

  // Cargar permisos desde Wix cuando el usuario está autenticado
  useEffect(() => {
    if (!userRole || status === 'loading') {
      setUserPermissions([]);
      setPermissionsLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        setPermissionsLoading(true);
        console.log(`🔄 Cargando permisos para rol: ${userRole}`);

        const response = await fetch('/api/user/permissions', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Permisos cargados desde ${data.source}:`, data.count);
          console.log('📋 Lista de permisos:', data.permissions);
          // Asegurar que siempre sea un array
          const permissions = Array.isArray(data.permissions) ? data.permissions : [];
          setUserPermissions(permissions);
          setPermissionsSource(data.source);
        } else {
          // Fallback local si la API falla
          console.warn('⚠️ API falló, usando fallback local');
          const fallback = getRolePermissions(userRole);
          setUserPermissions(fallback);
          setPermissionsSource('fallback');
        }
      } catch (error) {
        console.error('❌ Error cargando permisos:', error);
        // Fallback local en caso de error
        const fallback = getRolePermissions(userRole);
        setUserPermissions(fallback);
        setPermissionsSource('fallback');
      } finally {
        setPermissionsLoading(false);
      }
    };

    loadPermissions();
  }, [userRole, status]);

  // DEBUG: Log permissions
  console.log('🔐 usePermissions DEBUG:', {
    userRole,
    isLoading,
    permissionsSource,
    permissionsCount: Array.isArray(userPermissions) ? userPermissions.length : 0,
    permissions: Array.isArray(userPermissions) ? userPermissions.slice(0, 5) : [], // Solo primeros 5 para no saturar
  });

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const hasPermission = (permission: Permission): boolean => {
    if (!userRole) return false;
    return userPermissions.includes(permission);
  };

  /**
   * Verifica si el usuario tiene TODOS los permisos especificados
   */
  const hasAllPermissions = (permissions: Permission[]): boolean => {
    if (!userRole) return false;
    return permissions.every((permission) => userPermissions.includes(permission));
  };

  /**
   * Verifica si el usuario tiene ALGUNO de los permisos especificados
   */
  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!userRole) return false;
    return permissions.some((permission) => userPermissions.includes(permission));
  };

  return {
    userRole,
    userPermissions,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    isLoading,
    isAuthenticated: !!session,
    permissionsSource,
    isRole: (role: Role) => userRole === role,
    isAnyRole: (roles: Role[]) => !!userRole && roles.includes(userRole),
  };
}
