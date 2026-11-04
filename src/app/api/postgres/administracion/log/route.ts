import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ValidationError } from '@/lib/errors';
import { AdministracionPermission } from '@/types/permissions';
import { logDeAdvisor } from '@/services/liq-flujo.service';

/** GET /api/postgres/administracion/log?advisorId=&periodo= → historial de la liquidación del advisor. Gate: VER. */
export const GET = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, AdministracionPermission.GESTION_ADVISORS_VER);
  const sp = new URL(req.url).searchParams;
  const advisorId = sp.get('advisorId');
  if (!advisorId) throw new ValidationError('Falta advisorId.');
  return successResponse({ log: await logDeAdvisor(advisorId, sp.get('periodo') || new Date().toISOString().slice(0, 7)) });
});
