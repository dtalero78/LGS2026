import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { query, queryMany, queryOne } from '@/lib/postgres';
import { generateId } from '@/lib/id-generator';
import { autoApproveConsent } from '@/services/consent.service';
import { generarYArchivarContratoPdf } from '@/lib/contract-pdf-generate';
import { generarYArchivarAnexoPdf } from '@/lib/anexo-pdf';

/**
 * Regularización 2026-10-19 (Centro de Aprobaciones › "Sin firmar", Grupos 3 y 4).
 * Esos contratos se aprobaron/finalizaron con scripts/aprobar-sin-firmar.js (sin
 * mensajes). Aquí se les genera, uno por llamada, lo mismo que el botón
 * "Auto-aprobar Consentimiento": consentimiento AUTOMATICA (+ hash), PDF del
 * contrato con el bloque de consentimiento archivado en Drive y el anexo de
 * constancia. NO envía WhatsApp. Solo SUPER_ADMIN / ADMIN.
 *
 *   GET  → pendientes: titulares de esos contratos sin consentimiento (uno por contrato).
 *   POST { titularId } → procesa uno.
 */
const ORIGEN = 'script:aprobar-sin-firmar';

function exigirAdmin(session: any) {
  const role = String(session?.user?.role || '').toUpperCase();
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') throw new ForbiddenError('Solo administradores');
}

async function pendientes() {
  // Un titular por contrato regularizado cuyo contrato todavía no tiene ningún titular firmado.
  return queryMany<{ titularId: string; contrato: string; nombre: string }>(
    `SELECT DISTINCT ON (p."contrato") p."_id" AS "titularId", p."contrato",
            TRIM(COALESCE(p."primerNombre",'') || ' ' || COALESCE(p."primerApellido",'')) AS nombre
       FROM "PEOPLE" p
      WHERE p."tipoUsuario" = 'TITULAR'
        AND p."contrato" IN (SELECT DISTINCT "contrato" FROM "APROBACION_AUDIT" WHERE "usuarioEmail" = $1)
        AND NOT EXISTS (SELECT 1 FROM "PEOPLE" t WHERE t."contrato" = p."contrato" AND t."tipoUsuario" = 'TITULAR'
                         AND COALESCE(t."hashConsentimiento",'') <> '')
      ORDER BY p."contrato", p."_createdDate"`,
    [ORIGEN],
  );
}

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  exigirAdmin(session);
  const lista = await pendientes();
  return successResponse({ pendientes: lista, total: lista.length });
});

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  exigirAdmin(session);
  const body = await request.json().catch(() => ({}));
  const titularId = String(body?.titularId || '');
  if (!(await pendientes()).some((p) => p.titularId === titularId)) {
    throw new ValidationError('Ese titular no está en la lista de regularización (o ya tiene consentimiento)');
  }
  const ip = request.headers.get('x-forwarded-for') || 'regularizacion';
  const ua = `Regularización Sin firmar 2026-10-19 · ${request.headers.get('user-agent') || ''}`.slice(0, 500);
  const email = (session.user as any)?.email || 'admin';
  const nombre = (session.user as any)?.name || 'Admin';

  const consent = await autoApproveConsent(titularId, email, nombre, ip, ua);
  const titular = await queryOne<{ contrato: string }>(`SELECT "contrato" FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
  await query(
    `INSERT INTO "auditautoaprov" ("_id","contrato","titularId","usuarioEmail","usuarioNombre","ip","userAgent","_createdDate")
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
    [generateId('aud'), titular?.contrato || null, titularId, email, nombre, ip, ua],
  );

  let drive: any = null;
  let errorPdf: string | null = null;
  try {
    const r = await generarYArchivarContratoPdf(titularId);
    drive = r.driveUpload;
  } catch (e: any) {
    errorPdf = e?.message || String(e);
  }
  const anexo = await generarYArchivarAnexoPdf(titularId).catch((e) => ({ ok: false, error: e?.message }));
  return successResponse({ titularId, contrato: titular?.contrato, hash: consent.hash, drive, errorPdf, anexo });
});
