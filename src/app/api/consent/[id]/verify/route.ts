import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { verifyAndSaveConsent } from '@/services/consent.service';
import { ValidationError } from '@/lib/errors';
import { generarYArchivarContratoPdf } from '@/lib/contract-pdf-generate';
import { generarYArchivarAnexoPdf } from '@/lib/anexo-pdf';
import { issueBienvenidaToken } from '@/lib/bienvenida-token';

export const POST = handler(async (request, { params }) => {
  const body = await request.json();
  const { otpCode } = body;

  if (!otpCode?.trim() || otpCode.trim().length !== 6) {
    throw new ValidationError('Codigo OTP de 6 digitos es requerido');
  }

  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';

  const result = await verifyAndSaveConsent(params.id, otpCode.trim(), ip, ua);

  // Auto-archivado: al quedar firmado, genera el PDF final (con el bloque de
  // consentimiento) y lo archiva en el Drive. Best-effort y SIN bloquear la
  // confirmación del cliente — si falla, el contrato queda firmado igual y el
  // PDF se puede regenerar desde el admin (Generar Contrato).
  generarYArchivarContratoPdf(params.id).then(
    (r) => console.log(`📄 [Consent] PDF archivado tras firma OTP: ${params.id} → ${r.driveUpload?.ok ? (r.driveUpload as any).fileId || 'ok' : 'upload falló'}`),
    (e) => console.error(`⚠️ [Consent] No se pudo archivar el PDF tras la firma OTP (${params.id}):`, e?.message || e),
  );

  // Anexo de constancia (ANEX-): clave de Drive propia, jamás la del
  // contrato. También best-effort e independiente del PDF principal.
  generarYArchivarAnexoPdf(params.id).then(
    (r) => console.log(`📎 [Consent] Anexo tras firma OTP: ${params.id} → ${r.ok ? 'archivado' : (r.skipped || r.error)}`),
    (e) => console.error(`⚠️ [Consent] No se pudo archivar el anexo (${params.id}):`, e?.message || e),
  );

  return successResponse({
    message: 'Consentimiento declarativo registrado exitosamente',
    hash: result.hash,
    // Llave temporal para abrir /bienvenida/[id]. Solo se emite al firmar.
    bienvenidaToken: issueBienvenidaToken(params.id),
  });
});
