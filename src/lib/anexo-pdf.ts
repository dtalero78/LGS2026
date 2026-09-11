import 'server-only';
import { queryOne } from '@/lib/postgres';
import { esContratoPrueba } from '@/lib/contrato-prueba-guard';
import { normalizeNumeroId } from '@/lib/numeroid-normalize';
import { archivarContratoEnDrive, buildContractFilename } from '@/lib/contract-drive';

const API2PDF_KEY = process.env.API2PDF_KEY || '9450b12a-4c5f-4e8e-a605-2b61fe4807f2';

/**
 * anexo-pdf.ts — ANEXO de constancia de firma, archivado junto al contrato.
 *
 * Es la versión en PDF de la página de bienvenida (`/bienvenida/[id]`): deja
 * asentado qué firmó el titular, cuándo y con qué sello, para que la constancia
 * exista aunque el enlace web haya vencido.
 *
 * ⚠️ CLAVE DE DRIVE DISTINTA — `uploadContractPdf` manda a la papelera TODO
 * archivo que comparta su `appProperties.documento`. Si el anexo usara el
 * `titularId` (la clave del contrato), **borraría el contrato**. Por eso va con
 * `ANEX-<titularId>`: cada uno se sobrescribe a sí mismo y nunca se pisan.
 * `download-pdf` busca por `titularId`, así que sigue sirviendo el contrato.
 *
 * Nombre del archivo: el mismo del contrato con el prefijo `ANEX-`, para que
 * queden juntos y emparejados en la carpeta CONTRATOS LGS:
 *   Contrato:  lgs María José Campodónico 18201897K.pdf
 *   Anexo:     ANEX-lgs María José Campodónico 18201897K.pdf
 *
 * Los contratos de PRUEBA (PRB-) no generan anexo: no entran al Drive real.
 */

/** Prefijo del nombre y de la clave de Drive. Ambos comparten "ANEX". */
const ANEXO_PREFIX = 'ANEX-';

/** Clave de Drive del anexo — NUNCA la del contrato (ver nota de arriba). */
export function anexoDriveDocumento(titularId: string): string {
  return `${ANEXO_PREFIX}${titularId}`;
}

/** Nombre del anexo = prefijo + el mismo nombre del contrato. */
export function buildAnexoFilename(titular: {
  primerNombre?: string | null;
  primerApellido?: string | null;
  numeroId?: string | null;
}): string {
  return `${ANEXO_PREFIX}${buildContractFilename(titular)}`;
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Muestra solo los extremos del sello: nunca el hash completo. */
function maskHash(hash?: string | null): string {
  if (!hash) return '';
  if (hash.length <= 26) return hash;
  return `${hash.slice(0, 12)} ${'·'.repeat(12)} ${hash.slice(-11)}`;
}

interface AnexoData {
  contrato: string;
  nombre: string;
  documento: string;
  fechaFirma: string;
  celular: string;
  tipoAprobacion: string;
  hashMasked: string;
}

/** HTML del anexo, con la identidad visual de la página de bienvenida. */
export function buildAnexoPdfHtml(d: AnexoData): string {
  const fila = (label: string, valor: string) =>
    valor ? `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(valor)}</td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Anexo — Constancia de firma ${esc(d.contrato)}</title>
<style>
  @page { margin: 18mm 18mm 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia,'Times New Roman',serif; font-size: 11pt; line-height: 1.6;
         color: #1a1a1a; margin: 0; }
  .head { background: #312782; color: #fff; padding: 22px 24px; margin: -4px -4px 26px; }
  .head .kicker { font-family: Arial,Helvetica,sans-serif; font-size: 8.5pt; font-weight: bold;
                  letter-spacing: 2px; text-transform: uppercase; opacity: .85; }
  .head h1 { font-family: Arial,Helvetica,sans-serif; font-size: 19pt; margin: 6px 0 0; }
  .head .sub { font-size: 10pt; margin-top: 6px; opacity: .92; }
  h2 { font-family: Arial,Helvetica,sans-serif; font-size: 12pt; color: #0170B9;
       margin: 0 0 10px; text-transform: uppercase; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e6ef; vertical-align: top; }
  td.lbl { font-family: Arial,Helvetica,sans-serif; font-size: 8.5pt; font-weight: bold;
           letter-spacing: 1px; text-transform: uppercase; color: #8a8a9c; width: 38%; }
  td.val { font-size: 11pt; }
  .hash { font-family: 'Courier New',monospace; font-size: 9.5pt; color: #585868; }
  .nota { background: #f4f6fa; border-left: 3px solid #0170B9; padding: 12px 14px;
          font-size: 10pt; color: #3a3a3a; }
  .pie { margin-top: 30px; border-top: 1px solid #e2e6ef; padding-top: 12px;
         font-size: 9pt; color: #8a8a9c; text-align: center; }
</style>
</head>
<body>
  <div class="head">
    <div class="kicker">Anexo del contrato ${esc(d.contrato)}</div>
    <h1>Constancia de firma</h1>
    <div class="sub">Consentimiento declarativo verificado — Let's Go Speak</div>
  </div>

  <h2>Datos de la firma</h2>
  <table>
    ${fila('Contrato', d.contrato)}
    ${fila('Titular', d.nombre)}
    ${fila('Documento', d.documento)}
    ${fila('Fecha y hora', d.fechaFirma)}
    ${fila('Celular verificado', d.celular)}
    ${fila('Método de verificación', d.tipoAprobacion === 'AUTOMATICA' ? 'Aprobación directa' : 'WhatsApp · OTP')}
    ${d.hashMasked ? `<tr><td class="lbl">Sello de integridad (SHA-256)</td><td class="val hash">${esc(d.hashMasked)} <span style="font-family:Arial;font-size:8pt;color:#8a8a9c">(fragmento)</span></td></tr>` : ''}
  </table>

  <div class="nota">
    Este anexo deja constancia de que el titular aceptó el consentimiento declarativo
    del contrato indicado. El sello de integridad permite verificar que el documento
    firmado no ha sido alterado; se muestra en fragmento por seguridad.
  </div>

  <div class="pie">Let's Go Speak · Documento generado automáticamente al firmar</div>
</body>
</html>`;
}

/**
 * Genera el anexo y lo archiva en Drive con su propia clave. Best-effort:
 * nunca lanza — un fallo del anexo no puede tumbar la firma del contrato.
 */
export async function generarYArchivarAnexoPdf(
  titularId: string,
): Promise<{ ok: boolean; skipped?: string; error?: string; pdfUrl?: string }> {
  try {
    const titular = await queryOne<any>(`SELECT * FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
    if (!titular) return { ok: false, error: 'titular no encontrado' };

    // Un contrato de prueba no entra al Drive de contratos reales.
    if (esContratoPrueba(titular.contrato)) return { ok: false, skipped: 'contrato de prueba' };

    let consent: any = titular.consentimientoDeclarativo;
    if (typeof consent === 'string') { try { consent = JSON.parse(consent); } catch { consent = null; } }
    if (!consent) return { ok: false, skipped: 'sin consentimiento firmado' };

    const fechaFirma = consent.timestampAcceptacion
      ? new Date(consent.timestampAcceptacion).toLocaleString('es', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : '';

    const html = buildAnexoPdfHtml({
      contrato: titular.contrato || '',
      nombre: [titular.primerNombre, titular.segundoNombre, titular.primerApellido, titular.segundoApellido]
        .filter(Boolean).join(' ').trim(),
      documento: normalizeNumeroId(consent.numeroDocumento || titular.numeroId),
      fechaFirma,
      celular: consent.celularVerificado || '',
      tipoAprobacion: consent.tipoAprobacion || '',
      hashMasked: maskHash(titular.hashConsentimiento),
    });

    const pdfRes = await fetch('https://v2018.api2pdf.com/chrome/html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: API2PDF_KEY },
      body: JSON.stringify({ html, inlinePdf: false, fileName: buildAnexoFilename(titular) }),
    });
    const pdfJson: any = await pdfRes.json().catch(() => null);
    if (!pdfRes.ok || !pdfJson?.pdf) {
      return { ok: false, error: `API2PDF: ${pdfJson?.error || pdfRes.status}` };
    }

    // Clave PROPIA: si usara `titularId`, el upload mandaría el contrato a la papelera.
    const archivado = await archivarContratoEnDrive({
      pdfUrl: pdfJson.pdf,
      titularId: anexoDriveDocumento(titularId),
      filename: buildAnexoFilename(titular),
    });

    return { ok: archivado.ok, error: archivado.ok ? undefined : (archivado as any).error, pdfUrl: pdfJson.pdf };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
