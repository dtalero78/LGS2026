import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/users/by-role?roles=RECAUDO_ASIST,RECAUDOS_JEFE&activeOnly=true
 *
 * Lists USUARIOS_ROLES filtered by one or more roles. Used to populate
 * dropdowns where the admin selects a user (e.g. assigning a collection
 * executive to a TITULAR in /person/[id]).
 *
 * Query params:
 *   roles      — comma-separated list of role codes. Required.
 *   activeOnly — when 'true' (default), only returns activo=true rows.
 *
 * Returns: [{ _id, email, nombre, rol, activo }]
 */
export const GET = handlerWithAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const rolesParam = (searchParams.get('roles') || '').trim();
  if (!rolesParam) {
    throw new ValidationError('Parámetro "roles" requerido (lista separada por comas)');
  }
  const roles = rolesParam.split(',').map(r => r.trim()).filter(Boolean);
  if (roles.length === 0) {
    throw new ValidationError('Se debe especificar al menos un rol');
  }
  const activeOnly = (searchParams.get('activeOnly') || 'true').toLowerCase() !== 'false';

  const conditions: string[] = [`"rol" = ANY($1)`];
  const params: any[] = [roles];
  if (activeOnly) {
    conditions.push(`"activo" = true`);
  }

  const users = await queryMany<{ _id: string; email: string; nombre: string; rol: string; activo: boolean }>(
    `SELECT "_id", "email", "nombre", "rol", "activo"
     FROM "USUARIOS_ROLES"
     WHERE ${conditions.join(' AND ')}
     ORDER BY "nombre" ASC NULLS LAST, "email" ASC`,
    params
  );

  return successResponse({ users, count: users.length });
});
