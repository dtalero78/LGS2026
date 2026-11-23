import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { beneficiarioKidsDeRef, exigirClaveKids } from '@/lib/kids-sync-server';
import { toggleStatus } from '@/services/student.service';
import { registrarEventoContrato } from '@/lib/contrato-eventos';

/**
 * POST /api/kids-sync/estado — camino de VUELTA desde KIDS2026.
 *
 * Inactivar o reactivar (botones Inactivar / Activar de la ficha del contrato en
 * KIDS) a un niño que viene de LGS: aquí queda igual que con el botón Inactivar de
 * LGS (estadoInactivo, suspenddata, clases futuras canceladas, ACADEMICA y login),
 * pero SIN avisar de vuelta a KIDS (desdeKids: sin eco). Idempotente: si ya estaba
 * en ese estado responde aplicado: false.
 *
 * Autenticación de servicio: ver src/lib/kids-sync-server.ts.
 *
 * Body: { externalRef, accion: 'inactivar' | 'reactivar', motivo, ejecutadoPor? }
 */
export const POST = handler(async (request) => {
  exigirClaveKids(request);
  const body = await request.json().catch(() => ({}));
  const externalRef = String(body?.externalRef || '').trim();
  if (!externalRef) throw new ValidationError('externalRef es obligatorio');
  if (body.accion !== 'inactivar' && body.accion !== 'reactivar') {
    throw new ValidationError("accion debe ser 'inactivar' o 'reactivar'");
  }
  const active = body.accion === 'reactivar';
  const motivo = `KIDS: ${String(body.motivo || 'sin motivo').trim()}`.slice(0, 500);
  const actor = `KIDS: ${String(body.ejecutadoPor || 'coordinación').slice(0, 100)}`;

  const personId = await beneficiarioKidsDeRef(externalRef);
  const person = await queryOne<{ estadoInactivo: boolean | null }>(
    `SELECT "estadoInactivo" FROM "PEOPLE" WHERE "_id" = $1`,
    [personId],
  );
  if ((person?.estadoInactivo === true) === !active) {
    return successResponse({ aplicado: false, mensaje: active ? 'Ya estaba activo en LGS' : 'Ya estaba inactivo en LGS' });
  }

  const r = await toggleStatus(personId, active, { motivo, realizadoPor: actor, desdeKids: true });
  if (r.statusChanged) {
    await registrarEventoContrato({
      personaId: personId, categoria: 'VIGENCIA', accion: active ? 'Reactivado' : 'Inactivado',
      detalle: motivo, actor,
    });
  }
  console.log(`[kids-sync/estado] ${body.accion} desde KIDS en ${personId} (${externalRef})`);
  return successResponse({ aplicado: r.statusChanged === true });
});
