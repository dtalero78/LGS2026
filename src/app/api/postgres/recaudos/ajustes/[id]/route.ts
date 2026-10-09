/**
 * PATCH /api/postgres/recaudos/ajustes/[id]
 *   body { tipo: 'INSCRIPCION'|'PAGO'|'FACTURA', cambios: {...}, motivo }
 *
 * Ajusta un registro YA validado, recalcula los saldos del titular y lo audita
 * en PAGOS_AJUSTES (ver pagos-ajustes.service). Permiso de la subpestaña.
 */
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ValidationError } from '@/lib/errors';
import { pagosAjustesService, TIPOS_AJUSTE, type TipoAjuste } from '@/services/pagos-ajustes.service';
import { permisoAjuste, sessionInfo } from '../permisos';

export const PATCH = handlerWithStaffAuth(async (req, { params }, session) => {
  const body = await req.json().catch(() => ({}));
  const tipo = String(body?.tipo || '').toUpperCase() as TipoAjuste;
  if (!TIPOS_AJUSTE.includes(tipo)) throw new ValidationError('tipo debe ser INSCRIPCION, PAGO o FACTURA');
  await requirePermission(session, permisoAjuste(tipo));

  const resultado = await pagosAjustesService.ajustar(
    sessionInfo(session), params.id, tipo, body?.cambios || {}, String(body?.motivo || ''));
  return successResponse(resultado);
});
