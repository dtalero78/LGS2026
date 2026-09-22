/**
 * Server-side permission verification helper for API routes.
 *
 * Usage:
 *   import { requirePermission } from '@/lib/api-permissions';
 *   await requirePermission(session, PersonPermission.PAGOS_VALIDAR);
 *
 * - SUPER_ADMIN and ADMIN bypass automatically (consistent with `PermissionGuard.isRole` en frontend).
 * - Lee permisos directo del repositorio (no via HTTP) y cachea por rol durante 5 min.
 * - Throws ForbiddenError si falta el permiso.
 */

import 'server-only';
import { Session } from 'next-auth';
import { ForbiddenError } from './errors';
import { Permission, Role } from '@/types/permissions';
import { RolPermisosRepository } from '@/repositories/roles.repository';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { perms: string[]; expires: number }>();

/**
 * Limpia el caché de permisos que usa `requirePermission`/`requireAnyPermission`.
 * DEBE llamarse tras editar los permisos de un rol (PUT roles/[rol]/permissions),
 * de lo contrario el gate de las rutas API sigue con la lista vieja hasta 5 min.
 * Sin argumento limpia todo; con `role` limpia solo ese rol.
 */
export function invalidateApiPermissionsCache(role?: string): void {
  if (role) cache.delete(role);
  else cache.clear();
}

async function loadPermissions(role: string): Promise<string[]> {
  const cached = cache.get(role);
  if (cached && cached.expires > Date.now()) return cached.perms;

  const row = await RolPermisosRepository.findByRol(role);
  const perms = Array.isArray((row as any)?.permisos) ? (row as any).permisos as string[] : [];

  cache.set(role, { perms, expires: Date.now() + CACHE_TTL_MS });
  return perms;
}

export async function requirePermission(session: Session | null, permission: Permission): Promise<void> {
  const role = ((session?.user as any)?.role ?? '') as string;

  // SUPER_ADMIN / ADMIN bypass — coincide con PermissionGuard del frontend
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN || role === 'admin') return;

  const perms = await loadPermissions(role);
  if (!perms.includes(permission)) {
    throw new ForbiddenError(`Permiso requerido: ${permission}`);
  }
}

/** Devuelve `true` si el usuario tiene el permiso (SUPER_ADMIN/ADMIN → siempre true).
 *  Versión booleana de `requirePermission` (no lanza) para gates condicionales. */
export async function hasPermission(session: Session | null, permission: Permission): Promise<boolean> {
  const role = ((session?.user as any)?.role ?? '') as string;
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN || role === 'admin') return true;
  const perms = await loadPermissions(role);
  return perms.includes(permission);
}

/** Pasa si el usuario tiene AL MENOS UNO de los permisos (SUPER_ADMIN/ADMIN bypass). */
export async function requireAnyPermission(session: Session | null, permissions: Permission[]): Promise<void> {
  const role = ((session?.user as any)?.role ?? '') as string;
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN || role === 'admin') return;

  const perms = await loadPermissions(role);
  if (!permissions.some(p => perms.includes(p))) {
    throw new ForbiddenError(`Se requiere alguno de: ${permissions.join(', ')}`);
  }
}
