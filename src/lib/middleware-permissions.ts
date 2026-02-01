/**
 * Middleware Permissions - Sistema de permisos para Next.js middleware
 * Carga permisos desde PostgreSQL con cache para optimizar performance
 */

import { Role, Permission } from '@/types/permissions';

// Cache en memoria con TTL de 5 minutos
interface CacheEntry {
  permissions: Permission[];
  timestamp: number;
}

const permissionsCache = new Map<Role, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Carga los permisos de un rol desde PostgreSQL (con cache)
 */
export async function getPermissionsForRoleFromWix(role: Role): Promise<Permission[]> {
  // Verificar cache
  const cached = permissionsCache.get(role);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`🔄 [Middleware] Cache HIT para rol ${role}`);
    return cached.permissions;
  }

  console.log(`📡 [Middleware] Cargando permisos desde API para rol ${role}`);

  try {
    // Use API endpoint instead of direct PostgreSQL connection
    // Middleware runs in Edge Runtime which doesn't support pg module
    const apiUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
    const response = await fetch(
      `${apiUrl}/api/postgres/permissions?rol=${encodeURIComponent(role)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.permisos) {
      const permissions = data.permisos as Permission[];

      // Actualizar cache
      permissionsCache.set(role, {
        permissions,
        timestamp: now,
      });

      console.log(`✅ [Middleware] Permisos cargados: ${permissions.length} permisos`);
      return permissions;
    }

    // Si no hay resultado, retornar array vacío
    console.warn(`⚠️ [Middleware] Rol ${role} no encontrado`);
    return [];
  } catch (error) {
    console.error(`❌ [Middleware] API error para ${role}:`, error);

    // En caso de error, usar fallback hardcodeado
    console.log(`⚠️ [Middleware] Usando permisos hardcodeados para rol ${role}`);
    const { getPermissionsByRole } = await import('@/config/roles');
    return getPermissionsByRole(role);
  }
}

/**
 * Mapeo de rutas a los permisos requeridos para acceder
 * Si la ruta coincide con alguna de estas, se verifican los permisos
 */
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  // Académico - Agenda Sesiones
  '/dashboard/academic/agenda-sesiones': [
    'ACADEMICO.AGENDA.VER_CALENDARIO' as Permission,
    'ACADEMICO.AGENDA.VER_AGENDA' as Permission,
    'ACADEMICO.AGENDA.CALENDARIO_VER' as Permission,
    'ACADEMICO.AGENDA.LISTA_VER' as Permission,
    'ACADEMICO.AGENDA.FILTRO' as Permission,
    'ACADEMICO.AGENDA.NUEVO_EVENTO' as Permission,
    'ACADEMICO.AGENDA.EXPORTAR_CSV' as Permission,
    'ACADEMICO.AGENDA.EDITAR' as Permission,
    'ACADEMICO.AGENDA.ELIMINAR' as Permission,
    'ACADEMICO.AGENDA.CREAR_EVENTO' as Permission,
  ],

  // Académico - Agenda Académica
  '/dashboard/academic/agenda-academica': [
    'ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA' as Permission,
    'ACADEMICO.ACADEMICA.VER' as Permission,
    'ACADEMICO.ACADEMICA.AGENDAMIENTO' as Permission,
    'ACADEMICO.ACADEMICA.EXPORTAR_CSV' as Permission,
    'ACADEMICO.ACADEMICA.ESTADISTICAS' as Permission,
    'ACADEMICO.ACADEMICA.EXPORTAR_STATS_CSV' as Permission,
  ],

  // Académico - Advisors
  '/dashboard/academic/advisors': [
    'ACADEMICO.ADVISOR.LISTA_VER' as Permission, // ← TALERO tiene este
    'ACADEMICO.ADVISOR.AGREGAR' as Permission,
    'ACADEMICO.ADVISOR.ESTADISTICA' as Permission,
  ],

  // Panel Advisor
  '/panel-advisor': [
    'ACADEMICO.ADVISOR.VER_ENLACE' as Permission,
  ],

  // Servicio - Welcome Session
  '/dashboard/servicio/welcome-session': [
    'SERVICIO.WELCOME.CARGAR_EVENTOS' as Permission,
    'SERVICIO.WELCOME.EXPORTAR_CSV' as Permission,
  ],

  // Servicio - Lista de Sesiones
  '/dashboard/servicio/lista-sesiones': [
    'SERVICIO.SESIONES.CARGAR_EVENTOS' as Permission,
    'SERVICIO.SESIONES.EXPORTAR_CSV' as Permission,
  ],

  // Servicio - Usuarios sin perfil
  '/dashboard/servicio/sin-registro': [
    'SERVICIO.USUARIOS.ACTUALIZAR' as Permission,
    'SERVICIO.USUARIOS.EXPORTAR_CSV' as Permission,
  ],

  // Comercial - Crear Contrato
  '/dashboard/comercial/crear-contrato': [
    'COMERCIAL.CONTRATO.MODIFICAR' as Permission,
    'COMERCIAL.CONTRATO.ENVIAR_PDF' as Permission,
    'COMERCIAL.CONTRATO.DESCARGAR' as Permission,
    'COMERCIAL.CONTRATO.APROBACION_AUTONOMA' as Permission,
  ],

  // Comercial - Prospectos
  '/dashboard/comercial/prospectos': [
    'COMERCIAL.PROSPECTOS.VER' as Permission,
  ],

  // Aprobación
  '/dashboard/aprobacion': [
    'APROBACION.MODIFICAR.ACTUALIZAR' as Permission,
    'APROBACION.MODIFICAR.EXPORTAR_CSV' as Permission,
    'APROBACION.MODIFICAR.CONTRATO' as Permission,
    'APROBACION.MODIFICAR.ENVIAR_PDF' as Permission,
    'APROBACION.MODIFICAR.DESCARGAR' as Permission,
    'APROBACION.MODIFICAR.APROBACION_AUTONOMA' as Permission,
  ],
};

/**
 * Rutas genéricas que tienen acceso basado en permisos amplios
 */
export const GENERIC_ROUTE_ACCESS: Record<string, Permission[]> = {
  '/dashboard/academic': [
    // Cualquier permiso ACADEMICO.* da acceso a la sección
    'ACADEMICO.AGENDA.VER_CALENDARIO' as Permission,
    'ACADEMICO.AGENDA.VER_AGENDA' as Permission,
    'ACADEMICO.AGENDA.CALENDARIO_VER' as Permission,
    'ACADEMICO.AGENDA.LISTA_VER' as Permission,
    'ACADEMICO.AGENDA.FILTRO' as Permission,
    'ACADEMICO.AGENDA.NUEVO_EVENTO' as Permission,
    'ACADEMICO.AGENDA.EXPORTAR_CSV' as Permission,
    'ACADEMICO.AGENDA.EDITAR' as Permission,
    'ACADEMICO.AGENDA.ELIMINAR' as Permission,
    'ACADEMICO.AGENDA.CREAR_EVENTO' as Permission,
    'ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA' as Permission,
    'ACADEMICO.ACADEMICA.VER' as Permission,
    'ACADEMICO.ACADEMICA.AGENDAMIENTO' as Permission,
    'ACADEMICO.ACADEMICA.EXPORTAR_CSV' as Permission,
    'ACADEMICO.ACADEMICA.ESTADISTICAS' as Permission,
    'ACADEMICO.ACADEMICA.EXPORTAR_STATS_CSV' as Permission,
    'ACADEMICO.ADVISOR.LISTA_VER' as Permission,
    'ACADEMICO.ADVISOR.VER_ENLACE' as Permission,
    'ACADEMICO.ADVISOR.AGREGAR' as Permission,
    'ACADEMICO.ADVISOR.ESTADISTICA' as Permission,
  ],

  '/dashboard/servicio': [
    // Cualquier permiso SERVICIO.* da acceso a la sección
    'SERVICIO.WELCOME.CARGAR_EVENTOS' as Permission,
    'SERVICIO.WELCOME.EXPORTAR_CSV' as Permission,
    'SERVICIO.SESIONES.CARGAR_EVENTOS' as Permission,
    'SERVICIO.SESIONES.EXPORTAR_CSV' as Permission,
    'SERVICIO.USUARIOS.ACTUALIZAR' as Permission,
    'SERVICIO.USUARIOS.EXPORTAR_CSV' as Permission,
  ],

  '/dashboard/comercial': [
    // Cualquier permiso COMERCIAL.* da acceso a la sección
    'COMERCIAL.CONTRATO.MODIFICAR' as Permission,
    'COMERCIAL.CONTRATO.ENVIAR_PDF' as Permission,
    'COMERCIAL.CONTRATO.DESCARGAR' as Permission,
    'COMERCIAL.CONTRATO.APROBACION_AUTONOMA' as Permission,
    'COMERCIAL.PROSPECTOS.VER' as Permission,
  ],
};

/**
 * Verifica si un usuario tiene permiso para acceder a una ruta
 */
export function hasAccessToRoute(
  pathname: string,
  userPermissions: Permission[]
): boolean {
  // 1. Verificar si hay permisos específicos para esta ruta exacta
  const specificPerms = ROUTE_PERMISSIONS[pathname];
  if (specificPerms) {
    const hasAccess = specificPerms.some(perm => userPermissions.includes(perm));
    console.log(`  🔍 Ruta específica ${pathname}: ${hasAccess ? '✅' : '❌'} (requiere alguno de ${specificPerms.length} permisos)`);
    return hasAccess;
  }

  // 2. Verificar rutas genéricas (padre de la ruta)
  for (const [routePrefix, requiredPerms] of Object.entries(GENERIC_ROUTE_ACCESS)) {
    if (pathname.startsWith(routePrefix)) {
      const hasAccess = requiredPerms.some(perm => userPermissions.includes(perm));
      console.log(`  🔍 Ruta genérica ${routePrefix}: ${hasAccess ? '✅' : '❌'}`);
      return hasAccess;
    }
  }

  // 3. Rutas sin restricciones de permisos específicos
  console.log(`  ℹ️ Ruta ${pathname} no tiene permisos específicos definidos - PERMITIDO por defecto`);
  return true;
}

/**
 * Invalida el cache de permisos (útil para testing)
 */
export function invalidatePermissionsCache(role?: Role) {
  if (role) {
    permissionsCache.delete(role);
    console.log(`🗑️ [Middleware] Cache invalidado para rol ${role}`);
  } else {
    permissionsCache.clear();
    console.log(`🗑️ [Middleware] Cache completo invalidado`);
  }
}
