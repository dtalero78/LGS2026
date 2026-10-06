import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { RecaudosPermission } from '@/types/permissions';
import { moraService } from '@/services/mora.service';

/**
 * GET /api/postgres/recaudos/usuarios-mora
 *
 * Titulares APROBADOS cuyo contrato está en mora (cuotas vencidas sin registrar,
 * misma regla de la pestaña Financiera — src/lib/mora.ts), con su desbloqueo
 * manual del certificado si existe. Incluye el estado del interruptor de bloqueo.
 * Gateado por RECAUDOS.USUARIOS_MORA.VER.
 */
export const GET = handlerWithStaffAuth(async (_req, _ctx, session) => {
  await requirePermission(session, RecaudosPermission.USUARIOS_MORA_VER);
  const [usuarios, bloqueoActivo] = await Promise.all([moraService.listarEnMora(), moraService.isBloqueoActivo()]);
  return successResponse({ usuarios, count: usuarios.length, bloqueoActivo });
});
