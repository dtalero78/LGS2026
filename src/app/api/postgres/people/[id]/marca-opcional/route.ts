import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';

/**
 * POST /api/postgres/people/[id]/marca-opcional
 *
 * Marca "Opcional" del titular (columna "Opcional" de
 * /dashboard/recaudos/asignacion). Puede ser DEFINITIVA o TEMPORAL.
 *
 * Body:
 *   { valor: 'OPC' | null, hasta?: 'YYYY-MM-DD' }
 *     - `hasta` ausente/null → marca DEFINITIVA (se queda hasta que la quiten).
 *     - `hasta` con fecha    → marca TEMPORAL: al día siguiente de esa fecha
 *       vuelve sola al valor que tenía antes (guardado en marcaOpcionalAnterior).
 *   Sin `valor` hace toggle (compatibilidad con el flujo anterior).
 *
 * La reversión de las temporales ocurre por DOS vías, igual que OnHold:
 *   1. cron diario  → /api/cron/revertir-marca-opcional limpia las vencidas.
 *   2. al consultar → la vista de asignación ya ignora las vencidas, así que la
 *      pantalla es correcta aunque el cron todavía no haya corrido.
 *
 * Gate: `PERSON.FINANCIERA.MARCAR_OPCIONAL` (SUPER_ADMIN / ADMIN bypass).
 */
export const POST = handlerWithAuth(async (request, { params }, session) => {
  await requirePermission(session, PersonPermission.MARCAR_OPCIONAL);

  const body = await request.json().catch(() => ({}));
  const existing = await queryOne<{ marcaOpcional: string | null }>(
    `SELECT "marcaOpcional" FROM "PEOPLE" WHERE "_id" = $1`,
    [params.id],
  );
  if (!existing) throw new NotFoundError('PEOPLE', params.id);

  // Valor destino: explícito si viene, si no toggle (comportamiento anterior).
  let nuevoValor: string | null;
  if (body && Object.prototype.hasOwnProperty.call(body, 'valor')) {
    const v = typeof body.valor === 'string' ? body.valor.trim().toUpperCase() : null;
    nuevoValor = v === 'OPC' ? 'OPC' : null;
  } else {
    nuevoValor = existing.marcaOpcional === 'OPC' ? null : 'OPC';
  }

  // ── Vigencia ──
  // Solo tiene sentido poner fecha al MARCAR: al quitar la marca se limpia todo.
  let hasta: string | null = null;
  if (nuevoValor === 'OPC' && body?.hasta) {
    const raw = String(body.hasta).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new ValidationError('La fecha debe tener formato AAAA-MM-DD');
    }
    // Comparación por día calendario en UTC: la zona del navegador no debe
    // correr el resultado (mismo criterio que el resto de fechas del sistema).
    const hoy = new Date().toISOString().slice(0, 10);
    if (raw < hoy) {
      throw new ValidationError('La fecha de vencimiento no puede estar en el pasado');
    }
    hasta = raw;
  }

  // `marcaOpcionalAnterior` guarda a qué estado volver. Solo se registra en las
  // temporales; en las definitivas queda NULL junto con la fecha.
  const anterior = hasta ? (existing.marcaOpcional ?? null) : null;

  await queryOne(
    `UPDATE "PEOPLE"
        SET "marcaOpcional" = $1,
            "marcaOpcionalHasta" = $2,
            "marcaOpcionalAnterior" = $3,
            "_updatedDate" = NOW()
      WHERE "_id" = $4
      RETURNING "_id"`,
    [nuevoValor, hasta, anterior, params.id],
  );

  return successResponse({
    marcaOpcional: nuevoValor,
    marcaOpcionalHasta: hasta,
    temporal: !!hasta,
  });
});
