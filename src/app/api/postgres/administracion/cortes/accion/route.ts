import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ValidationError } from '@/lib/errors';
import { AdministracionPermission } from '@/types/permissions';
import {
  agregarAjuste, marcarHorasOk, devolverFactura, verificar, registrarPago, reabrir, type Actor,
} from '@/services/liq-flujo.service';

/**
 * POST /api/postgres/administracion/cortes/accion
 * Body: { accion, advisorId, programa: 'LGS'|'KIDS', periodo: 'YYYY-MM', corte: 'MES'|'Q1'|'Q2', ...datos }
 *   AJUSTE    (AJUSTAR)          { alcance, semanaInicio?, concepto, horas, motivo }
 *   HORAS_OK  (HORAS_OK)         { ok: boolean }
 *   DEVOLVER  (FACTURA_DEVOLVER) { comentario }
 *   VERIFICAR (VERIFICAR)
 *   PAGAR     (REGISTRAR_PAGO)   { fecha, referencia }
 *   REABRIR   (solo SUPER_ADMIN) { motivo }
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, _ctx, session) => {
  const b = await req.json().catch(() => ({}));
  const u = (session?.user as any) || {};
  const actor: Actor = { email: u.email || 'desconocido', nombre: u.name || null, rol: u.role || '' };
  const base = { advisorId: String(b.advisorId || ''), programa: b.programa === 'KIDS' ? 'KIDS' as const : 'LGS' as const, periodo: String(b.periodo || ''), corte: b.corte };
  if (!base.advisorId) throw new ValidationError('Falta el advisor.');
  switch (b.accion) {
    case 'AJUSTE':
      await requirePermission(session, AdministracionPermission.AJUSTAR);
      return successResponse({ id: await agregarAjuste({ ...base, alcance: b.alcance, semanaInicio: b.semanaInicio, concepto: b.concepto, horas: b.horas, motivo: b.motivo }, actor) });
    case 'HORAS_OK':
      await requirePermission(session, AdministracionPermission.HORAS_OK);
      await marcarHorasOk({ ...base, ok: b.ok !== false }, actor);
      break;
    case 'DEVOLVER':
      await requirePermission(session, AdministracionPermission.FACTURA_DEVOLVER);
      await devolverFactura({ ...base, comentario: b.comentario }, actor);
      break;
    case 'VERIFICAR':
      await requirePermission(session, AdministracionPermission.VERIFICAR);
      await verificar(base, actor);
      break;
    case 'PAGAR':
      await requirePermission(session, AdministracionPermission.REGISTRAR_PAGO);
      await registrarPago({ ...base, fecha: b.fecha, referencia: b.referencia }, actor);
      break;
    case 'REABRIR':
      await reabrir({ ...base, motivo: b.motivo }, actor); // valida SUPER_ADMIN dentro
      break;
    default:
      throw new ValidationError('Acción desconocida.');
  }
  return successResponse({ ok: true });
});
