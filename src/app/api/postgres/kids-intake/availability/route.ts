import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { kidsIntake } from '@/lib/kids-intake';

/**
 * GET /api/postgres/kids-intake/availability
 *
 * Proxy server-side del catálogo de KIDS2026 para el modal Kids del wizard
 * (la API-key vive solo en el servidor). Devuelve la cascada Campaña→Curso→Salón.
 *   - Sin integración (faltan env vars) → { configured: false, campanias: [] }
 *     y el modal cae al modo de captura provisional.
 *   - Integración configurada pero KIDS falla (clave inválida, caída, timeout) →
 *     { configured: true, error, campanias: [] }. Antes se lanzaba la excepción y
 *     el modal lo confundía con "no configurado", dejando guardar un kid sin salón
 *     que luego nunca se enviaba a KIDS.
 * Cualquier usuario autenticado puede leerlo.
 */
export const GET = handlerWithAuth(async () => {
  if (!kidsIntake.isConfigured()) {
    return successResponse({ configured: false, campanias: [] });
  }
  try {
    const data = await kidsIntake.availability();
    return successResponse({ configured: true, campanias: data.campanias || [] });
  } catch (e: any) {
    console.error('[kids-intake/availability] KIDS2026 falló:', e?.status, e?.message);
    return successResponse({
      configured: true,
      campanias: [],
      error: e?.status === 401
        ? 'La clave de servicio de KIDS2026 no es válida (revisar KIDS_INTAKE_API_KEY).'
        : `No se pudo consultar el catálogo de KIDS2026: ${e?.message || 'error desconocido'}`,
    });
  }
});
