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
 *   GET  /api/contracts/[id]/recibo-inscripcion  → { active, recibo }
 *   POST /api/contracts/[id]/recibo-inscripcion  → sube+lee+guarda el recibo
 *        Body: { url, nombre?, tipo? }  (el archivo se sube antes por upload-url)
 *
 * El recibo se guarda en PEOPLE."reciboInscripcion" (INDEPENDIENTE de la
 * documentación) y los datos leídos por IA se reflejan en FINANCIEROS.recibo*.
 * Gate: COMERCIAL.CONTRATO.SUBIR_RECIBO + flag leer_recibo_activo (SUPER_ADMIN/
 * ADMIN bypass). Bloqueado en contratos de prueba (PRB-).
 */

function isAdminRole(session: any): boolean {
  const role = (session?.user?.role ?? '') as string;
  return role === Role.SUPER_ADMIN || role === Role.ADMIN || role === 'admin';
}

export const GET = handlerWithAuth(async (_req: NextRequest, { params }, session) => {
  await requirePermission(session, ComercialPermission.SUBIR_RECIBO_INSCRIPCION);
  const row = await queryOne<{ reciboInscripcion: any }>(
    `SELECT "reciboInscripcion" FROM "PEOPLE" WHERE "_id" = $1`, [params.id]
  );
  if (!row) throw new NotFoundError('Titular', params.id);
  const active = (await isLeerReciboActivo()) || isAdminRole(session);
  return successResponse({ active, recibo: row.reciboInscripcion || null });
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
    actor: (session?.user?.email as string) || 'desconocido',
  });
  return successResponse({ recibo, extraido, message: 'Recibo de inscripción leído y guardado.' });
});
