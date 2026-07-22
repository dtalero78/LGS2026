import 'server-only';
import { queryOne, queryMany } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { fillContractTemplate } from '@/lib/contract-template-filler';
import { buildContractPdfHtml } from '@/lib/contract-pdf-html';
import { getAsesorInfo } from '@/lib/asesor';
import { archivarContratoEnDrive, buildContractFilename } from '@/lib/contract-drive';

const API2PDF_KEY = process.env.API2PDF_KEY || '9450b12a-4c5f-4e8e-a605-2b61fe4807f2';

/**
 * generarYArchivarContratoPdf — genera el PDF del contrato (API2PDF, con el
 * bloque de consentimiento si el titular ya firmó) y lo archiva en el Drive
 * según el interruptor bsl/lgs. NO envía WhatsApp.
 *
 * Núcleo compartido por:
 *   - POST /api/contracts/[id]/regenerate-drive (regeneración manual admin)
 *   - POST /api/consent/[id]/verify (auto-archivado al firmar por OTP, best-effort)
 */
export async function generarYArchivarContratoPdf(titularId: string) {
  const titular = await queryOne<any>(
    `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
    [titularId]
  );
  if (!titular) throw new NotFoundError('Titular', titularId);
  if (!titular.plataforma) throw new ValidationError('El titular no tiene plataforma asignada');

  const beneficiarios = await queryMany<any>(
    `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 AND "_id" != $2 ORDER BY "_createdDate" ASC`,
    [titular.contrato, titularId]
  );

  // FINANCIEROS por contrato (NO titularId — la columna está NULL en la migración)
  const financial = titular.contrato
    ? await queryOne<any>(
        `SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1
         ORDER BY "_createdDate" DESC LIMIT 1`,
        [titular.contrato]
      )
    : null;

  // Template del contrato por plataforma (con fallback case-insensitive)
  let templateRow = await queryOne<{ template: string }>(
    `SELECT "template" FROM "ContractTemplates" WHERE "plataforma" = $1`,
    [titular.plataforma]
  );
  if (!templateRow) {
    templateRow = await queryOne<{ template: string }>(
      `SELECT "template" FROM "ContractTemplates" WHERE LOWER("plataforma") = LOWER($1)`,
      [titular.plataforma]
    );
  }
  if (!templateRow?.template) throw new NotFoundError('ContractTemplate', titular.plataforma);

  // Datos de consentimiento (si existen)
  const consentRaw = titular.consentimientoDeclarativo;
  const consentObj = typeof consentRaw === 'string' ? JSON.parse(consentRaw) : consentRaw;
  const consentData = consentObj?.aceptado || consentObj?.declaracionAceptada
    ? { hasConsent: true, consent: consentObj, hash: titular.hashConsentimiento }
    : { hasConsent: false };

  const asesorInfo = await getAsesorInfo(titular.asesor, titular.asesorCreadorContrato);
  const contractText = fillContractTemplate(
    templateRow.template,
    titular,
    beneficiarios,
    financial,
    consentData,
    asesorInfo,
  );

  const htmlContent = buildContractPdfHtml(contractText, {
    contrato: titular.contrato,
    fecha: new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }),
  });

  // 1. Generar PDF con API2PDF
  const pdfRes = await fetch('https://v2018.api2pdf.com/chrome/html', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API2PDF_KEY,
    },
    body: JSON.stringify({
      html: htmlContent,
      options: { printBackground: true },
    }),
  });
  if (!pdfRes.ok) {
    const err = await pdfRes.text();
    throw new Error(`API2PDF error ${pdfRes.status}: ${err}`);
  }
  const pdfData = await pdfRes.json();
  if (!pdfData.success || !pdfData.pdf) {
    throw new Error(`API2PDF falló: ${pdfData.error || 'Sin URL de PDF'}`);
  }
  const tempPdfUrl: string = pdfData.pdf;

  // 2. Archivar en Drive (según el interruptor: bsl o LGS; guarda PEOPLE.driveFileId)
  const driveUpload = await archivarContratoEnDrive({
    pdfUrl: tempPdfUrl,
    titularId,
    filename: buildContractFilename(titular),
  });

  return { pdfUrl: tempPdfUrl, driveUpload, titular };
}
