import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ComercialPermission, Role } from '@/types/permissions';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { esContratoPrueba } from '@/lib/contrato-prueba-guard';
import { extraerReciboDesdeUrl, isLeerReciboActivo, guardarReciboInscripcionEnPeople } from '@/services/recibo-extract.service';

/**
 * Recibo de inscripción del proceso de contrato.
 *
 *   GET  /api/contracts/[id]/recibo-inscripcion  → { active, recibo, pagoInscripcion }
 *   POST /api/contracts/[id]/recibo-inscripcion  → sube+lee+guarda el recibo
 *        Body: { url, nombre?, tipo? }  (el archivo se sube antes por upload-url)
 *        Dos recibos: { dosRecibos: true, recibos: [{url,nombre,tipo},{...}], montoManual }
 *        → lee cada recibo con IA y guarda los dos + el monto TOTAL digitado.
 *
 * El recibo se guarda en PEOPLE."reciboInscripcion" (INDEPENDIENTE de la
 * documentación) y los datos leídos por IA se reflejan en FINANCIEROS.recibo*.
 * Gate: COMERCIAL.CONTRATO.SUBIR_RECIBO + flag leer_recibo_activo (SUPER_ADMIN/
 * ADMIN bypass). Bloqueado en contratos de prueba (PRB-).
 */

/** Monto guardado como texto (legacy): "110000", "110000.00" o "110.000" (punto de miles). */
function montoTexto(v: string | null): number | null {
  let s = String(v ?? '').trim().replace(/[^0-9.,]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isAdminRole(session: any): boolean {
  const role = (session?.user?.role ?? '') as string;
  return role === Role.SUPER_ADMIN || role === Role.ADMIN || role === 'admin';
}

export const GET = handlerWithAuth(async (_req: NextRequest, { params }, session) => {
  await requirePermission(session, ComercialPermission.SUBIR_RECIBO_INSCRIPCION);
  const row = await queryOne<{ reciboInscripcion: any; pagoInscripcion: string | null }>(
    `SELECT p."reciboInscripcion", f."pagoInscripcion"
       FROM "PEOPLE" p LEFT JOIN "FINANCIEROS" f ON f."contrato" = p."contrato"
      WHERE p."_id" = $1 LIMIT 1`, [params.id]
  );
  if (!row) throw new NotFoundError('Titular', params.id);
  const active = (await isLeerReciboActivo()) || isAdminRole(session);
  // Valor de inscripción del contrato: con dos recibos se compara con el monto digitado (solo aviso).
  const pagoInscripcion = montoTexto(row.pagoInscripcion);
  return successResponse({ active, recibo: row.reciboInscripcion || null, pagoInscripcion });
});

export const POST = handlerWithAuth(async (req: NextRequest, { params }, session) => {
  await requirePermission(session, ComercialPermission.SUBIR_RECIBO_INSCRIPCION);

  const titular = await queryOne<{ _id: string; contrato: string | null }>(
    `SELECT "_id", "contrato" FROM "PEOPLE" WHERE "_id" = $1`, [params.id]
  );
  if (!titular) throw new NotFoundError('Titular', params.id);
  if (esContratoPrueba(titular.contrato)) {
    throw new ForbiddenError('Contrato de prueba (PRB-): no se puede subir recibo de inscripción.');
  }
  if (!(await isLeerReciboActivo()) && !isAdminRole(session)) {
    throw new ForbiddenError('La lectura de recibos no está habilitada.');
  }

  const body = await req.json();
  const actor = (session?.user?.email as string) || 'desconocido';

  // Dos recibos: se lee cada uno (un fallo de lectura no impide guardar) y el
  // monto del pago es el digitado.
  if (body?.dosRecibos === true) {
    const archivos = Array.isArray(body?.recibos) ? body.recibos : [];
    if (archivos.length !== 2 || archivos.some((r: any) => !String(r?.url || '').trim())) {
      throw new ValidationError('Adjunta el recibo 1 y el recibo 2.');
    }
    const extraidos = await Promise.all(
      archivos.map((r: any) => extraerReciboDesdeUrl(String(r.url).trim()).catch(() => null)),
    );
    const recibos = archivos.map((r: any, i: number) => ({
      url: String(r.url).trim(), nombre: r?.nombre ?? null, tipo: r?.tipo ?? null, extraido: extraidos[i],
    }));
    const recibo = await guardarReciboInscripcionEnPeople({
      peopleId: titular._id,
      contrato: titular.contrato,
      url: recibos[0].url,
      nombre: recibos[0].nombre,
      tipo: recibos[0].tipo,
      campos: extraidos[0] || {},
      actor,
      dosRecibos: true,
      recibos,
      montoManual: Number(body?.montoManual),
    });
    return successResponse({ recibo, message: 'Recibos de inscripción guardados.' });
  }

  const url = String(body?.url || '').trim();
  if (!url) throw new ValidationError('url del recibo es requerida.');

  const extraido = await extraerReciboDesdeUrl(url);
  const recibo = await guardarReciboInscripcionEnPeople({
    peopleId: titular._id,
    contrato: titular.contrato,
    url,
    nombre: body?.nombre ?? null,
    tipo: body?.tipo ?? null,
    campos: extraido,
    actor,
  });
  return successResponse({ recibo, extraido, message: 'Recibo de inscripción leído y guardado.' });
});
