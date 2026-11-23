import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { exigirClaveKids } from '@/lib/kids-sync-server';
import { whatsappConfigService } from '@/services/whatsapp-config.service';

/**
 * GET /api/kids-sync/whatsapp — KIDS2026 pregunta por cuál línea de WhatsApp debe
 * enviar. Es el tipo 'kids' de Mantenimiento › Contingencia: si un número se cae,
 * se cambia allá y KIDS lo sigue en ≤1 minuto, sin desplegar nada.
 *
 * Responde el canal, su estado en vivo (conectado / "AUTH" / "QR"...) y el token
 * para enviar. Autenticación de servicio: ver src/lib/kids-sync-server.ts.
 */
export const GET = handler(async (request) => {
  exigirClaveKids(request);
  return successResponse(await whatsappConfigService.getCanalKids());
});
