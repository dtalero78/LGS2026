import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AdministracionPermission } from '@/types/permissions';
import { guardarFichaPago } from '@/services/gestion-advisors.service';

const CAMPOS_COMPENSACION = ['valorFijoMensual', 'horasContratadas', 'horasGestionAdmin'];

/**
 * PATCH /api/postgres/administracion/advisors/[id]
 * Body (parcial): { tipoContratacion, categoriaTarifa, programa, grupoPago, kidsUserId,
 *                   valorFijoMensual, horasContratadas, horasGestionAdmin }
 * Gate: FICHA_PAGO; los campos de compensación exigen además VER_COMPENSACION.
 */
export const PATCH = handlerWithStaffAuth(async (req: NextRequest, ctx, session) => {
  await requirePermission(session, AdministracionPermission.FICHA_PAGO);
  const body = await req.json().catch(() => ({}));
  if (CAMPOS_COMPENSACION.some((c) => c in body)) {
    await requirePermission(session, AdministracionPermission.VER_COMPENSACION);
  }
  await guardarFichaPago(ctx.params.id, body, (session?.user as any)?.email || 'desconocido');
  return successResponse({ id: ctx.params.id });
});
