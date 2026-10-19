import 'server-only';
import { query, queryMany } from '@/lib/postgres';
import { kidsIntake, KidsIntakeError } from '@/lib/kids-intake';

/**
 * BAJA en KIDS2026 (2026-10-18): cuando un contrato o un beneficiario Kids se
 * ANULA, se RECHAZA o se RETRACTA en LGS, KIDS inactiva su contrato y LIBERA el
 * cupo del salón (la reserva o la matrícula). Sin esto el niño seguía ocupando
 * un lugar en KIDS aunque en LGS ya no existiera.
 *
 * Best-effort, como la suspensión: NUNCA lanza ni rompe la operación de LGS, y
 * se llama DESPUÉS de que LGS guardó el cambio. Un fallo queda en
 * KIDS_INSCRIPCIONES.errorKids para verlo en Aprobación › Kids. KIDS es
 * idempotente, así que repetirla no hace daño.
 */

export type MotivoBajaKids = 'ANULADO' | 'RECHAZADO' | 'RETRACTADO';

/** La `aprobacion` de LGS → el motivo de baja de KIDS (null si no es una baja). */
export function motivoBajaKids(aprobacion: string | null | undefined): MotivoBajaKids | null {
  switch ((aprobacion || '').trim()) {
    case 'Rechazado':
      return 'RECHAZADO';
    case 'Retractado':
      return 'RETRACTADO';
    case 'Contrato nulo':
    case 'Devuelto':
      return 'ANULADO';
    default:
      return null;
  }
}

export interface ResultadoBajaKids {
  referencias: number;
  liberadas: number;
  errores: number;
}

/**
 * Da de baja en KIDS las reservas de un contrato completo o de unos
 * beneficiarios. Solo las que LGS llegó a enviar a KIDS (enviadoAKids).
 */
export async function liberarReservasKids(
  filtro: { contrato?: string | null; beneficiarioIds?: string[] },
  motivo: MotivoBajaKids,
  detalle?: string | null,
): Promise<ResultadoBajaKids> {
  const vacio = { referencias: 0, liberadas: 0, errores: 0 };
  if (!kidsIntake.isConfigured()) return vacio;
  const ids = filtro.beneficiarioIds?.filter(Boolean) ?? [];
  if (!filtro.contrato && ids.length === 0) return vacio;

  let filas: { _id: string; kidsExternalRef: string }[] = [];
  try {
    filas = await queryMany<{ _id: string; kidsExternalRef: string }>(
      `SELECT "_id", "kidsExternalRef" FROM "KIDS_INSCRIPCIONES"
        WHERE "enviadoAKids" = true AND "kidsExternalRef" IS NOT NULL
          AND (("contrato" = $1 AND $1 IS NOT NULL) OR "beneficiarioId" = ANY($2::text[]))`,
      [filtro.contrato ?? null, ids],
    );
  } catch (e: any) {
    console.error('[kids-baja] no se pudieron leer las inscripciones:', e?.message);
    return vacio;
  }

  const resultado = { referencias: filas.length, liberadas: 0, errores: 0 };
  for (const f of filas) {
    try {
      const r = await kidsIntake.cancelReservation(f.kidsExternalRef, {
        motivo,
        detalle: detalle?.slice(0, 400) || null,
      });
      if (r.aplicado) resultado.liberadas++;
      await query(`UPDATE "KIDS_INSCRIPCIONES" SET "errorKids" = NULL, "_updatedDate" = NOW() WHERE "_id" = $1`, [f._id]);
    } catch (e: any) {
      // 404: esa referencia no existe en KIDS (nada que liberar).
      if (e instanceof KidsIntakeError && e.status === 404) continue;
      resultado.errores++;
      console.error('[kids-baja] KIDS falló:', f.kidsExternalRef, e?.message);
      await query(
        `UPDATE "KIDS_INSCRIPCIONES" SET "errorKids" = $2, "_updatedDate" = NOW() WHERE "_id" = $1`,
        [f._id, `Baja en KIDS (${motivo}) falló: ${String(e?.message || 'error').slice(0, 300)}`],
      ).catch(() => undefined);
    }
  }
  return resultado;
}
