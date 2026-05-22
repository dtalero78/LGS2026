/**
 * Backfill complementario:
 *   Para cada contrato en FINANCIEROS con numeroCuotas > 1,
 *   marcar PEOPLE.plan = 'Credito' a TITULAR + BENEFICIARIOS
 *   donde plan IS NULL o vacío (no sobrescribe valores existentes).
 *
 * Idempotente — sólo toca filas vacías. Si quieres sobrescribir
 * valores existentes (Contado/Colaborador) usar flag --override.
 *
 * Genera CSV de afectados.
 *
 * Modos:
 *   node scripts/backfill-plan-credito-by-cuotas.js              → dry-run
 *   node scripts/backfill-plan-credito-by-cuotas.js --apply      → ejecuta (solo vacíos)
 *   node scripts/backfill-plan-credito-by-cuotas.js --apply --override → ejecuta y sobrescribe
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const OVERRIDE = process.argv.includes('--override');

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(filename, headers, rows) {
  const filepath = path.join(process.cwd(), filename);
  const lines = [headers.join(';')];
  for (const r of rows) lines.push(headers.map(h => csvEscape(r[h])).join(';'));
  fs.writeFileSync(filepath, '﻿' + lines.join('\n'), 'utf8');
  console.log(`  ✓ ${filename} (${rows.length} filas)`);
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}${OVERRIDE ? ' --override' : ''}\n`);

    // Preview: filas que serían afectadas
    const filtroExistente = OVERRIDE
      ? `1=1`  // sin filtro: incluye todos
      : `(p."plan" IS NULL OR p."plan" = '')`;

    const preview = await pool.query(`
      SELECT
        p."_id",
        p."tipoUsuario",
        p."contrato",
        p."numeroId",
        p."plan" AS plan_actual,
        f."numeroCuotas",
        TRIM(p."primerNombre" || ' ' || COALESCE(p."primerApellido", '')) AS nombre
      FROM "FINANCIEROS" f
      JOIN "PEOPLE" p ON p."contrato" = f."contrato"
      WHERE f."numeroCuotas" IS NOT NULL
        AND CAST(f."numeroCuotas" AS INTEGER) > 1
        AND ${filtroExistente}
      ORDER BY p."contrato", p."tipoUsuario" DESC
    `);

    console.log(`Filas afectadas: ${preview.rowCount}`);

    if (preview.rowCount > 0) {
      // Distribución por rol — usa la key exacta que devuelve pg (camelCase preservado)
      const porRol = preview.rows.reduce((acc, r) => {
        const k = r.tipoUsuario || 'NULL';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      console.log('Distribución por tipoUsuario:', porRol);

      // Estado previo de plan
      const porPlanActual = preview.rows.reduce((acc, r) => {
        const k = r.plan_actual || '(NULL/vacío)';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      console.log('Estado previo del plan:', porPlanActual);

      writeCsv('plan-credito-by-cuotas.csv',
        ['contrato', 'tipoUsuario', 'numeroId', 'nombre', 'plan_actual', 'numeroCuotas'],
        preview.rows.map(r => ({
          contrato: r.contrato,
          tipoUsuario: r.tipoUsuario,
          numeroId: r.numeroId,
          nombre: r.nombre,
          plan_actual: r.plan_actual,
          numeroCuotas: r.numeroCuotas,
        }))
      );
    }

    if (APPLY && preview.rowCount > 0) {
      const upd = await pool.query(`
        UPDATE "PEOPLE" p
        SET "plan" = 'Credito', "_updatedDate" = NOW()
        FROM "FINANCIEROS" f
        WHERE p."contrato" = f."contrato"
          AND f."numeroCuotas" IS NOT NULL
          AND CAST(f."numeroCuotas" AS INTEGER) > 1
          AND ${filtroExistente.replace(/p\./g, 'p.')}
      `);
      console.log(`\n✓ ${upd.rowCount} filas PEOPLE actualizadas a plan='Credito'`);
    } else if (!APPLY) {
      console.log(`\nDry-run. Para aplicar:\n  node scripts/backfill-plan-credito-by-cuotas.js --apply`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
