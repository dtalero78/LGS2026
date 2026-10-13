import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission, hasPermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { guardarReciboEnFinanciero, guardarReciboInscripcionEnPeople, isLeerReciboActivo } from '@/services/recibo-extract.service';

/**
 * POST /api/postgres/recaudos/inscripcion-recibo/guardar
 * Body: { contrato, idPeople?, url, campos: {medioPago,fecha,monto,referencia,banco,confianza} }
 *       Dos recibos: + { dosRecibos: true, recibos: [{url,nombre,tipo,montoLeido},{...}], montoManual }
 * Guarda los datos confirmados por el operador en FINANCIEROS (columnas recibo*)
 * y, si hay archivo, también como recibo de inscripción del contrato
 * (PEOPLE."reciboInscripcion" del titular) — así se ve en la columna "Recibo insc.".
 * Gate: PAGOS_VALIDAR + permiso LEER_RECIBO (o flag; SUPER_ADMIN/ADMIN bypass).
 */
export const POST = handlerWithAuth(async (req: NextRequest, _ctx, session) => {
  await requirePermission(session, PersonPermission.PAGOS_VALIDAR);
  const allowed = (await hasPermission(session, PersonPermission.LEER_RECIBO)) || (await isLeerReciboActivo());
  if (!allowed) {
    throw new ForbiddenError('La lectura de recibos no está habilitada.');
  }
  const body = await req.json();
  const contrato = String(body?.contrato || '').trim();
  if (!contrato) throw new ValidationError('contrato es requerido.');
  const actor = (session?.user?.email as string) || 'desconocido';
  const campos = body?.campos || {};
  const dosRecibos = body?.dosRecibos === true;
  const url = String(body?.url || '').trim() || null;

  // Sin archivo: solo los datos en FINANCIEROS (comportamiento original).
  if (!url && !dosRecibos) {
    await guardarReciboEnFinanciero({ contrato, url: null, campos, actor });
    return successResponse({ ok: true, message: 'Datos del recibo guardados en el financiero.' });
  }

  // Titular del contrato (el de la fila, si se envió y pertenece a este contrato).
  const titular = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "PEOPLE"
      WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
      ORDER BY ("_id" = $2) DESC, "_createdDate" LIMIT 1`,
    [contrato, String(body?.idPeople || '')],
  );
  if (!titular) throw new NotFoundError('Titular', `contrato ${contrato}`);

  const archivos = dosRecibos ? (Array.isArray(body?.recibos) ? body.recibos : []) : [];
  if (dosRecibos && (archivos.length !== 2 || archivos.some((r: any) => !String(r?.url || '').trim()))) {
    throw new ValidationError('Adjunta el recibo 1 y el recibo 2.');
  }
  const recibos = archivos.map((r: any) => ({
    url: String(r.url).trim(), nombre: r?.nombre ?? null, tipo: r?.tipo ?? null,
    extraido: r?.montoLeido != null ? { monto: Number(r.montoLeido) } : null,
  }));

  await guardarReciboInscripcionEnPeople({
    peopleId: titular._id,
    contrato,
    url: dosRecibos ? recibos[0].url : url,
    nombre: dosRecibos ? recibos[0].nombre : (body?.nombre ?? null),
    tipo: dosRecibos ? recibos[0].tipo : (body?.tipo ?? null),
    campos,
    actor,
    ...(dosRecibos ? { dosRecibos: true, recibos, montoManual: Number(body?.montoManual) } : {}),
  });
  return successResponse({
    ok: true,
    message: dosRecibos ? 'Recibos de inscripción guardados.' : 'Datos del recibo guardados en el financiero.',
  });
});
