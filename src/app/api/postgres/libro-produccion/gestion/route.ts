import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission, hasPermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { gestionComercial } from '@/services/libro-produccion.service';

/**
 * GET /api/postgres/libro-produccion/gestion?anio=2026&mes=11   (mes vacío = todo el año)
 * Pestaña "Gestión" del Libro de Producción (Gestión Comercial): contratos de la vigencia
 * comercial con país, filial, semana, grupo de estado y escala. Agregación en el cliente.
 * Gate: staff + APROBACION.LIBRO_PRODUCCION.GESTION.
 */
export const GET = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AprobacionPermission.LIBRO_PRODUCCION_GESTION);
  const sp = new URL(req.url).searchParams;
  const anio = parseInt(sp.get('anio') || '', 10) || new Date().getFullYear();
  const mes = parseInt(sp.get('mes') || '', 10);
  // El nombre del titular solo viaja a quien puede ver el Libro (los demás ven N° de contrato y asesor).
  const conTitular = await hasPermission(session, AprobacionPermission.LIBRO_PRODUCCION_VER);
  return successResponse(await gestionComercial(anio, mes >= 1 && mes <= 12 ? mes : null, { conTitular }));
});
