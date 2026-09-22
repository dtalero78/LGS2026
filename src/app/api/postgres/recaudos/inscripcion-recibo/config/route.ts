import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission, hasPermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { isLeerReciboActivo } from '@/services/recibo-extract.service';

/**
 * GET /api/postgres/recaudos/inscripcion-recibo/config
 * Indica si la UI debe mostrar el botón "Leer recibo": activo si el usuario
 * tiene el permiso PERSON.FINANCIERA.LEER_RECIBO (asignable por rol en
 * /admin/permissions; SUPER_ADMIN/ADMIN siempre), o si el flag global
 * leer_recibo_activo está ON (respaldo backward-compat).
 */
export const GET = handlerWithAuth(async (_req: NextRequest, _ctx, session) => {
  await requireAnyPermission(session, [PersonPermission.PAGOS_VALIDAR, PersonPermission.PAGOS_REGISTRAR]);
  const active = (await hasPermission(session, PersonPermission.LEER_RECIBO)) || (await isLeerReciboActivo());
  return successResponse({ active });
});
