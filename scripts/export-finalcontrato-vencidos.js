/**
 * Sólo lectura. Exporta a CSV los registros de PEOPLE con `finalContrato`
 * menor a 2026-05-19 (vencidos), con sus campos de estado/aprobacion para
 * revisión manual.
 *
 * Genera dos archivos:
 *   - finalcontrato-vencidos-todos.csv       (3677 filas — todos los vencidos)
 *   - finalcontrato-vencidos-inconsistentes.csv  (vencidos sin FINALIZADA en alguno de los campos)
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const CUTOFF = '2026-05-19';

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(filename, headers, rows) {
  const filepath = path.join(process.cwd(), filename);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(','));
  }
  fs.writeFileSync(filepath, '﻿' + lines.join('\n'), 'utf8');
  console.log(`  ✓ ${filename} (${rows.length} filas)`);
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    console.log(`Exportando registros con finalContrato < ${CUTOFF}...\n`);

    // ── Todos los vencidos ─────────────────────────────────────────────
    const todos = await pool.query(`
      SELECT
        "_id"              AS people_id,
        "numeroId"         AS numeroId,
        "primerNombre"     AS primerNombre,
        "primerApellido"   AS primerApellido,
        "tipoUsuario"      AS tipoUsuario,
        "contrato"         AS contrato,
        "plataforma"       AS plataforma,
        TO_CHAR("finalContrato", 'YYYY-MM-DD') AS finalContrato,
        TO_CHAR("fechaContrato", 'YYYY-MM-DD') AS fechaContrato,
        "vigencia"         AS vigencia,
        "estado"           AS estado,
        "aprobacion"       AS aprobacion,
        "estadoInactivo"   AS estadoInactivo,
        "fechaOnHold"      AS fechaOnHold,
        "fechaFinOnHold"   AS fechaFinOnHold,
        "onHoldCount"      AS onHoldCount,
        "extensionCount"   AS extensionCount,
        "email"            AS email,
        "celular"          AS celular
      FROM "PEOPLE"
      WHERE "finalContrato" IS NOT NULL
        AND "finalContrato" < $1::date
      ORDER BY "finalContrato" DESC NULLS LAST, "primerApellido" NULLS LAST, "primerNombre" NULLS LAST
    `, [CUTOFF]);

    writeCsv(
      'finalcontrato-vencidos-todos.csv',
      ['people_id', 'numeroid', 'primernombre', 'primerapellido', 'tipousuario', 'contrato', 'plataforma', 'finalcontrato', 'fechacontrato', 'vigencia', 'estado', 'aprobacion', 'estadoinactivo', 'fechaonhold', 'fechafinonhold', 'onholdcount', 'extensioncount', 'email', 'celular'],
      todos.rows
    );

    // ── Inconsistentes: vencidos pero NO ambos FINALIZADA ──────────────
    const inconsistentes = await pool.query(`
      SELECT
        "_id"              AS people_id,
        "numeroId"         AS numeroId,
        "primerNombre"     AS primerNombre,
        "primerApellido"   AS primerApellido,
        "tipoUsuario"      AS tipoUsuario,
        "contrato"         AS contrato,
        "plataforma"       AS plataforma,
        TO_CHAR("finalContrato", 'YYYY-MM-DD') AS finalContrato,
        "estado"           AS estado,
        "aprobacion"       AS aprobacion,
        "estadoInactivo"   AS estadoInactivo,
        CASE
          WHEN "estado" IS DISTINCT FROM 'FINALIZADA' AND "aprobacion" IS DISTINCT FROM 'FINALIZADA' THEN 'ninguno_finalizada'
          WHEN "estado" IS DISTINCT FROM 'FINALIZADA' THEN 'falta_estado'
          WHEN "aprobacion" IS DISTINCT FROM 'FINALIZADA' THEN 'falta_aprobacion'
          ELSE 'ok'
        END AS diagnostico,
        CASE WHEN "estadoInactivo" IS NOT TRUE THEN 'NO_INACTIVO' ELSE 'inactivo_ok' END AS flag_inactivo,
        "email"            AS email,
        "celular"          AS celular
      FROM "PEOPLE"
      WHERE "finalContrato" IS NOT NULL
        AND "finalContrato" < $1::date
        AND ("estado" IS DISTINCT FROM 'FINALIZADA' OR "aprobacion" IS DISTINCT FROM 'FINALIZADA')
      ORDER BY "finalContrato" DESC NULLS LAST, "primerApellido" NULLS LAST, "primerNombre" NULLS LAST
    `, [CUTOFF]);

    writeCsv(
      'finalcontrato-vencidos-inconsistentes.csv',
      ['people_id', 'numeroid', 'primernombre', 'primerapellido', 'tipousuario', 'contrato', 'plataforma', 'finalcontrato', 'estado', 'aprobacion', 'estadoinactivo', 'diagnostico', 'flag_inactivo', 'email', 'celular'],
      inconsistentes.rows
    );

    console.log('\n✓ Exportación completa. Archivos generados en la raíz del proyecto.');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
