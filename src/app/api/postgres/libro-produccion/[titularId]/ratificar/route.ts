import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { ratificarSiAcepto } from '@/lib/ratificar-si-acepto';

/**
 * POST /api/postgres/libro-produccion/[titularId]/ratificar   (FormData: file, confirmarOtros?)
 * Ratifica un contrato SIN FIRMAR con el correo "SÍ, ACEPTO" del titular (PDF, imagen o
 * .eml/.msg) — lógica en lib/ratificar-si-acepto (compartida con la pantalla del contrato).
 * Gate: staff + APROBACION.LIBRO_PRODUCCION.RATIFICAR.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, ctx, session) => {
  await requirePermission(session, AprobacionPermission.LIBRO_PRODUCCION_RATIFICAR);
  const form = await req.formData();
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const r = await ratificarSiAcepto({
    titularId: ctx.params.titularId,
    file: form.get('file') as File | null,
    confirmarOtros: form.get('confirmarOtros') === 'true',
    origen: 'LIBRO', session, ip, userAgent: req.headers.get('user-agent') || 'unknown',
  });
  return successResponse(r);
});
