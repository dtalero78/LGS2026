/**
 * SQL Query Builder Utilities
 *
 * Helpers for building dynamic UPDATE and WHERE clauses with parameterized queries.
 * Replaces the manually-built dynamic query patterns found in 10+ route handlers.
 */

import 'server-only';

/**
 * Build a dynamic UPDATE query from a request body and allowed fields whitelist.
 *
 * Returns null if no valid fields are found in the body.
 * Always adds "_updatedDate" = NOW() to the update.
 *
 * Usage:
 *   const result = buildDynamicUpdate('PEOPLE', body, ['primerNombre', 'email']);
 *   if (!result) throw new ValidationError('No valid fields to update');
 *   result.values.push(personId);
 *   await queryOne(result.query, result.values);
 *
 * @param table - Table name without quotes (e.g., 'PEOPLE')
 * @param body - Request body with field values
 * @param allowedFields - Whitelist of fields that can be updated
 * @param idColumn - Column name for the WHERE clause (default: '_id')
 */
export function buildDynamicUpdate(
  table: string,
  body: Record<string, any>,
  allowedFields: string[],
  idColumn: string = '_id'
): { query: string; values: any[]; fieldCount: number } | null {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates.push(`"${field}" = $${paramIndex}`);
      values.push(body[field]);
      paramIndex++;
    }
  }

  if (updates.length === 0) return null;

  // Always update the timestamp
  updates.push(`"_updatedDate" = NOW()`);

  const query = `
    UPDATE "${table}"
    SET ${updates.join(', ')}
    WHERE "${idColumn}" = $${paramIndex}
    RETURNING *
  `;

  return { query, values, fieldCount: updates.length - 1 };
}

/**
 * Filter definition for building WHERE clauses
 */
export interface WhereFilter {
  /** Column name without quotes */
  field: string;
  /** Value to compare against. null/undefined filters are skipped */
  value: any;
  /** Comparison operator (default: '=') */
  operator?: '=' | 'LIKE' | 'ILIKE' | '>=' | '<=' | '>' | '<' | '!=' | 'ANY';
  /** PostgreSQL type cast (e.g., '::timestamp', '::text[]') */
  cast?: string;
}

/**
 * Build a dynamic WHERE clause from an array of filters.
 * Filters with null/undefined values are automatically skipped.
 *
 * Usage:
 *   const { clause, values } = buildDynamicWhere([
 *     { field: 'tipo', value: tipo },
 *     { field: 'dia', value: startDate, operator: '>=', cast: '::timestamp' },
 *     { field: 'advisor', value: advisor, operator: 'ILIKE' },
 *   ]);
 *   const sql = `SELECT * FROM "CALENDARIO" ${clause} ORDER BY "dia"`;
 *   const rows = await queryMany(sql, values);
 *
 * @param filters - Array of filter definitions
 * @param startParamIndex - Starting $N parameter index (default: 1)
 */
export function buildDynamicWhere(
  filters: WhereFilter[],
  startParamIndex: number = 1
): { clause: string; values: any[]; nextParamIndex: number } {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = startParamIndex;

  for (const filter of filters) {
    if (filter.value === undefined || filter.value === null) continue;

    const op = filter.operator || '=';
    const cast = filter.cast || '';

    if (op === 'ILIKE') {
      conditions.push(`"${filter.field}" ILIKE $${paramIndex}${cast}`);
    } else if (op === 'LIKE') {
      conditions.push(`LOWER("${filter.field}") LIKE LOWER($${paramIndex}${cast})`);
    } else {
      conditions.push(`"${filter.field}" ${op} $${paramIndex}${cast}`);
    }

    values.push(filter.value);
    paramIndex++;
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, values, nextParamIndex: paramIndex };
}
