import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { whatsappConfigService } from '@/services/whatsapp-config.service';

/**
 * Contingencia de canales de WhatsApp (Mantenimiento › Contingencia).
 *   GET   → estado en vivo de los 2 canales (Whapi /health) + el canal de cada tipo.
 *   PATCH → cambia el canal de UN tipo de mensaje. body: { tipo, canal: 'A' | 'B' }.
 * No expone los tokens al cliente.
 */
export const GET = handlerWithAuth(async (_request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CONTINGENCIA_WHATSAPP);
  const estado = await whatsappConfigService.getEstado();
  return successResponse(estado);
});

export const PATCH = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CONTINGENCIA_WHATSAPP);
  const body = await request.json().catch(() => ({}));
  const actor = (session?.user as any)?.email || 'admin';
  const mapa = await whatsappConfigService.setCanalDeTipo(String(body?.tipo ?? ''), String(body?.canal ?? ''), actor);
  return successResponse({ mapa });
});
