import 'server-only';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { ValidationError } from '@/lib/errors';
import { query } from '@/lib/postgres';
import { spacesClient, SPACES_BUCKET, SPACES_CDN } from '@/lib/spaces';
import { ratificarConsentPorCorreo } from '@/services/consent.service';
import { archivarContratoFirmado } from '@/lib/contrato-firmado-drive';
import { previsualizarDepuracion } from '@/lib/libro-depuracion';
import { registrarEventoContrato } from '@/lib/contrato-eventos';

/**
 * Ratifica un contrato SIN FIRMAR con el correo "SÍ, ACEPTO" del titular (regla única,
 * usada por el Libro de Producción › Ratificar y por "Dejar listo para aprobación" de la
 * pantalla del contrato):
 *   1. el archivo va a Spaces y queda en PEOPLE.documentacion;
 *   2. consentimiento tipo CORREO (cuenta como firma);
 *   3. contrato firmado + anexo al Drive (best-effort).
 * El contrato impreso agrega bajo el "SÍ, ACEPTO": "Aceptación realizada por medio de
 * correo electrónico adjuntado a los documentos" (lib/contract-template-filler).
 */

const TIPOS = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'message/rfc822', 'application/vnd.ms-outlook']);
const EXT_CORREO: Record<string, string> = { eml: 'message/rfc822', msg: 'application/vnd.ms-outlook' };
const MAX_MB = 20;

export async function ratificarSiAcepto(opts: {
  titularId: string;
  file: File | null;
  confirmarOtros: boolean;
  /** true = solo se acepta PDF (pantalla del contrato). */
  soloPdf?: boolean;
  origen: 'LIBRO' | 'CONTRATO';
  session: any;
  ip: string;
  userAgent: string;
}) {
  const { titularId, file } = opts;
  if (!file || !file.size) throw new ValidationError('Adjunta el correo "SÍ, ACEPTO" del titular');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const tipo = EXT_CORREO[ext] || file.type || '';
  if (file.size > MAX_MB * 1024 * 1024) throw new ValidationError(`Archivo demasiado grande: máximo ${MAX_MB} MB`);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (opts.soloPdf) {
    // Solo PDF, verificado por su contenido (no por la extensión).
    if (buffer.subarray(0, 4).toString('latin1') !== '%PDF') throw new ValidationError('El archivo debe ser un PDF (la impresión del correo "SÍ, ACEPTO")');
  } else if (!TIPOS.has(tipo)) {
    throw new ValidationError('Formato no permitido: use PDF, imagen o el archivo del correo (.eml / .msg)');
  }
  const contentType = opts.soloPdf ? 'application/pdf' : tipo;

  const prev = await previsualizarDepuracion(titularId);
  if (!prev.ratificable) throw new ValidationError(prev.motivoNoRatificable || 'Este contrato no se puede ratificar');
  if (prev.otrosContratos.length && !opts.confirmarOtros) {
    throw new ValidationError('El titular tiene otros contratos: confirma la ratificación');
  }

  // 1. Correo a Spaces (mismo esquema que la documentación del contrato).
  const key = `contratos/${titularId}/${Date.now()}-ratificacion-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await spacesClient.send(new PutObjectCommand({
    Bucket: SPACES_BUCKET, Key: key, Body: buffer, ContentType: contentType, ACL: 'public-read',
  }));
  const url = `${SPACES_CDN}/${key}`;
  const actorEmail = (opts.session?.user as any)?.email || 'desconocido';
  const actorNombre = (opts.session?.user as any)?.name || actorEmail;

  // 2. Consentimiento tipo CORREO (rechaza si alguien lo firmó entretanto).
  const result = await ratificarConsentPorCorreo(titularId, actorEmail, actorNombre, opts.ip, opts.userAgent, url);

  // 3. El correo queda en la documentación del contrato.
  const doc = {
    url, nombre: `Correo SÍ, ACEPTO — ${file.name}`, tipo: contentType, fechaSubida: new Date().toISOString(),
    ratificacion: true, subidoPor: actorEmail,
  };
  await query(
    `UPDATE "PEOPLE" SET "documentacion" = COALESCE("documentacion", '[]'::jsonb) || $1::jsonb, "_updatedDate" = NOW() WHERE "_id" = $2`,
    [JSON.stringify([doc]), titularId]);

  // 4. Contrato firmado → Drive + anexo (best-effort).
  const { driveUpload } = await archivarContratoFirmado(titularId, result);

  if (opts.origen === 'CONTRATO') {
    await registrarEventoContrato({
      personaId: titularId, categoria: 'FIRMA', accion: 'Sí acepto anexado (firma por correo)',
      detalle: `Impresión del correo "SÍ, ACEPTO" anexada desde la pantalla del contrato${driveUpload ? ' · contrato archivado en Drive' : ''}`,
      session: opts.session,
    });
  }
  return { contrato: prev.titular.contrato, hash: result.hash, documento: doc, drive: !!driveUpload };
}
