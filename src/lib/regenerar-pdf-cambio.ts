import 'server-only';
import { queryOne } from '@/lib/postgres';
import { generarYArchivarContratoPdf } from '@/lib/contract-pdf-generate';
import { registrarEventoContrato } from '@/lib/contrato-eventos';

/**
 * Regla (acordada 2026-11-27): cuando cambian las personas de un contrato
 * (agregar / eliminar / reemplazar beneficiario, reemplazar titular) se vuelve a
 * generar el PDF del contrato con los datos actuales y se archiva en el Drive
 * (reemplaza al anterior, que va a la papelera del Drive). La pantalla muestra un
 * resumen del cambio y aconseja enviar el contrato nuevo al titular; al reemplazar
 * al titular la firma ya quedó anulada y hay que solicitarla de nuevo.
 *
 * Corre en segundo plano (API2PDF + Drive tardan unos segundos) y nunca rompe el
 * flujo que la llama; el resultado queda en el Seguimiento (CONTRATO_EVENTOS).
 */

/** Titular del contrato cuyo `_id` es la clave del PDF en el Drive (prefiere el que ya tiene PDF o firma). */
export async function titularDelContrato(contrato: string): Promise<string | null> {
  if (!contrato) return null;
  const t = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
      ORDER BY (COALESCE("driveFileId",'') <> '') DESC, (COALESCE("hashConsentimiento",'') <> '') DESC, "_createdDate" ASC
      LIMIT 1`, [contrato]).catch(() => null);
  return t?._id || null;
}

export function regenerarPdfTrasCambio(args: { titularId?: string | null; contrato?: string | null; motivo: string; session?: any }): void {
  (async () => {
    const titularId = args.titularId || (args.contrato ? await titularDelContrato(args.contrato) : null);
    if (!titularId) return;
    try {
      const r = await generarYArchivarContratoPdf(titularId);
      const ok = r.driveUpload?.ok !== false;
      await registrarEventoContrato({
        personaId: titularId, categoria: 'DOCUMENTOS',
        accion: ok ? 'PDF del contrato regenerado' : 'PDF del contrato regenerado (sin archivar en Drive)',
        detalle: `${args.motivo}${ok ? '' : ` · Drive: ${(r.driveUpload as any)?.error || 'falló'}`}`,
        session: args.session,
      });
      console.log(`📄 [regenerar-pdf] ${titularId} (${args.motivo}) → ${ok ? 'archivado' : 'Drive falló'}`);
    } catch (e: any) {
      console.error(`⚠️ [regenerar-pdf] No se pudo regenerar el PDF de ${titularId} (${args.motivo}):`, e?.message || e);
      await registrarEventoContrato({
        personaId: titularId, categoria: 'DOCUMENTOS', accion: 'No se pudo regenerar el PDF del contrato',
        detalle: `${args.motivo} · ${e?.message || e}. Regenérelo desde Mantenimiento › Generar contrato.`,
        session: args.session,
      }).catch(() => {});
    }
  })();
}
