/**
 * Recaudos plataforma scope helper.
 *
 * Define qué plataformas puede VER un usuario de Recaudos en función de su
 * `USUARIOS_ROLES.plataforma` y su rol. Es el filtro multi-tenancy del módulo:
 *
 *   SUPER_ADMIN / ADMIN                       → ven todo
 *   USUARIOS_ROLES.plataforma IS NULL         → ven todo (backward-compat)
 *   USUARIOS_ROLES.plataforma = 'Internacional' → ven todo
 *   USUARIOS_ROLES.plataforma = 'Chile'       → solo 'Chile' (aislado)
 *   USUARIOS_ROLES.plataforma = 'Colombia'    → todas EXCEPTO 'Chile'
 *   Otra plataforma (Ecuador, Perú, etc.)     → solo su propia plataforma
 *
 * El match contra los valores de `PEOPLE.plataforma` / `USUARIOS_ROLES.plataforma`
 * es case-insensitive (`LOWER = LOWER`) para tolerar variantes legacy.
 *
 * Reglas resueltas en SQL via `buildPlataformaWhereSql()`:
 *   - include[]: `LOWER(col) = ANY($N::text[])`
 *   - exclude[]: `col IS NULL OR LOWER(col) <> ALL($N::text[])`
 *     (NULL se considera "fuera de Chile" → visible para jefe Colombia)
 */
import 'server-only';
import { queryOne } from '@/lib/postgres';

export interface PlataformaScope {
  /** null → no aplica filtro (ve todo); objeto → restringe */
  filter: null | { type: 'include' | 'exclude'; values: string[] };
}

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'admin']);

/**
 * Calcula el scope de plataforma para un usuario de Recaudos.
 *
 * @param role        rol exacto del usuario (`session.user.role`)
 * @param plataforma  valor `USUARIOS_ROLES.plataforma` del usuario
 */
export function computePlataformaScope(
  role: string | null | undefined,
  plataforma: string | null | undefined,
): PlataformaScope {
  if (ADMIN_ROLES.has((role || '').toString())) {
    return { filter: null };
  }
  if (!plataforma) {
    // Backward-compat: jefes sin plataforma asignada ven todo
    return { filter: null };
  }
  const p = plataforma.trim().toLowerCase();
  if (!p) return { filter: null };
  if (p === 'internacional') return { filter: null };
  if (p === 'chile')         return { filter: { type: 'include', values: ['chile'] } };
  if (p === 'colombia')      return { filter: { type: 'exclude', values: ['chile'] } };
  // Otros (Ecuador, Perú, etc.) → solo su propia plataforma
  return { filter: { type: 'include', values: [p] } };
}

/**
 * Resuelve la plataforma de un usuario por email desde USUARIOS_ROLES.
 * Retorna null si el usuario no existe en la tabla o no tiene plataforma.
 */
export async function getSessionPlataforma(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const row = await queryOne<{ plataforma: string | null }>(
    `SELECT "plataforma" FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER($1) LIMIT 1`,
    [email],
  );
  return row?.plataforma ?? null;
}

/**
 * Construye un fragmento SQL `AND ...` que aplica el scope sobre la columna
 * indicada. Devuelve `{ sql: '', params: [] }` cuando no hay filtro.
 *
 * @param scope            scope calculado por `computePlataformaScope`
 * @param colExpr          expresión SQL para la columna (ej `p."plataforma"`)
 * @param paramStartIndex  próximo `$N` disponible en la query
 */
export function buildPlataformaWhereSql(
  scope: PlataformaScope,
  colExpr: string,
  paramStartIndex: number,
): { sql: string; params: any[] } {
  if (!scope.filter) return { sql: '', params: [] };
  if (scope.filter.type === 'include') {
    return {
      sql: ` AND LOWER(${colExpr}) = ANY($${paramStartIndex}::text[])`,
      params: [scope.filter.values],
    };
  }
  // exclude — incluye NULL como "fuera del set excluido"
  return {
    sql: ` AND (${colExpr} IS NULL OR LOWER(${colExpr}) <> ALL($${paramStartIndex}::text[]))`,
    params: [scope.filter.values],
  };
}
