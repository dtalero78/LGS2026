import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission } from '@/lib/api-permissions';
import { MantenimientoPermission, AcademicoPermission } from '@/types/permissions';
import { queryOne, withTransaction } from '@/lib/postgres';
import { ValidationError, NotFoundError } from '@/lib/errors';

/**
 * POST /api/postgres/advisors/[id]/estado   Body: { activo: boolean }
 *
 * Activa o desactiva un advisor en sus DOS lugares a la vez, para que no queden
 * desalineados:
 *   - ADVISORS.activo        → listas de advisors, agenda, informes, Lgs-Buckets
 *   - USUARIOS_ROLES.activo  → login (cuenta vinculada por usuarioRolId o email,
 *                              solo si es rol ADVISOR: nunca toca cuentas de otro rol)
 * No mueve ni borra sus clases: al desactivar, el modal avisa cuántas clases futuras
 * tiene asignadas (GET /api/postgres/advisors/[id] → clasesFuturas) para reasignarlas.
 *
 * Gate: MANTENIMIENTO.LGS_BUCKETS.EDITAR o ACADEMICO.ADVISOR.EDITAR.
 */
export const POST = handlerWithAuth(async (req, ctx, session) => {
  await requireAnyPermission(session, [MantenimientoPermission.LGS_BUCKETS_EDITAR, AcademicoPermission.ADVISOR_EDITAR]);
  const id = ctx.params.id;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.activo !== 'boolean') throw new ValidationError('activo (true/false) es requerido');
  const activo: boolean = body.activo;

  const adv = await queryOne<any>(
    `SELECT "_id","email","usuarioRolId" FROM "ADVISORS" WHERE "_id" = $1 LIMIT 1`, [id]
  );
  if (!adv) throw new NotFoundError('Advisor', id);

  const resultado = await withTransaction(async (client) => {
    await client.query(
      `UPDATE "ADVISORS" SET "activo" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`, [activo, id]
    );
    // Cuenta de acceso: por usuarioRolId y, si no hay, por email — solo rol ADVISOR.
    const ur = await client.query(
      `UPDATE "USUARIOS_ROLES" SET "activo" = $1, "_updatedDate" = NOW()
        WHERE UPPER(COALESCE("rol",'')) = 'ADVISOR'
          AND ( ("_id" = $2 AND $2 IS NOT NULL)
             OR ($2 IS NULL AND LOWER(TRIM("email")) = LOWER(TRIM($3))) )
        RETURNING "_id"`,
      [activo, adv.usuarioRolId || null, adv.email || '']
    );
    return { loginActualizado: (ur.rowCount || 0) > 0 };
  });

  const quien = (session?.user as any)?.email || 'desconocido';
  console.log(`[advisor-estado] ${id} → ${activo ? 'ACTIVO' : 'INACTIVO'} por ${quien} (login ${resultado.loginActualizado ? 'actualizado' : 'sin cuenta ADVISOR'})`);

  return successResponse({ activo, ...resultado });
});
