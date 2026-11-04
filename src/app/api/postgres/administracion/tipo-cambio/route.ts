import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AdministracionPermission } from '@/types/permissions';
import { guardarTipoCambio } from '@/services/liquidacion-advisors.service';

/**
 * POST /api/postgres/administracion/tipo-cambio  Body: { fecha: 'AAAA-MM-DD', COP?: number, CLP?: number }
 * Registra el valor de 1 USD en COP y/o CLP para ese día (manual, hasta automatizarlo).
 * Gate: ADMINISTRACION.GESTION_ADVISORS.TARIFAS.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AdministracionPermission.TARIFAS);
  const body = await req.json().catch(() => ({}));
  await guardarTipoCambio(body, (session?.user as any)?.email || 'desconocido');
  return successResponse({ ok: true });
});
