import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany, queryOne } from '@/lib/postgres';
import { ForbiddenError, ValidationError } from '@/lib/errors';

const BATCH_SIZE = 2000;

/**
 * Whitelist of tables allowed for sync operations.
 */
const ALLOWED_TABLES = new Set([
  'ACADEMICA',
  'ACADEMICA_BOOKINGS',
  'PEOPLE',
  'CALENDARIO',
  'ADVISORS',
  'FINANCIEROS',
  'USUARIOS_ROLES',
  'NIVELES',
  'STEP_OVERRIDES',
]);

function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function validateTable(name: string, label: string) {
  if (!name) throw new ValidationError(`${label} es requerido`);
  if (!isValidIdentifier(name)) throw new ValidationError(`${label} contiene caracteres inválidos`);
  if (!ALLOWED_TABLES.has(name)) throw new ValidationError(`${label} "${name}" no está permitido. Tablas válidas: ${[...ALLOWED_TABLES].join(', ')}`);
}

function validateField(name: string, label: string) {
  if (!name) throw new ValidationError(`${label} es requerido`);
  if (!isValidIdentifier(name)) throw new ValidationError(`${label} "${name}" contiene caracteres inválidos`);
}

/**
 * POST /api/admin/sync-field
 *
 * Generic field sync — two modes:
 *
 * ── MODE 1: Cross-table sync (sourceTable ≠ targetTable) ──────────────────
 * Copies `field` from sourceTable into targetTable via a JOIN on key fields.
 * {
 *   sourceTable:  string     — table to read from        (e.g. "ACADEMICA")
 *   targetTable:  string     — table to write to         (e.g. "ACADEMICA_BOOKINGS")
 *   field:        string     — field to sync             (e.g. "plataforma")
 *   sourceKey:    string     — join key in sourceTable   (e.g. "_id")
 *   targetKeys:   string[]   — join keys in targetTable  (e.g. ["studentId","idEstudiante"])
 *   overwrite?:   boolean    — also update non-empty rows (default: false)
 * }
 *
 * ── MODE 2: Same-table field copy (sourceTable === targetTable) ────────────
 * Copies `sourceField` into `field` within the same table, row by row.
 * {
 *   sourceTable:  string     — same as targetTable       (e.g. "ACADEMICA_BOOKINGS")
 *   targetTable:  string     — same as sourceTable       (e.g. "ACADEMICA_BOOKINGS")
 *   field:        string     — destination field         (e.g. "nombreEvento")
 *   sourceField:  string     — source field              (e.g. "step")
 *   overwrite?:   boolean    — also update non-empty rows (default: false)
 * }
 *
 * ── MODE 3: Same-table field concatenation ────────────────────────────────
 * Concatenates multiple fields into `field` within the same table.
 * {
 *   sourceTable:  string     — same as targetTable       (e.g. "ACADEMICA")
 *   targetTable:  string     — same as sourceTable       (e.g. "ACADEMICA")
 *   field:        string     — destination field         (e.g. "tituloONivel")
 *   sourceFields: string[]   — fields to concatenate     (e.g. ["nivel", "step"])
 *   separator?:   string     — separator string          (default: " - ")
 *   overwrite?:   boolean    — also update non-empty rows (default: false)
 * }
 *
 * Restricted to SUPER_ADMIN only.
 */
export const POST = handlerWithAuth(async (request, context, session) => {
  const role = (session?.user as any)?.role;
  if (role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede ejecutar sincronizaciones');
  }

  const body = await request.json();
  const {
    sourceTable,
    targetTable,
    field,
    sourceField,
    sourceFields,
    separator = ' - ',
    sourceKey,
    targetKeys,
    overwrite = false,
  } = body as {
    sourceTable: string;
    targetTable: string;
    field: string;
    sourceField?: string;
    sourceFields?: string[];
    separator?: string;
    sourceKey?: string;
    targetKeys?: string[];
    overwrite?: boolean;
  };

  validateTable(sourceTable, 'sourceTable');
  validateTable(targetTable, 'targetTable');
  validateField(field, 'field');

  const isSameTable = sourceTable === targetTable;

  // ── MODE 3: Same-table field concatenation ────────────────────────────────
  if (isSameTable && Array.isArray(sourceFields) && sourceFields.length > 0) {
    if (sourceFields.length < 2) throw new ValidationError('sourceFields debe tener al menos 2 campos para concatenar');
    for (const f of sourceFields) validateField(f, `sourceField "${f}"`);

    const nullCondition = overwrite ? '' : `AND ("${field}" IS NULL OR "${field}" = '')`;
    const concatExpr = sourceFields.map(f => `"${f}"`).join(`, '${separator.replace(/'/g, "''")}', `);
    const notNullCondition = sourceFields.map(f => `"${f}" IS NOT NULL AND "${f}" != ''`).join(' AND ');

    // Preview
    const preview = await queryMany(`
      SELECT CONCAT_WS('${separator.replace(/'/g, "''")}', ${sourceFields.map(f => `"${f}"`).join(', ')}) AS value, COUNT(*) AS rows
      FROM "${targetTable}"
      WHERE ${notNullCondition}
        ${nullCondition}
      GROUP BY ${sourceFields.map(f => `"${f}"`).join(', ')}
      ORDER BY rows DESC
      LIMIT 50
    `);

    const totalToUpdate = preview.reduce((sum: number, r: any) => sum + parseInt(r.rows), 0);

    if (totalToUpdate === 0) {
      return successResponse({
        message: 'No hay registros que actualizar — ya están sincronizados',
        updatedCount: 0,
        byValue: [],
      });
    }

    let totalUpdated = 0;
    let batchCount = 0;

    while (true) {
      const result = await queryOne<{ updated: string }>(`
        WITH batch AS (
          SELECT "_id"
          FROM "${targetTable}"
          WHERE ${notNullCondition}
            ${nullCondition}
          LIMIT ${BATCH_SIZE}
        ),
        updated AS (
          UPDATE "${targetTable}" t
          SET "${field}" = CONCAT_WS('${separator.replace(/'/g, "''")}', ${sourceFields.map(f => `t."${f}"`).join(', ')}),
              "_updatedDate" = NOW()
          FROM batch
          WHERE t."_id" = batch."_id"
          RETURNING 1
        )
        SELECT COUNT(*) AS updated FROM updated
      `);

      const n = parseInt((result as any)?.updated ?? '0');
      totalUpdated += n;
      batchCount++;
      if (n < BATCH_SIZE) break;
    }

    return successResponse({
      message: `Sincronización completada: ${totalUpdated} registros actualizados en ${batchCount} lote(s)`,
      updatedCount: totalUpdated,
      batches: batchCount,
      mode: 'concat',
      table: targetTable,
      sourceFields,
      separator,
      targetField: field,
      overwrite,
      byValue: preview,
    });
  }

  // ── MODE 2: Same-table field copy ─────────────────────────────────────────
  if (isSameTable) {
    if (!sourceField) throw new ValidationError('sourceField es requerido cuando sourceTable === targetTable');
    validateField(sourceField, 'sourceField');

    const nullCondition = overwrite ? '' : `AND ("${field}" IS NULL OR "${field}" = '')`;

    // Preview
    const preview = await queryMany(`
      SELECT "${sourceField}" AS value, COUNT(*) AS rows
      FROM "${targetTable}"
      WHERE "${sourceField}" IS NOT NULL AND "${sourceField}" != ''
        ${nullCondition}
      GROUP BY "${sourceField}"
      ORDER BY rows DESC
      LIMIT 50
    `);

    const totalToUpdate = preview.reduce((sum: number, r: any) => sum + parseInt(r.rows), 0);

    if (totalToUpdate === 0) {
      return successResponse({
        message: 'No hay registros que actualizar — ya están sincronizados',
        updatedCount: 0,
        byValue: [],
      });
    }

    // Update in batches
    let totalUpdated = 0;
    let batchCount = 0;

    while (true) {
      const result = await queryOne<{ updated: string }>(`
        WITH batch AS (
          SELECT "_id"
          FROM "${targetTable}"
          WHERE "${sourceField}" IS NOT NULL AND "${sourceField}" != ''
            ${nullCondition}
          LIMIT ${BATCH_SIZE}
        ),
        updated AS (
          UPDATE "${targetTable}" t
          SET "${field}" = t2."${sourceField}",
              "_updatedDate" = NOW()
          FROM "${targetTable}" t2, batch
          WHERE t."_id" = batch."_id" AND t2."_id" = batch."_id"
          RETURNING 1
        )
        SELECT COUNT(*) AS updated FROM updated
      `);

      const n = parseInt((result as any)?.updated ?? '0');
      totalUpdated += n;
      batchCount++;
      if (n < BATCH_SIZE) break;
    }

    return successResponse({
      message: `Sincronización completada: ${totalUpdated} registros actualizados en ${batchCount} lote(s)`,
      updatedCount: totalUpdated,
      batches: batchCount,
      mode: 'same-table',
      table: targetTable,
      sourceField,
      targetField: field,
      overwrite,
      byValue: preview,
    });
  }

  // ── MODE 1: Cross-table sync ───────────────────────────────────────────────
  if (!sourceKey) throw new ValidationError('sourceKey es requerido para sync entre tablas distintas');
  if (!Array.isArray(targetKeys) || targetKeys.length === 0) {
    throw new ValidationError('targetKeys debe ser un array con al menos un elemento');
  }
  validateField(sourceKey, 'sourceKey');
  for (const k of targetKeys) validateField(k, `targetKey "${k}"`);

  const joinCondition = targetKeys.map(k => `t."${k}" = s."${sourceKey}"`).join(' OR ');
  const nullCondition = overwrite ? '' : `AND (t."${field}" IS NULL OR t."${field}" = '')`;

  const preview = await queryMany(`
    SELECT s."${field}" AS value, COUNT(*) AS rows
    FROM "${targetTable}" t
    JOIN "${sourceTable}" s ON (${joinCondition})
    WHERE s."${field}" IS NOT NULL AND s."${field}" != ''
      ${nullCondition}
    GROUP BY s."${field}"
    ORDER BY rows DESC
    LIMIT 50
  `);

  const totalToUpdate = preview.reduce((sum: number, r: any) => sum + parseInt(r.rows), 0);

  if (totalToUpdate === 0) {
    return successResponse({
      message: 'No hay registros que actualizar — ya están sincronizados',
      updatedCount: 0,
      byValue: [],
    });
  }

  let totalUpdated = 0;
  let batchCount = 0;

  while (true) {
    const result = await queryOne<{ updated: string }>(`
      WITH batch AS (
        SELECT t."_id"
        FROM "${targetTable}" t
        JOIN "${sourceTable}" s ON (${joinCondition})
        WHERE s."${field}" IS NOT NULL AND s."${field}" != ''
          ${nullCondition}
        LIMIT ${BATCH_SIZE}
      ),
      updated AS (
        UPDATE "${targetTable}" t
        SET "${field}" = s."${field}",
            "_updatedDate" = NOW()
        FROM "${sourceTable}" s, batch
        WHERE t."_id" = batch."_id"
          AND (${joinCondition})
        RETURNING 1
      )
      SELECT COUNT(*) AS updated FROM updated
    `);

    const n = parseInt((result as any)?.updated ?? '0');
    totalUpdated += n;
    batchCount++;
    if (n < BATCH_SIZE) break;
  }

  return successResponse({
    message: `Sincronización completada: ${totalUpdated} registros actualizados en ${batchCount} lote(s)`,
    updatedCount: totalUpdated,
    batches: batchCount,
    mode: 'cross-table',
    sourceTable,
    targetTable,
    field,
    overwrite,
    byValue: preview,
  });
});
