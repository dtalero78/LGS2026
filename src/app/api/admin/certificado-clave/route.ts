import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { certificadoClaveActiva, setCertificadoClaveActiva } from '@/services/certificado.service';

/**
 * GET/PATCH /api/admin/certificado-clave — interruptor de la clave del PDF del certificado
 * (APP_CONFIG `certificado_clave_activo`, default apagado = el PDF sale SIN clave).
 *   GET   → { active }. Cualquier usuario staff.
 *   PATCH → body { active: boolean }. Requiere MANTENIMIENTO.CONTRATOS.BLOQUEO_CERT_MORA.
 * El cambio aplica en ≤1 minuto (cache del flag).
 */
export const GET = handlerWithStaffAuth(async () => {
  return successResponse({ active: await certificadoClaveActiva() });
});

export const PATCH = handlerWithStaffAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.BLOQUEO_CERT_MORA);
  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== 'boolean') throw new ValidationError('active debe ser booleano');
  await setCertificadoClaveActiva(body.active, (session.user as any)?.email || 'admin');
  return successResponse({ active: body.active });
});
