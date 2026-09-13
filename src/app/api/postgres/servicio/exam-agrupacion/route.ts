import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ServicioPermission } from '@/types/permissions';
import { listAgrupacion } from '@/services/exam-ciclo.service';

/**
 * GET /api/postgres/servicio/exam-agrupacion?search=
 *
 * Lista los estudiantes CONFIRMADOS para examen internacional (EXAM_INTERN_AUDIT
 * accion='EXTENDIDO'), con la columna de programas (colisión si tiene >1).
 */
export const GET = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, ServicioPermission.EXAM_INTERN_SETUP_VER);
  const { searchParams } = new URL(req.url);
  const estudiantes = await listAgrupacion({ search: searchParams.get('search') });
  return successResponse({ estudiantes });
});
