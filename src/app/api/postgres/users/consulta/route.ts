import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/users/consulta?rol=&search=
 *
 * Consulta de USUARIOS_ROLES por rol (email, nombre, teléfono, usuario=numberid,
 * clave=password). Muestra credenciales → gateado por MANTENIMIENTO.USUARIOS.CREAR_ROL
 * (SUPER_ADMIN/ADMIN bypass).
 *
 *   sin `rol`         → { roles: [{ rol, total }] }  (para poblar el dropdown)
 *   con `rol=X`       → { users: [...] }  (rol='__ALL__' devuelve todos)
 */
export const GET = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);

  const { searchParams } = new URL(request.url);
  const rol = (searchParams.get('rol') || '').trim();
  const search = (searchParams.get('search') || '').trim().toLowerCase();

  // Sin rol → lista de roles con conteo para el dropdown.
  if (!rol) {
    const roles = await queryMany<{ rol: string; total: number }>(
      `SELECT "rol", COUNT(*)::int AS total
         FROM "USUARIOS_ROLES"
        GROUP BY "rol"
        ORDER BY "rol"`,
    );
    return successResponse({ roles });
  }

  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (rol !== '__ALL__') { conditions.push(`"rol" = $${i++}`); params.push(rol); }
  if (search) {
    conditions.push(
      `(LOWER("email") LIKE $${i} OR LOWER(COALESCE("nombre",'')) LIKE $${i} OR LOWER(COALESCE("apellido",'')) LIKE $${i} OR LOWER(COALESCE("numberid",'')) LIKE $${i} OR LOWER(COALESCE("celular",'')) LIKE $${i})`,
    );
    params.push(`%${search}%`); i++;
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const users = await queryMany(
    `SELECT "email", "nombre", "apellido", "celular", "numberid", "password", "rol", "plataforma", "activo"
       FROM "USUARIOS_ROLES"
       ${where}
      ORDER BY "nombre" NULLS LAST, "apellido" NULLS LAST
      LIMIT 5000`,
    params,
  );

  return successResponse({ users });
});
