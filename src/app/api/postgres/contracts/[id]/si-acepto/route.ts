import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission } from '@/lib/api-permissions';
import { AprobacionPermission, ComercialPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { ratificarSiAcepto } from '@/lib/ratificar-si-acepto';

/**
 * POST /api/postgres/contracts/[id]/si-acepto   (FormData: file (PDF), declaracion=true, confirmarOtros?)
 * "Dejar listo para aprobación" › casilla "No tiene firma: anexar el Sí acepto": la impresión
 * (solo PDF) del correo "SÍ, ACEPTO" cuenta como firma — misma regla que Ratificar del Libro
 * (lib/ratificar-si-acepto). Gate: COMERCIAL.CONTRATO.ANEXAR_SI_ACEPTO o
 * APROBACION.LIBRO_PRODUCCION.RATIFICAR.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, { params }, session) => {
  await requireAnyPermission(session, [
    ComercialPermission.ANEXAR_SI_ACEPTO as any,
    AprobacionPermission.LIBRO_PRODUCCION_RATIFICAR as any,
  ]);
  const form = await req.formData();
  if (form.get('declaracion') !== 'true') {
    throw new ValidationError('Confirme que el correo es del titular y que acepta este contrato');
  }
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const r = await ratificarSiAcepto({
    titularId: params.id,
    file: form.get('file') as File | null,
    confirmarOtros: form.get('confirmarOtros') === 'true',
    soloPdf: true, origen: 'CONTRATO', session, ip, userAgent: req.headers.get('user-agent') || 'unknown',
  });
  return successResponse(r);
});
