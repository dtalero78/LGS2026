import 'server-only';
import { queryOne, queryMany } from '@/lib/postgres';
import { fillContractTemplate } from '@/lib/contract-template-filler';
import { buildContractPdfHtml } from '@/lib/contract-pdf-html';
import { generarYArchivarAnexoPdf } from '@/lib/anexo-pdf';
import { esContratoPrueba } from '@/lib/contrato-prueba-guard';
import { getAsesorInfo } from '@/lib/asesor';
import { attachKidsInscripciones } from '@/lib/kids-inscripciones';
import { archivarContratoEnDrive, buildContractFilename } from '@/lib/contract-drive';
import { buscarPlantillaContrato } from '@/lib/contract-template';

const API2PDF_KEY = process.env.API2PDF_KEY || '9450b12a-4c5f-4e8e-a605-2b61fe4807f2';

/**
 * Tras registrar un consentimiento SIN pasar por la página pública (auto-aprobación
 * o ratificación por correo): genera el PDF del contrato firmado, lo archiva en
 * Drive (sin WhatsApp) y archiva el anexo de constancia ANEX-.
 * Best-effort: un error aquí nunca anula el consentimiento ya guardado.
 */
export async function archivarContratoFirmado(
  titularId: string,
  result: { consent: any; hash: string },
): Promise<{ pdfUrl: string | null; driveUpload: any }> {
  let driveUpload: any = null;
  let pdfUrl: string | null = null;

  try {
    const titular = await queryOne(`SELECT * FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
    if (titular?.plataforma && titular?.contrato) {
      const beneficiarios = await queryMany(
        `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 AND "_id" != $2 ORDER BY "_createdDate" ASC`,
        [titular.contrato, titularId]
      );
      // Adjunta el detalle de KIDS_INSCRIPCIONES a los beneficiarios kids (para la plantilla).
      await attachKidsInscripciones(titular.contrato, beneficiarios);

      // FINANCIEROS se busca por "contrato" (la columna legacy titularId quedó NULL en la migración).
      const financial = await queryOne(
        `SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1
         ORDER BY "_createdDate" DESC LIMIT 1`,
        [titular.contrato]
      );

      // Por país y tipo de contrato (estándar o canje) — lib/contract-template.
      const tplTexto = await buscarPlantillaContrato(titular.plataforma, titular.tipoContrato);
      if (tplTexto) {
        const consentData = { hasConsent: true, consent: result.consent, hash: result.hash };
        const asesorInfo = await getAsesorInfo((titular as any).asesor, (titular as any).asesorCreadorContrato);
        const contractText = fillContractTemplate(tplTexto, titular, beneficiarios, financial, consentData as any, asesorInfo);

        const htmlContent = buildContractPdfHtml(contractText, {
          esPrueba: esContratoPrueba(titular?.contrato),
          contrato: titular.contrato,
          fecha: new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }),
        });

        const pdfRes = await fetch('https://v2018.api2pdf.com/chrome/html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': API2PDF_KEY },
          body: JSON.stringify({ html: htmlContent, options: { printBackground: true } }),
        });

        if (pdfRes.ok) {
          const pdfData = await pdfRes.json();
          if (pdfData.success && pdfData.pdf) {
            pdfUrl = pdfData.pdf;
            // Archivar en Drive (según el interruptor: bsl o LGS) — sin WhatsApp
            driveUpload = await archivarContratoEnDrive({
              pdfUrl: pdfData.pdf,
              titularId,
              filename: buildContractFilename(titular as any),
            });
          }
        }
      }
    }
  } catch (pdfErr: any) {
    console.warn('⚠️ [contrato-firmado] PDF/Drive upload failed (non-critical):', pdfErr.message);
  }

  // Anexo de constancia (ANEX-) — best-effort, no bloquea la respuesta.
  generarYArchivarAnexoPdf(titularId).then(
    (r) => console.log(`📎 [contrato-firmado] Anexo: ${titularId} → ${r.ok ? 'archivado' : (r.skipped || r.error)}`),
    (e) => console.error(`⚠️ [contrato-firmado] No se pudo archivar el anexo (${titularId}):`, e?.message || e),
  );

  return { pdfUrl, driveUpload };
}
