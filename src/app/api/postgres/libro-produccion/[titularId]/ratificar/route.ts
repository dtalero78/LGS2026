import { NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { query } from '@/lib/postgres';
import { spacesClient, SPACES_BUCKET, SPACES_CDN } from '@/lib/spaces';
import { ratificarConsentPorCorreo } from '@/services/consent.service';
import { archivarContratoFirmado } from '@/lib/contrato-firmado-drive';
import { previsualizarDepuracion } from '@/lib/libro-depuracion';

// El correo "SÍ, ACEPTO": captura / PDF impreso, o el archivo del correo (.eml / .msg).
const TIPOS = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'message/rfc822', 'application/vnd.ms-outlook']);
const EXT_CORREO: Record<string, string> = { eml: 'message/rfc822', msg: 'application/vnd.ms-outlook' };
const MAX_MB = 20;

/**
 * POST /api/postgres/libro-produccion/[titularId]/ratificar   (FormData: file, confirmarOtros?)
 * Ratifica un contrato SIN FIRMAR con el correo "SÍ, ACEPTO" del titular: guarda el
 * correo en PEOPLE.documentacion, registra el consentimiento tipo CORREO (cuenta como
 * firma → pasa a "Pendiente aprobación") y archiva el contrato firmado + anexo en Drive.
 * El contrato impreso agrega bajo el "SÍ, ACEPTO": "Aceptación realizada por medio de
 * correo electrónico adjuntado a los documentos" (lib/contract-template-filler).
 * Gate: staff + APROBACION.LIBRO_PRODUCCION.RATIFICAR.
 */
export const POST = handlerWithStaffAuth(async (req: NextRequest, ctx, session) => {
  await requirePermission(session, AprobacionPermission.LIBRO_PRODUCCION_RATIFICAR);
  const titularId = ctx.params.titularId;
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file || !file.size) throw new ValidationError('Adjunta el correo "SÍ, ACEPTO" del titular');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const tipo = EXT_CORREO[ext] || file.type || '';
  if (!TIPOS.has(tipo)) throw new ValidationError('Formato no permitido: use PDF, imagen o el archivo del correo (.eml / .msg)');
  if (file.size > MAX_MB * 1024 * 1024) throw new ValidationError(`Archivo demasiado grande: máximo ${MAX_MB} MB`);

  const prev = await previsualizarDepuracion(titularId);
  if (!prev.ratificable) throw new ValidationError(prev.motivoNoRatificable || 'Este contrato no se puede ratificar');
  if (prev.otrosContratos.length && form.get('confirmarOtros') !== 'true') {
    throw new ValidationError('El titular tiene otros contratos: confirma la ratificación');
  }

  // 1. Correo a Spaces (mismo esquema que la documentación del contrato).
  const key = `contratos/${titularId}/${Date.now()}-ratificacion-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await spacesClient.send(new PutObjectCommand({
    Bucket: SPACES_BUCKET, Key: key, Body: Buffer.from(await file.arrayBuffer()),
    ContentType: tipo, ACL: 'public-read',
  }));
  const url = `${SPACES_CDN}/${key}`;
  const actorEmail = (session?.user as any)?.email || 'desconocido';
  const actorNombre = (session?.user as any)?.name || actorEmail;

  // 2. Consentimiento tipo CORREO (rechaza si alguien lo firmó entretanto).
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const result = await ratificarConsentPorCorreo(titularId, actorEmail, actorNombre, ip, req.headers.get('user-agent') || 'unknown', url);

  // 3. El correo queda en la documentación del contrato.
  const doc = {
    url, nombre: `Correo SÍ, ACEPTO — ${file.name}`, tipo, fechaSubida: new Date().toISOString(),
    ratificacion: true, subidoPor: actorEmail,
  };
  await query(
    `UPDATE "PEOPLE" SET "documentacion" = COALESCE("documentacion", '[]'::jsonb) || $1::jsonb, "_updatedDate" = NOW() WHERE "_id" = $2`,
    [JSON.stringify([doc]), titularId]);

  // 4. Contrato firmado → Drive + anexo (best-effort).
  const { driveUpload } = await archivarContratoFirmado(titularId, result);
  return successResponse({ contrato: prev.titular.contrato, hash: result.hash, documento: doc, drive: !!driveUpload });
});
