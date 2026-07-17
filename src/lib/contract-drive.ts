import 'server-only';
import { AppConfigRepository } from '@/repositories/config.repository';
import { isDriveDirectConfigured, uploadContractPdf } from '@/lib/google-drive';

/**
 * contract-drive.ts — interruptor de archivado de contratos en Drive.
 *
 * Modo 'bsl' (default): sube el PDF vía la app externa bsl-utilidades (como hasta
 * ahora). Modo 'lgs': sube directo a la Unidad compartida con la cuenta de
 * servicio (google-drive.ts). El modo se cambia desde el admin (APP_CONFIG), igual
 * que los feature flags de Material Interactivo.
 *
 * La descarga se resuelve en /api/contracts/[id]/download-pdf según el mismo modo.
 */

const MODE_KEY = 'drive_upload_mode';
const FLAG_TTL_MS = 60 * 1000;
const BSL_UPLOAD_URL = 'https://bsl-utilidades-yp78a.ondigitalocean.app/subir-pdf-directo';

export type DriveMode = 'bsl' | 'lgs';

let _modeCache: { value: DriveMode; expires: number } | null = null;

/** Modo actual con cache 60s. Default 'bsl' (comportamiento previo). */
export async function getDriveMode(): Promise<DriveMode> {
  const now = Date.now();
  if (_modeCache && _modeCache.expires > now) return _modeCache.value;
  const row = await AppConfigRepository.get(MODE_KEY);
  const value: DriveMode = row?.value === 'lgs' ? 'lgs' : 'bsl';
  _modeCache = { value, expires: now + FLAG_TTL_MS };
  return value;
}

/** Cambia el modo (admin). Invalida cache. Rechaza 'lgs' si Drive no está configurado. */
export async function setDriveMode(mode: DriveMode, actor: string): Promise<void> {
  if (mode === 'lgs' && !isDriveDirectConfigured()) {
    throw new Error('No se puede activar el modo LGS: falta GOOGLE_SERVICE_ACCOUNT_JSON.');
  }
  await AppConfigRepository.set(MODE_KEY, mode, '#ffffff', actor);
  _modeCache = null;
}

/** Nombre del PDF en Drive: "lgs <primerNombre> <primerApellido> <numeroId>.pdf". */
export function buildContractFilename(titular: { primerNombre?: string | null; primerApellido?: string | null; numeroId?: string | null }): string {
  const parts = [titular.primerNombre, titular.primerApellido, titular.numeroId].filter(Boolean);
  return parts.length ? `lgs ${parts.join(' ')}.pdf` : 'lgs Contrato.pdf';
}

/**
 * Archiva el PDF del contrato en Drive según el modo activo. Best-effort: nunca
 * lanza (devuelve {ok:false, error}) para no romper el flujo que lo llama.
 *
 * @param pdfUrl  URL temporal del PDF (API2PDF).
 * @param titularId  documento con el que se busca/sobrescribe (PEOPLE._id).
 * @param filename  nombre del archivo en Drive (modo lgs).
 */
export async function archivarContratoEnDrive(args: {
  pdfUrl: string;
  titularId: string;
  filename: string;
}): Promise<{ ok: boolean; mode: DriveMode; fileId?: string; link?: string; error?: string }> {
  const mode = await getDriveMode();
  try {
    if (mode === 'lgs') {
      const bytes = Buffer.from(await (await fetch(args.pdfUrl)).arrayBuffer());
      const { fileId, webViewLink } = await uploadContractPdf(bytes, { name: args.filename, documento: args.titularId });
      return { ok: true, mode, fileId, link: webViewLink ?? undefined };
    }
    // modo 'bsl'
    const res = await fetch(BSL_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfUrl: args.pdfUrl, documento: args.titularId, empresa: 'LGS' }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, mode, ...data };
  } catch (e: any) {
    return { ok: false, mode, error: e?.message || String(e) };
  }
}
