import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { aplicarReconciliacion } from '@/services/usuarios-pegados.service';

/**
 * POST /api/admin/scripts/usuarios-pegados/aplicar
 *
 * Body: { academicaIds: string[], motivo: string }
 *
 * Para cada estudiante: recalcula stepReal server-side, llama a changeStep
 * si todavía está pegado, escribe auditoría. Procesa en grupos paralelos
 * de 5 (no agota el pool de PostgreSQL).
 *
 * `realizadoPor` se toma de la sesión NextAuth, no del body (no spoofeable).
 *
 * Acceso: SUPER_ADMIN y ADMIN.
 */
export const POST = handlerWithAuth(async (req, _ctx, session) => {
  const role = (session.user as any)?.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN/ADMIN puede reconciliar usuarios pegados');
  }

  const body = await req.json().catch(() => ({}));
  const { academicaIds, motivo } = body as { academicaIds?: string[]; motivo?: string };

  if (!Array.isArray(academicaIds) || academicaIds.length === 0) {
    throw new ValidationError('academicaIds (array no vacío) es requerido');
  }
  if (typeof motivo !== 'string' || !motivo.trim()) {
    throw new ValidationError('motivo (texto) es obligatorio');
  }

  const realizadoPor = (session.user as any)?.email || 'unknown';
  const realizadoPorNombre = (session.user as any)?.name || undefined;

  const results = await aplicarReconciliacion({
    academicaIds,
    motivo,
    realizadoPor,
    realizadoPorNombre,
  });

  const summary = {
    total:           results.length,
    ok:              results.filter(r => r.status === 'ok').length,
    alreadySynced:   results.filter(r => r.status === 'already_synced').length,
    blocked:         results.filter(r => r.status === 'blocked_by_override').length,
    noChangeNeeded:  results.filter(r => r.status === 'no_change_needed').length,
    errors:          results.filter(r => r.status === 'error').length,
  };

  return successResponse({ summary, results });
});
