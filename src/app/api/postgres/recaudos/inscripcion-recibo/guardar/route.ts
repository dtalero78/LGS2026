import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission, Role } from '@/types/permissions';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { guardarReciboEnFinanciero, isLeerReciboActivo } from '@/services/recibo-extract.service';

/**
 * POST /api/postgres/recaudos/inscripcion-recibo/guardar
 * Body: { contrato, url, campos: {medioPago,fecha,monto,referencia,banco,confianza} }
 * Guarda en FINANCIEROS (columnas recibo*) los datos confirmados por el operador.
 * Gate: PAGOS_VALIDAR + flag (SUPER_ADMIN/ADMIN bypass).
 */
export const POST = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, PersonPermission.PAGOS_VALIDAR);
  const role = ((session?.user as any)?.role ?? '') as string;
  const isAdmin = role === Role.SUPER_ADMIN || role === Role.ADMIN || role === 'admin';
  if (!(await isLeerReciboActivo()) && !isAdmin) {
    throw new ForbiddenError('La lectura de recibos no está habilitada.');
  }
  const body = await req.json();
  const contrato = String(body?.contrato || '').trim();
  if (!contrato) throw new ValidationError('contrato es requerido.');

  await guardarReciboEnFinanciero({
    contrato,
    url: body?.url ?? null,
    campos: body?.campos || {},
    actor: (session?.user?.email as string) || 'desconocido',
  });
  return successResponse({ ok: true, message: 'Datos del recibo guardados en el financiero.' });
});
