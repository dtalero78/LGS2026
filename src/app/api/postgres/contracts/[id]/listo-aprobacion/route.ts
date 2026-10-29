import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ComercialPermission } from '@/types/permissions';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';

const CONFIRMACIONES = ['firmado', 'pdf', 'documentos', 'informacion'] as const;

/**
 * POST /api/postgres/contracts/[id]/listo-aprobacion
 *   Body: { firmado: true, pdf: true, documentos: true, informacion: true }
 * "Dejar listo para aprobación": el ejecutivo confirma que el contrato ya está
 * firmado, con PDF generado, documentos y recibo de inscripción subidos e
 * información verificada. Marca PEOPLE.listoAprobacion en el TITULAR (con quién y
 * cuándo); el Libro de Producción lo muestra como "Firma, Documentos, pendiente
 * aprobación". La firma se verifica en el servidor (hashConsentimiento).
 * Gate: staff + COMERCIAL.CONTRATO.DEJAR_LISTO.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, ctx, session) => {
  await requirePermission(session, ComercialPermission.DEJAR_LISTO_APROBACION);
  const body = await req.json().catch(() => ({}));
  if (!CONFIRMACIONES.every((k) => body?.[k] === true)) {
    throw new ValidationError('Confirma los cuatro puntos antes de dejar el contrato listo para aprobación');
  }

  const titular = await queryOne<any>(
    `SELECT "_id", "tipoUsuario", "contrato", "aprobacion", "hashConsentimiento", "listoAprobacion"
       FROM "PEOPLE" WHERE "_id" = $1`, [ctx.params.id]);
  if (!titular || titular.tipoUsuario !== 'TITULAR') throw new NotFoundError('Titular', ctx.params.id);
  if (!String(titular.hashConsentimiento || '').trim()) {
    throw new ValidationError('El contrato aún no está firmado: envíelo para firma (o ratifíquelo) antes de dejarlo listo');
  }
  const estado = String(titular.aprobacion || '').trim().toLowerCase();
  if (estado && estado !== 'pendiente') {
    throw new ValidationError(`El contrato ya está en estado "${titular.aprobacion}"`);
  }
  if (titular.listoAprobacion === true) throw new ValidationError('El contrato ya estaba listo para aprobación');

  const actor = (session?.user as any)?.email || 'desconocido';
  const row = await queryOne<any>(
    `UPDATE "PEOPLE"
        SET "listoAprobacion" = true, "listoAprobacionPor" = $2, "listoAprobacionEn" = NOW(), "_updatedDate" = NOW()
      WHERE "_id" = $1
      RETURNING "listoAprobacion", "listoAprobacionPor", "listoAprobacionEn"`,
    [titular._id, actor]);
  return successResponse({ contrato: titular.contrato, ...row });
});
