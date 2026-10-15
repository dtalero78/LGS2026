import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { beneficiarioKidsDeRef, exigirClaveKids } from '@/lib/kids-sync-server';
import { activateOnHold, deactivateOnHold } from '@/services/contract.service';

/**
 * POST /api/kids-sync/onhold — camino de VUELTA desde KIDS2026.
 *
 * Cuando en KIDS se abre o se cierra un OnHold de un niño que viene de LGS,
 * KIDS llama aquí para que el beneficiario quede igual en LGS (PEOPLE:
 * estadoInactivo, estado 'On Hold', fechaOnHold/fechaFinOnHold, onHoldCount,
 * onHoldHistory; al cerrar: finalContrato extendido con los MISMOS días y
 * sincronización del titular). Se aplica con origen 'KIDS', así LGS no vuelve a
 * avisar a KIDS (sin eco). Las reglas de LGS (máx. 2 OnHold, sin extensión
 * manual previa) se validan aquí: si se rompen, 400 y KIDS no pausa.
 *
 * Autenticación de servicio: ver src/lib/kids-sync-server.ts.
 *
 * Body:
 *   { accion: 'activar', externalRef, desde, hasta, motivo, activadoPor }
 *   { accion: 'reactivar', externalRef, dias }
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const POST = handler(async (request) => {
  exigirClaveKids(request);
  const body = await request.json().catch(() => ({}));
  const externalRef = String(body?.externalRef || '').trim();
  if (!externalRef) throw new ValidationError('externalRef es obligatorio');

  const personId = await beneficiarioKidsDeRef(externalRef);
  const person = await queryOne<{ estadoInactivo: boolean | null; fechaOnHold: any }>(
    `SELECT "estadoInactivo", "fechaOnHold" FROM "PEOPLE" WHERE "_id" = $1`,
    [personId],
  );
  const enOnHold = person?.estadoInactivo === true && !!person?.fechaOnHold;

  if (body.accion === 'activar') {
    const desde = String(body.desde || '');
    const hasta = String(body.hasta || '');
    if (!ISO.test(desde) || !ISO.test(hasta)) throw new ValidationError('desde y hasta (YYYY-MM-DD) son obligatorios');
    if (enOnHold) return successResponse({ aplicado: false, mensaje: 'Ya estaba en OnHold en LGS' });
    await activateOnHold({
      studentId: personId,
      fechaOnHold: desde,
      fechaFinOnHold: hasta,
      motivo: String(body.motivo || '').slice(0, 500),
      activadoPor: `KIDS: ${String(body.activadoPor || 'coordinación').slice(0, 100)}`,
      origen: 'KIDS',
    });
    console.log(`[kids-sync/onhold] OnHold desde KIDS aplicado a ${personId} (${externalRef}) ${desde} → ${hasta}`);
    return successResponse({ aplicado: true });
  }

  if (body.accion === 'reactivar') {
    const dias = Number(body.dias);
    if (!Number.isFinite(dias) || dias < 0) throw new ValidationError('dias debe ser un número ≥ 0');
    if (!enOnHold) return successResponse({ aplicado: false, mensaje: 'No estaba en OnHold en LGS' });
    const r = await deactivateOnHold(personId, { dias, origen: 'KIDS' });
    console.log(`[kids-sync/onhold] Fin de OnHold desde KIDS en ${personId} (${externalRef}): +${r.extension.daysPaused} días`);
    return successResponse({ aplicado: true, nuevoFinal: r.extension.newFinalContrato });
  }

  throw new ValidationError("accion debe ser 'activar' o 'reactivar'");
});
