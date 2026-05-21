/**
 * Sólo lectura. Verifica que los registros de PEOPLE con `finalContrato` menor
 * a 2026-05-19 (vencidos) tengan estado=FINALIZADA y aprobacion=FINALIZADA.
 *
 * Reporta:
 *   - Total vencidos
 *   - Cuántos tienen estado=FINALIZADA correctamente
 *   - Cuántos tienen aprobacion=FINALIZADA correctamente
 *   - Casos inconsistentes (vencidos pero NO marcados como FINALIZADA)
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const CUTOFF = '2026-05-19';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // ── Resumen general ───────────────────────────────────────────────
    const resumen = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN "estado" = 'FINALIZADA' THEN 1 ELSE 0 END)::int AS estado_finalizada,
        SUM(CASE WHEN "aprobacion" = 'FINALIZADA' THEN 1 ELSE 0 END)::int AS aprobacion_finalizada,
        SUM(CASE WHEN "estado" = 'FINALIZADA' AND "aprobacion" = 'FINALIZADA' THEN 1 ELSE 0 END)::int AS ambas_finalizadas,
        SUM(CASE WHEN "estadoInactivo" = true THEN 1 ELSE 0 END)::int AS estadoinactivo_true
      FROM "PEOPLE"
      WHERE "finalContrato" IS NOT NULL
        AND "finalContrato" < $1::date
    `, [CUTOFF]);

    const r = resumen.rows[0];
    console.log(`\n=== PEOPLE con finalContrato < ${CUTOFF} ===\n`);
    console.log(`Total vencidos:                          ${r.total}`);
    console.log(`Con estado='FINALIZADA':                 ${r.estado_finalizada}  (${pct(r.estado_finalizada, r.total)}%)`);
    console.log(`Con aprobacion='FINALIZADA':             ${r.aprobacion_finalizada}  (${pct(r.aprobacion_finalizada, r.total)}%)`);
    console.log(`Ambas FINALIZADA (estado + aprobacion):  ${r.ambas_finalizadas}  (${pct(r.ambas_finalizadas, r.total)}%)`);
    console.log(`Con estadoInactivo=true:                 ${r.estadoinactivo_true}  (${pct(r.estadoinactivo_true, r.total)}%)`);

    // ── Distribución por estado (vencidos) ───────────────────────────
    const porEstado = await pool.query(`
      SELECT COALESCE("estado", '(NULL)') AS estado, COUNT(*)::int AS n
      FROM "PEOPLE"
      WHERE "finalContrato" IS NOT NULL
        AND "finalContrato" < $1::date
      GROUP BY "estado"
      ORDER BY n DESC
    `, [CUTOFF]);
    console.log(`\n=== Distribución por "estado" ===`);
    porEstado.rows.forEach(row => console.log(`  ${row.estado.padEnd(20)} ${row.n}`));

    // ── Distribución por aprobacion (vencidos) ───────────────────────
    const porAprob = await pool.query(`
      SELECT COALESCE("aprobacion", '(NULL)') AS aprobacion, COUNT(*)::int AS n
      FROM "PEOPLE"
      WHERE "finalContrato" IS NOT NULL
        AND "finalContrato" < $1::date
      GROUP BY "aprobacion"
      ORDER BY n DESC
    `, [CUTOFF]);
    console.log(`\n=== Distribución por "aprobacion" ===`);
    porAprob.rows.forEach(row => console.log(`  ${row.aprobacion.padEnd(20)} ${row.n}`));

    // ── Inconsistentes: vencidos pero NO FINALIZADA ───────────────────
    const inconsistentes = await pool.query(`
      SELECT
        "_id", "numeroId", "primerNombre", "primerApellido",
        "tipoUsuario", "contrato",
        TO_CHAR("finalContrato", 'YYYY-MM-DD') AS final_contrato,
        "estado", "aprobacion", "estadoInactivo", "plataforma"
      FROM "PEOPLE"
      WHERE "finalContrato" IS NOT NULL
        AND "finalContrato" < $1::date
        AND ("estado" IS DISTINCT FROM 'FINALIZADA' OR "aprobacion" IS DISTINCT FROM 'FINALIZADA')
      ORDER BY "finalContrato" DESC NULLS LAST, "primerApellido" NULLS LAST
    `, [CUTOFF]);

    console.log(`\n=== Inconsistentes (vencidos pero alguno de los dos campos NO es FINALIZADA): ${inconsistentes.rowCount} ===\n`);
    if (inconsistentes.rowCount > 0) {
      const muestra = inconsistentes.rows.slice(0, 30);
      muestra.forEach(row => {
        const nom = `${row.primerNombre || ''} ${row.primerApellido || ''}`.trim().padEnd(32);
        const tipo = (row.tipoUsuario || '').padEnd(13);
        const est = (row.estado || '(NULL)').padEnd(15);
        const apr = (row.aprobacion || '(NULL)').padEnd(15);
        const inact = row.estadoInactivo === true ? 'INACT' : 'activ';
        console.log(`  ${nom} | ${tipo} | final=${row.final_contrato} | estado=${est} | aprobacion=${apr} | ${inact} | ${row.contrato || ''}`);
      });
      if (inconsistentes.rowCount > 30) {
        console.log(`  ... y ${inconsistentes.rowCount - 30} más`);
      }
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

function pct(n, total) {
  if (!total) return '0.0';
  return ((n / total) * 100).toFixed(1);
}
