import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany, queryOne } from '@/lib/postgres';
import { ForbiddenError, ValidationError } from '@/lib/errors';

const BATCH_SIZE = 2000;

/**
 * Whitelist of tables and fields allowed for sync operations.
 * Prevents SQL injection by rejecting any name not in this list.
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

/** Validates that a SQL identifier only contains safe characters */
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
 * Generic field sync between two tables.
 * Copies a field from sourceTable into targetTable where the join keys match.
 * Only updates rows in targetTable that currently have null/empty value for the field.
 *
 * Body:
 * {
 *   sourceTable:  string          — table to read from (e.g. "ACADEMICA")
 *   targetTable:  string          — table to write to (e.g. "ACADEMICA_BOOKINGS")
 *   field:        string          — field name to sync (e.g. "plataforma")
 *   sourceKey:    string          — join key in sourceTable (e.g. "_id")
 *   targetKeys:   string[]        — one or more join keys in targetTable (OR condition)
 *                                   e.g. ["studentId", "idEstudiante"]
 *   overwrite?:   boolean         — if true, also update rows that already have a value
 *                                   (default: false — only fills null/empty)
 * }
 *
 * Restricted to SUPER_ADMIN only.
 *
 * Example — sync plataforma from ACADEMICA to ACADEMICA_BOOKINGS:
 * {
 *   sourceTable: "ACADEMICA",
 *   targetTable: "ACADEMICA_BOOKINGS",
 *   field: "plataforma",
 *   sourceKey: "_id",
 *   targetKeys: ["studentId", "idEstudiante"]
 * }
 *
 * Example — sync nivel from ACADEMICA to PEOPLE (by numeroId):
 * {
 *   sourceTable: "ACADEMICA",
 *   targetTable: "PEOPLE",
 *   field: "nivel",
 *   sourceKey: "numeroId",
 *   targetKeys: ["numeroId"]
 * }
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
    sourceKey,
    targetKeys,
    overwrite = false,
  }: {
    sourceTable: string;
    targetTable: string;
    field: string;
    sourceKey: string;
    targetKeys: string[];
    overwrite?: boolean;
  } = body;

  // Validate all inputs
  validateTable(sourceTable, 'sourceTable');
  validateTable(targetTable, 'targetTable');
  validateField(field, 'field');
  validateField(sourceKey, 'sourceKey');

  if (!Array.isArray(targetKeys) || targetKeys.length === 0) {
    throw new ValidationError('targetKeys debe ser un array con al menos un elemento');
  }
  for (const k of targetKeys) validateField(k, `targetKey "${k}"`);

  // Build the JOIN condition: t.targetKey1 = s.sourceKey OR t.targetKey2 = s.sourceKey ...
  const joinCondition = targetKeys
    .map(k => `t."${k}" = s."${sourceKey}"`)
    .join(' OR ');

  // Condition to only update null/empty rows (unless overwrite=true)
  const nullCondition = overwrite
    ? ''
    : `AND (t."${field}" IS NULL OR t."${field}" = '')`;

  // 1. Preview: count + breakdown by value
  const preview = await queryMany(`
    SELECT s."${field}" AS value, COUNT(*) AS rows
    FROM "${targetTable}" t
    JOIN "${sourceTable}" s ON (${joinCondition})
    WHERE s."${field}" IS NOT NULL AND s."${field}" != ''
      ${nullCondition}
    GROUP BY s."${field}"
    ORDER BY rows DESC
  `);

  const totalToUpdate = preview.reduce((sum: number, r: any) => sum + parseInt(r.rows), 0);

  if (totalToUpdate === 0) {
    return successResponse({
      message: 'No hay registros que actualizar — ya están sincronizados',
      updatedCount: 0,
      byValue: [],
    });
  }

  // 2. Update in batches to avoid connection timeouts
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
    sourceTable,
    targetTable,
    field,
    overwrite,
    byValue: preview,
  });
});
