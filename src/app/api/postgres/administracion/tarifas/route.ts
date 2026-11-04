import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requireAnyPermission, requirePermission } from '@/lib/api-permissions';
import { AdministracionPermission } from '@/types/permissions';
import { listarTarifas, guardarTarifa } from '@/services/gestion-advisors.service';

/**
 * GET  /api/postgres/administracion/tarifas  → tabla de tarifas de advisors (VER_COMPENSACION o TARIFAS)
 * POST /api/postgres/administracion/tarifas  Body: { pais, programa, tipo, categoria, concepto, moneda, valor, vigenteDesde }
 *      Crea una tarifa (TARIFAS).
 */
export const GET = handlerWithStaffAuth(async (_req: NextRequest, _ctx, session) => {
  await requireAnyPermission(session, [AdministracionPermission.VER_COMPENSACION, AdministracionPermission.TARIFAS]);
  return successResponse({ tarifas: await listarTarifas() });
});

export const POST = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AdministracionPermission.TARIFAS);
  const body = await req.json().catch(() => ({}));
  const id = await guardarTarifa(body, (session?.user as any)?.email || 'desconocido');
  return successResponse({ id });
});
