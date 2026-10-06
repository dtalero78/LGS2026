import 'server-only';
import { query, queryOne } from '@/lib/postgres';

/**
 * Sincroniza la fecha final del TITULAR con la de sus beneficiarios (opción A,
 * 2026-10-06).
 *
 * Las extensiones, los OnHold y los exámenes internacionales mueven la fecha
 * final del BENEFICIARIO (el alumno). El titular conserva:
 *   - `finalContratoOriginal`: la fecha final con la que nació el contrato. La
 *     llena una sola vez el trigger de la BD (scripts/add-final-contrato-original.js)
 *     y nunca se modifica.
 *   - `finalContrato`: la fecha final VIGENTE = la mayor entre la suya y la de sus
 *     beneficiarios vivos. Cada vez que sube, se agrega una entrada
 *     `tipo: 'SINCRONIZACION'` a su `extensionHistory` (no suma `extensionCount`:
 *     el titular no fue extendido, solo refleja a su beneficiario).
 * Si el titular estaba FINALIZADA y la nueva fecha aún no venció, vuelve a ACTIVA.
 *
 * Best-effort: un fallo aquí nunca rompe la operación que extendió al beneficiario.
 */
const VIVO_SQL = `
  UPPER(COALESCE(b."estado",'')) NOT IN ('FINALIZADA','ANULADO','RETRACTADO')
  AND UPPER(COALESCE(b."aprobacion",'')) NOT IN ('CONTRATO NULO','DEVUELTO','RECHAZADO','RETRACTADO')
  AND (b."estadoInactivo" IS NOT TRUE OR b."fechaOnHold" IS NOT NULL)`;

export async function sincronizarFinalTitular(
  contrato: string | null | undefined,
  motivo: string,
  ejecutadoPor = 'Sistema',
): Promise<{ sincronizado: boolean; anterior?: string | null; nueva?: string }> {
  try {
    if (!contrato) return { sincronizado: false };
    const titular = await queryOne<any>(
      `SELECT "_id", "finalContrato"::text AS "final", "estado", "extensionHistory"
         FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
        ORDER BY ("aprobacion" = 'Aprobado') DESC, "_createdDate" DESC LIMIT 1`,
      [contrato]);
    if (!titular) return { sincronizado: false };

    const max = await queryOne<{ max: string | null; quien: string | null }>(
      `SELECT b."finalContrato"::text AS max,
              TRIM(CONCAT_WS(' ', b."primerNombre", b."primerApellido")) AS quien
         FROM "PEOPLE" b
        WHERE b."contrato" = $1 AND b."tipoUsuario" <> 'TITULAR' AND b."finalContrato" IS NOT NULL AND ${VIVO_SQL}
        ORDER BY b."finalContrato" DESC LIMIT 1`,
      [contrato]);
    const nueva = max?.max?.slice(0, 10);
    const anterior = titular.final ? String(titular.final).slice(0, 10) : null;
    if (!nueva || (anterior && nueva <= anterior)) return { sincronizado: false };

    const hist = Array.isArray(titular.extensionHistory) ? titular.extensionHistory : [];
    const dias = anterior ? Math.round((Date.parse(nueva) - Date.parse(anterior)) / 86_400_000) : null;
    hist.push({
      numero: hist.length + 1,
      tipo: 'SINCRONIZACION',
      fechaEjecucion: new Date().toISOString(),
      vigenciaAnterior: anterior,
      vigenciaNueva: nueva,
      diasExtendidos: dias,
      motivo: `${motivo}${max?.quien ? ` (beneficiario ${max.quien})` : ''}`,
      ejecutadoPor,
    });

    // Vencido = hoy UTC ≥ final + 2 días (misma regla de contract-expiry).
    const hoy = new Date();
    const hoy0 = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
    const sigueVigente = Date.parse(nueva) + 2 * 86_400_000 > hoy0;
    const reactivar = sigueVigente && String(titular.estado || '').toUpperCase() === 'FINALIZADA';

    await query(
      `UPDATE "PEOPLE"
          SET "finalContrato" = $2::date,
              "extensionHistory" = $3::jsonb,
              ${reactivar ? `"estado" = 'ACTIVA', "estadoInactivo" = false,` : ''}
              "_updatedDate" = NOW()
        WHERE "_id" = $1`,
      [titular._id, nueva, JSON.stringify(hist)]);
    return { sincronizado: true, anterior, nueva };
  } catch (e: any) {
    console.error('[sync-final-titular]', contrato, e?.message || e);
    return { sincronizado: false };
  }
}

/** Versión por persona: resuelve el contrato del beneficiario y sincroniza su titular. */
export async function sincronizarFinalTitularDe(personId: string, motivo: string, ejecutadoPor?: string) {
  const p = await queryOne<{ contrato: string | null; tipoUsuario: string | null }>(
    `SELECT "contrato", "tipoUsuario" FROM "PEOPLE" WHERE "_id" = $1`, [personId]);
  if (!p?.contrato) return { sincronizado: false };
  return sincronizarFinalTitular(p.contrato, motivo, ejecutadoPor);
}

/** Para procesos en lote: sincroniza varios contratos (secuencial, best-effort). */
export async function sincronizarFinalTitulares(contratos: string[], motivo: string) {
  let n = 0;
  for (const c of Array.from(new Set(contratos.filter(Boolean)))) {
    if ((await sincronizarFinalTitular(c, motivo)).sincronizado) n++;
  }
  return n;
}
