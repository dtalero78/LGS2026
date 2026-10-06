import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ComercialPermission } from '@/types/permissions';
import { kidsIntake } from '@/lib/kids-intake';

/**
 * GET /api/postgres/kids-intake/cursos
 *
 * Consulta "Comercial › Cursos Kids": campañas de KIDS2026 en matrícula con sus
 * cursos y salones, INCLUIDOS los llenos (`lleno: true`, para mostrarlos en rojo).
 * Solo lectura. Si KIDS falla responde { configured: true, error } en vez de lanzar.
 * Gateado por COMERCIAL.CURSOS_KIDS.VER.
 */
export const GET = handlerWithStaffAuth(async (_req, _ctx, session) => {
  await requirePermission(session, ComercialPermission.CURSOS_KIDS_VER);
  if (!kidsIntake.isConfigured()) {
    return successResponse({ configured: false, campanias: [] });
  }
  try {
    const data = await kidsIntake.availability({ incluirLlenos: true });
    return successResponse({ configured: true, campanias: data.campanias || [], consultado: new Date().toISOString() });
  } catch (e: any) {
    console.error('[kids-intake/cursos] KIDS2026 falló:', e?.status, e?.message);
    return successResponse({
      configured: true,
      campanias: [],
      error: e?.status === 401
        ? 'La clave de servicio de KIDS2026 no es válida (revisar KIDS_INTAKE_API_KEY).'
        : `No se pudo consultar KIDS2026: ${e?.message || 'error desconocido'}`,
    });
  }
});
