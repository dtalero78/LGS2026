import 'server-only';
import { queryOne } from '@/lib/postgres';

/**
 * Plantilla del contrato (tabla "ContractTemplates") para un país y un tipo.
 *
 * Cada país tiene su plantilla estándar (`tipoContract` NULL) y puede tener otras
 * por tipo (hoy 'Canje'). El tipo sale de `PEOPLE.tipoContrato` del titular:
 * NULL = estándar, 'CANJE' = canje. Un contrato estándar NUNCA toma una plantilla
 * con tipo, y uno de canje NUNCA cae a la estándar (devuelve null).
 * Única forma de buscar la plantilla: no volver a escribir el SELECT a mano.
 */
export async function buscarPlantillaContrato(
  plataforma: string | null | undefined,
  tipoContrato?: string | null,
): Promise<string | null> {
  if (!plataforma) return null;
  const tipo = String(tipoContrato || '').trim() || null;
  const row = await queryOne<{ template: string }>(
    `SELECT "template" FROM "ContractTemplates"
      WHERE LOWER(TRIM("plataforma")) = LOWER(TRIM($1))
        AND CASE WHEN $2::text IS NULL THEN "tipoContract" IS NULL
                 ELSE LOWER(TRIM("tipoContract")) = LOWER($2) END
      ORDER BY ("plataforma" = $1) DESC
      LIMIT 1`,
    [plataforma, tipo],
  );
  return row?.template || null;
}
