import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { bienvenidaConfigService } from '@/services/bienvenida-config.service';

/**
 * GET /api/public/bienvenida-activa — PÚBLICO (sin sesión).
 * Lo consulta la página del contrato (`/contrato/[id]`), que la abre el cliente
 * sin estar logueado, para saber si al firmar debe ir a `/bienvenida/[id]`
 * o mantener la redirección anterior a letsgospeak.cl.
 * Solo expone un booleano de configuración de UI; no hay dato sensible.
 */
// Lee el flag en cada request: no debe quedar cacheado en build ni en CDN.
export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  return successResponse({ active: await bienvenidaConfigService.isActive() });
});
