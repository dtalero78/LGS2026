import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { kidsIntake } from '@/lib/kids-intake';

/**
 * GET /api/postgres/kids-intake/availability
 *
 * Proxy server-side del catálogo de KIDS2026 para el modal Kids del wizard
 * (la API-key vive solo en el servidor). Devuelve la cascada Campaña→Curso→Salón.
 * Si la integración no está configurada (faltan env vars), responde
 * { configured: false, campanias: [] } y el modal cae al modo placeholder.
 * Cualquier usuario autenticado puede leerlo.
 */
export const GET = handlerWithAuth(async () => {
  if (!kidsIntake.isConfigured()) {
    return successResponse({ configured: false, campanias: [] });
  }
  const data = await kidsIntake.availability();
  return successResponse({ configured: true, campanias: data.campanias });
});
