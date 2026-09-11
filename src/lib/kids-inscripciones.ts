import 'server-only';
import { query } from '@/lib/postgres';

/**
 * Adjunta a cada beneficiario con `kids === true` su registro de
 * `KIDS_INSCRIPCIONES` (como `b.kidsInscripcion`), para que la plantilla del
 * contrato (fillContractTemplate) muestre el detalle del programa Kids —
 * curso + apoderado — debajo de ese beneficiario. NO afecta beneficiarios
 * adultos.
 *
 * Llave de match: `beneficiarioId` (= PEOPLE `_id`), con fallback a `numeroId`.
 * Best-effort: si la consulta falla, devuelve los beneficiarios intactos (el
 * contrato se renderiza igual, sólo sin el detalle Kids).
 */
export async function attachKidsInscripciones<T extends { _id?: string; numeroId?: string; kids?: boolean }>(
  contrato: string | null | undefined,
  beneficiarios: T[],
): Promise<T[]> {
  try {
    if (!contrato || !Array.isArray(beneficiarios) || !beneficiarios.some(b => b?.kids === true)) {
      return beneficiarios;
    }
    const r = await query(`SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "contrato" = $1`, [contrato]);
    const porBenef = new Map<string, any>();
    const porNumeroId = new Map<string, any>();
    for (const row of r.rows as any[]) {
      if (row.beneficiarioId) porBenef.set(String(row.beneficiarioId), row);
      if (row.numeroId) porNumeroId.set(String(row.numeroId), row);
    }
    for (const b of beneficiarios) {
      if (b?.kids === true) {
        (b as any).kidsInscripcion =
          porBenef.get(String(b._id || '')) || porNumeroId.get(String(b.numeroId || '')) || null;
      }
    }
    return beneficiarios;
  } catch (e: any) {
    console.error('[attachKidsInscripciones] best-effort error:', e?.message);
    return beneficiarios;
  }
}
