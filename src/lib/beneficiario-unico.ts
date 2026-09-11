import 'server-only';
import { query } from '@/lib/postgres';
import { ConflictError } from '@/lib/errors';
import { normalizeNumeroIdList } from '@/lib/numeroid-normalize';

/**
 * Invariante de negocio:
 *   Un `numeroId` puede ser TITULAR en varios contratos, pero solo puede ser
 *   BENEFICIARIO (= quien toma el programa) en UN contrato VIVO a la vez.
 *
 * "Vivo" = no finalizado, no anulado, no inactivo. Un beneficiario viejo
 * FINALIZADA/ANULADO/inactivo NO cuenta → permite la re-matrícula legítima
 * (terminó un programa y vuelve a inscribirse en un contrato nuevo).
 */

// Normalización SQL equivalente a normalizeNumeroId (uppercase + quita . espacios _ -).
const SQL_NORM_NUMEROID = `UPPER(REGEXP_REPLACE(COALESCE("numeroId", ''), '[.[:space:]_-]', '', 'g'))`;

export interface BeneficiarioVivo {
  _id: string;
  contrato: string | null;
  primerNombre: string | null;
  primerApellido: string | null;
  aprobacion: string | null;
  estado: string | null;
}

function esAprobado(row: BeneficiarioVivo): boolean {
  return ['APROBADO', 'APROBADA'].includes(String(row.aprobacion || '').trim().toUpperCase());
}

/**
 * Filas BENEFICIARIO "vivas" (no finalizadas/anuladas/inactivas) que existen
 * para cualquiera de los numeroIds dados (comparación normalizada).
 */
export async function findBeneficiariosVivos(
  numeroIds: (string | null | undefined)[]
): Promise<BeneficiarioVivo[]> {
  const norm = normalizeNumeroIdList(numeroIds);
  if (!norm.length) return [];
  const res = await query(
    `SELECT "_id", "contrato", "primerNombre", "primerApellido", "aprobacion", "estado"
       FROM "PEOPLE"
      WHERE "tipoUsuario" = 'BENEFICIARIO'
        AND ${SQL_NORM_NUMEROID} = ANY($1::text[])
        AND "estadoInactivo" IS NOT TRUE
        AND UPPER(TRIM(COALESCE("estado", ''))) NOT IN ('FINALIZADA', 'ANULADO')`,
    [norm]
  );
  return res.rows as BeneficiarioVivo[];
}

/**
 * Chequea el invariante para los numeroIds que se convertirán en beneficiarios:
 *   - Si ya es beneficiario en un contrato APROBADO y vivo → lanza ConflictError (bloquea).
 *   - Si es beneficiario en contratos SIN APROBAR vivos (borradores colgados) → los
 *     devuelve en `anular` para que el caller los marque ANULADO (el nuevo queda válido).
 *   - FINALIZADA/ANULADO/inactivos se ignoran (re-matrícula legítima).
 */
export async function checkBeneficiarioUnico(
  numeroIds: (string | null | undefined)[]
): Promise<{ anular: BeneficiarioVivo[] }> {
  const vivos = await findBeneficiariosVivos(numeroIds);
  const aprobados = vivos.filter(esAprobado);
  if (aprobados.length) {
    const detalle = aprobados
      .map(r => `${`${r.primerNombre || ''} ${r.primerApellido || ''}`.trim() || 'este documento'} — contrato ${r.contrato || '—'}`)
      .join('; ');
    throw new ConflictError(
      `No se puede crear: este documento ya es BENEFICIARIO en un contrato aprobado y activo (${detalle}). ` +
      `Una persona solo puede ser beneficiaria en un contrato a la vez.`
    );
  }
  return { anular: vivos.filter(r => !esAprobado(r)) };
}

/**
 * Marca beneficiarios viejos SIN APROBAR como ANULADO (reversible, deja rastro).
 * No borra filas. No toca USUARIOS_ROLES: un borrador sin aprobar no tiene login,
 * y el email puede estar compartido con el contrato nuevo/otro contrato.
 * Alcance quirúrgico: SOLO las filas BENEFICIARIO indicadas, no el contrato viejo completo.
 */
export async function anularBeneficiariosViejos(peopleIds: string[]): Promise<number> {
  if (!peopleIds.length) return 0;
  await query(
    `UPDATE "PEOPLE"
        SET "estado" = 'ANULADO', "estadoInactivo" = true, "aprobacion" = 'Contrato nulo', "_updatedDate" = NOW()
      WHERE "_id" = ANY($1::text[])`,
    [peopleIds]
  );
  return peopleIds.length;
}
