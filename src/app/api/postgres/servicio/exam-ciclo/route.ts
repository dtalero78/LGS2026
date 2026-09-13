import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { listCiclos, saveCiclo } from '@/services/exam-ciclo.service';

/**
 * GET  /api/postgres/servicio/exam-ciclo  → lista los ciclos de examen.
 * POST /api/postgres/servicio/exam-ciclo  → crea o edita un ciclo (config).
 */
export const GET = handlerWithAuth(async (_req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_VER);
  const ciclos = await listCiclos();
  return successResponse({ ciclos });
});

export const POST = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_GENERAR);
  const body = await req.json();
  const ciclo = await saveCiclo(body, (session?.user?.email as string) || 'desconocido');
  return successResponse({ ciclo });
});
