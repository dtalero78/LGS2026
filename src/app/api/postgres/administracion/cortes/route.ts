import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission, hasPermission } from '@/lib/api-permissions';
import { AdministracionPermission } from '@/types/permissions';
import { listarCortes, bloqueoPorGrupoActivo } from '@/services/liq-flujo.service';

/**
 * GET /api/postgres/administracion/cortes?periodo=YYYY-MM
 * Estado de cada corte (advisor × programa × corte) con factura vigente, ajustes e
 * inconsistencias. Gate: GESTION_ADVISORS.VER; valores solo con VER_COMPENSACION.
 */
export const GET = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AdministracionPermission.GESTION_ADVISORS_VER);
  const periodo = new URL(req.url).searchParams.get('periodo') || new Date().toISOString().slice(0, 7);
  const verValores = await hasPermission(session, AdministracionPermission.VER_COMPENSACION);
  const cortes = await listarCortes(periodo);
  const salida = verValores ? cortes : cortes.map((c) => ({
    ...c, valor: null, snapshot: c.snapshot ? { ...c.snapshot, valor: null, valorMes: null, tarifas: null, fijo: null } : null,
    factura: c.factura ? { ...c.factura, extraido: c.factura.extraido ? { ...c.factura.extraido, bruto: null, retencion: null, liquido: null } : null,
      inconsistencias: c.factura.inconsistencias.filter((i) => !i.startsWith('Valor bruto')) } : null,
  }));
  return successResponse({ periodo, cortes: salida, bloqueoGrupo: await bloqueoPorGrupoActivo() });
});
