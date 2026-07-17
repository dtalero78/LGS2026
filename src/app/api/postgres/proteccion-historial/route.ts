import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { query, queryOne, withTransaction } from '@/lib/postgres';
import { getAcademicSnapshot } from '@/services/proteccion-historial.service';
import { buildInfoAcademicPdfHtml } from '@/lib/infoacademic-pdf-html';
import { spacesClient, SPACES_BUCKET, SPACES_CDN } from '@/lib/spaces';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const API2PDF_KEY = process.env.API2PDF_KEY || '';

/**
 * POST /api/postgres/proteccion-historial
 *
 * "Protección de historial" al re-matricular a alguien que YA tomó el programa
 * (mismo numeroId, contrato viejo). En un solo paso:
 *   1. Genera el PDF del Histórico Académico (KPIs + tabla de agendamientos).
 *   2. Lo sube a DO Spaces y lo adjunta a la documentación del TITULAR NUEVO.
 *   3. Limpia la ficha: borra bookings + complementarias + step-overrides y
 *      RECICLA la ACADEMICA (la re-apunta al beneficiario nuevo, sin dejar hueco).
 *
 * Body: { numeroId, titularId, contratoViejo?, contratoNuevo?, nuevoBeneficiarioId? }
 *   titularId = PEOPLE._id del titular del contrato NUEVO (dónde se adjunta el PDF).
 *
 * Permiso: PERSON.INFO.AGREGAR_BENEFICIARIO (quien agrega beneficiario puede
 * proteger su historial). SUPER_ADMIN/ADMIN bypass.
 */
export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, PersonPermission.AGREGAR_BENEFICIARIO);

  const body = await request.json();
  const numeroId = String(body?.numeroId || '').trim();
  const titularId = String(body?.titularId || '').trim();
  const contratoViejo = String(body?.contratoViejo || '').trim() || null;
  const contratoNuevo = String(body?.contratoNuevo || '').trim() || null;

  if (!numeroId) throw new ValidationError('numeroId requerido');
  if (!titularId) throw new ValidationError('titularId (titular del contrato nuevo) requerido');
  if (!API2PDF_KEY) throw new ValidationError('API2PDF_KEY no configurada');

  // Guard: no proteger contratos de prueba.
  if (contratoViejo && /^PRB-/i.test(contratoViejo)) {
    throw new ValidationError('No se protege el historial de contratos de prueba (PRB-).');
  }
  // Guard: no archivar "sobre el mismo contrato".
  if (contratoViejo && contratoNuevo && contratoViejo === contratoNuevo) {
    throw new ValidationError('El contrato viejo y el nuevo no pueden ser el mismo.');
  }

  // 1. Snapshot del historial viejo.
  const snap = await getAcademicSnapshot(numeroId, contratoViejo);
  if (!snap) throw new NotFoundError('Ficha académica', numeroId);
  const academicaId = snap.student.academicaId;

  // 2. Titular nuevo debe existir.
  const titular = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "PEOPLE" WHERE "_id" = $1`, [titularId],
  );
  if (!titular) throw new NotFoundError('Titular', titularId);

  // 3. Generar PDF vía API2PDF.
  const html = buildInfoAcademicPdfHtml(snap, { generadoPor: session.user?.name || 'Sistema' });
  const pdfRes = await fetch('https://v2018.api2pdf.com/chrome/html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: API2PDF_KEY },
    body: JSON.stringify({ html, options: { printBackground: true } }),
  });
  const pdfData = await pdfRes.json();
  if (!pdfRes.ok || !pdfData?.pdf) throw new Error(`API2PDF falló: ${pdfData?.error || pdfRes.status}`);

  // 4. Descargar el PDF y subirlo a Spaces (público) para tener URL permanente.
  const pdfBytes = Buffer.from(await (await fetch(pdfData.pdf)).arrayBuffer());
  const key = `historico-academico/${numeroId}/${Date.now()}.pdf`;
  await spacesClient.send(new PutObjectCommand({
    Bucket: SPACES_BUCKET, Key: key, Body: pdfBytes,
    ContentType: 'application/pdf', ACL: 'public-read',
  }));
  const docUrl = `${SPACES_CDN}/${key}`;
  const docNombre = `Histórico Académico - ${contratoViejo || snap.student.contrato || numeroId}.pdf`;

  // 5. Adjuntar a la documentación del TITULAR NUEVO.
  const doc = { url: docUrl, nombre: docNombre, tipo: 'application/pdf', fechaSubida: new Date().toISOString() };
  await query(
    `UPDATE "PEOPLE"
        SET "documentacion" = COALESCE("documentacion", '[]'::jsonb) || $1::jsonb, "_updatedDate" = NOW()
      WHERE "_id" = $2`,
    [JSON.stringify([doc]), titularId],
  );

  // 6. Limpiar la ficha vieja + reciclar la ACADEMICA (transacción atómica).
  const cleanup = await withTransaction(async (client) => {
    const del = async (sql: string) => (await client.query(sql, [academicaId])).rowCount || 0;
    const bookings = await del(
      `DELETE FROM "ACADEMICA_BOOKINGS" WHERE COALESCE("studentId","idEstudiante") = $1`);
    let complementarias = 0, overrides = 0;
    try { complementarias = (await client.query(`DELETE FROM "COMPLEMENTARIA_ATTEMPTS" WHERE "studentId" = $1`, [academicaId])).rowCount || 0; } catch {}
    try { overrides = (await client.query(`DELETE FROM "STEP_OVERRIDES" WHERE "studentId" = $1`, [academicaId])).rowCount || 0; } catch {}

    // Reciclar la ACADEMICA: re-apuntar al beneficiario ACTIVO del contrato nuevo
    // + reactivar. Se mantiene la fila (no se deja hueco por numeroId).
    await client.query(
      `UPDATE "ACADEMICA" a
          SET "estadoInactivo" = false,
              "usuarioId" = COALESCE(
                (SELECT p."_id" FROM "PEOPLE" p
                  WHERE p."numeroId" = a."numeroId" AND p."tipoUsuario" = 'BENEFICIARIO'
                    AND p."estadoInactivo" IS NOT TRUE
                    AND UPPER(TRIM(COALESCE(p."estado",''))) NOT IN ('FINALIZADA','ON HOLD')
                  ORDER BY p."_createdDate" DESC LIMIT 1),
                a."usuarioId"),
              "_updatedDate" = NOW()
        WHERE a."_id" = $1`,
      [academicaId],
    );
    return { bookings, complementarias, overrides };
  });

  return successResponse({
    documento: doc,
    academicaId,
    eliminados: cleanup,
    message: `Historial protegido: ${cleanup.bookings} agendamiento(s) archivado(s) y limpiado(s).`,
  });
});
