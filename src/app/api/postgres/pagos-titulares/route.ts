/**
 * API: /api/postgres/pagos-titulares
 *
 * GET ?idPeople=...  → lista pagos del titular
 * POST { idPeople, ... } → crea un pago nuevo
 */

import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { pagosTitularesService } from '@/services/pagos-titulares.service';

export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, PersonPermission.PAGOS_VER);

  const { searchParams } = new URL(req.url);
  const idPeople = searchParams.get('idPeople');
  if (!idPeople) throw new ValidationError('idPeople requerido');

  const pagos = await pagosTitularesService.listByPerson(idPeople);
  return successResponse({ pagos, total: pagos.length });
});

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, PersonPermission.PAGOS_REGISTRAR);

  const body = await req.json();
  const createdBy = (session.user as any)?.email || 'unknown';

  // El Pago doble se retiró (nov-2026): un pago que alcanza para dos cuotas se
  // registra una sola vez y desborda solo a la siguiente (src/lib/cuotas-pagos.ts).
  if (body?.pagoDoble === true) {
    throw new ValidationError('El Pago doble ya no existe: registre un solo pago por el valor total; cubre las cuotas siguientes automáticamente.');
  }

  const pago = await pagosTitularesService.create(body, createdBy);
  return successResponse({ pago }, 201);
});
