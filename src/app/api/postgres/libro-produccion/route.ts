import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { libroDeVigencia, libroPapelera } from '@/services/libro-produccion.service';

/**
 * GET /api/postgres/libro-produccion?vigenciaId=
 * Libro de Producción de una vigencia comercial (sin vigenciaId = la actual).
 * Devuelve las vigencias disponibles, la elegida y un registro por contrato con sus
 * beneficiarios. Gate: staff + APROBACION.LIBRO_PRODUCCION.VER.
 * ?papelera=1 → contratos en la Papelera (todas las vigencias); exige además .PAPELERA.
 */
export const GET = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AprobacionPermission.LIBRO_PRODUCCION_VER);
  const sp = new URL(req.url).searchParams;
  if (sp.get('papelera') === '1') {
    await requirePermission(session, AprobacionPermission.LIBRO_PRODUCCION_PAPELERA);
    return successResponse(await libroPapelera());
  }
  return successResponse(await libroDeVigencia(sp.get('vigenciaId')));
});
