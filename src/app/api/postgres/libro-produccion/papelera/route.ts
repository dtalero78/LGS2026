import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { borrarDePapelera, restaurarDePapelera } from '@/services/libro-papelera.service';

/**
 * POST /api/postgres/libro-produccion/papelera
 *   Body: { accion: 'restaurar' | 'borrar', titularIds: string[], motivo?, confirmado? }
 * Restaurar = vuelve a «Por resolver» con 15 días más de gracia. Borrar = borrado
 * definitivo con la regla de la Limpieza de Anulados (PURGE_LOG tipo PAPELERA), revalidando
 * antes que siga sin pagos validados ni clases. Gate: staff + .PAPELERA_BORRAR.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AprobacionPermission.LIBRO_PRODUCCION_PAPELERA_BORRAR);
  const body = await req.json().catch(() => ({}));
  const titularIds: string[] = Array.isArray(body?.titularIds) ? body.titularIds : [];
  if (body?.accion === 'restaurar') return successResponse(await restaurarDePapelera(titularIds, session));
  if (body?.accion !== 'borrar') throw new ValidationError('Acción inválida');
  if (body?.confirmado !== true) throw new ValidationError('Confirma que entiendes que se borran los contratos y sus registros');
  return successResponse(await borrarDePapelera(titularIds, body?.motivo, session, {
    ip: (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim().slice(0, 45),
    userAgent: req.headers.get('user-agent') || '',
  }));
});
