/**
 * Backfill del campo `plan` en PEOPLE, FINANCIEROS y PAGOS_TITULARES
 * usando los valores canónicos:
 *   '1'                                  → 'Contado'
 *   '2','3','4','12','13','14'           → 'Credito'
 *   '100'                                → 'Colaborador'
 *   '0', NULL, otros valores no listados → se dejan quietos (revisión manual)
 *   'Contado'/'Credito'/'Colaborador'    → no se tocan (idempotente)
 *
 * Para FINANCIEROS (columna recién agregada, todas NULL), también propaga
 * desde PEOPLE.plan por contrato cuando el titular ya quedó normalizado.
 *
 * Genera dos CSVs:
 *   - plan-actualizados.csv         (todo lo que se actualizó)
 *   - plan-pendiente-revision.csv   (filas que quedan en NULL/'0' u otros valores no canónicos)
 *
 * Modos:
 *   node scripts/backfill-plan-text.js           → dry-run (cuenta)
 *   node scripts/backfill-plan-text.js --apply   → ejecuta UPDATE
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

const CONTADO_VALUES     = new Set(['1']);
const CREDITO_VALUES     = new Set(['2', '3', '4', '12', '13', '14']);
const COLABORADOR_VALUES = new Set(['100']);
const CANONICAL          = new Set(['Contado', 'Credito', 'Colaborador']);

function normalizePlan(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  if (CANONICAL.has(s)) return s; // ya canónico
  if (CONTADO_VALUES.has(s))     return 'Contado';
  if (CREDITO_VALUES.has(s))     return 'Credito';
  if (COLABORADOR_VALUES.has(s)) return 'Colaborador';
  return null; // valor desconocido → revisión manual
}

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
  const actualizados = []; // {tabla, id, contrato, planAnterior, planNuevo}
  const pendientes = [];   // {tabla, id, contrato, planActual, motivo}

  try {
    console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

    // ── PEOPLE ────────────────────────────────────────────────────────
    const peopleRows = await pool.query(
      `SELECT "_id", "contrato", "tipoUsuario", "plan",
              ("primerNombre" || ' ' || COALESCE("primerApellido", '')) AS nombre
       FROM "PEOPLE"
       WHERE "plan" IS DISTINCT FROM '' AND "plan" IS NOT NULL
          OR "tipoUsuario" = 'TITULAR'`
    );
    let peopleUpdates = 0;
    for (const r of peopleRows.rows) {
      const target = normalizePlan(r.plan);
      if (target === null && r.plan !== null) {
        pendientes.push({
          tabla: 'PEOPLE', id: r._id, contrato: r.contrato, nombre: r.nombre,
          tipoUsuario: r.tipoUsuario, planActual: r.plan,
          motivo: r.plan === '0' ? 'plan=0 (atípico)' : 'valor no canónico',
        });
        continue;
      }
      if (r.plan === null) {
        pendientes.push({
          tabla: 'PEOPLE', id: r._id, contrato: r.contrato, nombre: r.nombre,
          tipoUsuario: r.tipoUsuario, planActual: null,
          motivo: 'NULL — revisión manual',
        });
        continue;
      }
      if (target === r.plan) continue; // ya canónico
      // Actualizar
      if (APPLY) {
        await pool.query(`UPDATE "PEOPLE" SET "plan" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`, [target, r._id]);
      }
      peopleUpdates++;
      actualizados.push({
        tabla: 'PEOPLE', id: r._id, contrato: r.contrato, nombre: r.nombre,
        tipoUsuario: r.tipoUsuario, planAnterior: r.plan, planNuevo: target,
      });
    }
    console.log(`PEOPLE: ${peopleUpdates} ${APPLY ? 'actualizados' : 'a actualizar'}`);

    // ── PAGOS_TITULARES ───────────────────────────────────────────────
    const pagosRows = await pool.query(
      `SELECT pt."_id", pt."idPeople", pt."plan", pt."numCuota",
              p."contrato" AS contrato,
              (p."primerNombre" || ' ' || COALESCE(p."primerApellido", '')) AS nombre
       FROM "PAGOS_TITULARES" pt
       LEFT JOIN "PEOPLE" p ON p."_id" = pt."idPeople"
       WHERE pt."plan" IS NOT NULL`
    );
    let pagosUpdates = 0;
    for (const r of pagosRows.rows) {
      const target = normalizePlan(r.plan);
      if (target === null) {
        pendientes.push({
          tabla: 'PAGOS_TITULARES', id: r._id, contrato: r.contrato, nombre: r.nombre,
          tipoUsuario: `cuota#${r.numCuota}`, planActual: r.plan,
          motivo: r.plan === '0' ? 'plan=0 (atípico)' : 'valor no canónico',
        });
        continue;
      }
      if (target === r.plan) continue;
      if (APPLY) {
        await pool.query(`UPDATE "PAGOS_TITULARES" SET "plan" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`, [target, r._id]);
      }
      pagosUpdates++;
      actualizados.push({
        tabla: 'PAGOS_TITULARES', id: r._id, contrato: r.contrato, nombre: r.nombre,
        tipoUsuario: `cuota#${r.numCuota}`, planAnterior: r.plan, planNuevo: target,
      });
    }
    console.log(`PAGOS_TITULARES: ${pagosUpdates} ${APPLY ? 'actualizados' : 'a actualizar'}`);

    // ── FINANCIEROS ───────────────────────────────────────────────────
    // Columna recién agregada → todas NULL. Propagar desde PEOPLE.plan
    // del TITULAR por contrato. Solo donde el TITULAR ya tiene un valor canónico.
    let finUpdates = 0;
    if (APPLY) {
      const r = await pool.query(
        `UPDATE "FINANCIEROS" f
         SET "plan" = src."plan", "_updatedDate" = NOW()
         FROM (
           SELECT DISTINCT ON ("contrato") "contrato", "plan"
           FROM "PEOPLE"
           WHERE "tipoUsuario" = 'TITULAR'
             AND "plan" IN ('Contado', 'Credito', 'Colaborador')
           ORDER BY "contrato", "_updatedDate" DESC NULLS LAST
         ) src
         WHERE f."contrato" = src."contrato"
           AND (f."plan" IS NULL OR f."plan" = '')`
      );
      finUpdates = r.rowCount ?? 0;
    } else {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS n
         FROM "FINANCIEROS" f
         JOIN "PEOPLE" p ON p."contrato" = f."contrato" AND p."tipoUsuario" = 'TITULAR'
           AND p."plan" IN ('1', '2', '3', '4', '12', '13', '14', '100', 'Contado', 'Credito', 'Colaborador')
         WHERE f."plan" IS NULL OR f."plan" = ''`
      );
      finUpdates = r.rows[0].n;
    }
    console.log(`FINANCIEROS: ${finUpdates} ${APPLY ? 'actualizados' : 'a propagar desde PEOPLE.plan'}`);

    // ── CSVs ──────────────────────────────────────────────────────────
    console.log(`\n=== CSVs ===`);
    writeCsv('plan-actualizados.csv',
      ['tabla', 'id', 'contrato', 'nombre', 'tipoUsuario', 'planAnterior', 'planNuevo'],
      actualizados
    );
    writeCsv('plan-pendiente-revision.csv',
      ['tabla', 'id', 'contrato', 'nombre', 'tipoUsuario', 'planActual', 'motivo'],
      pendientes
    );

    console.log(`\nResumen:`);
    console.log(`  Total actualizables: ${actualizados.length} (PEOPLE: ${peopleUpdates}, PAGOS_TITULARES: ${pagosUpdates}, FINANCIEROS: ${finUpdates})`);
    console.log(`  Pendientes revisión: ${pendientes.length}`);

    if (!APPLY) {
      console.log(`\nDry-run. Para aplicar:\n  node scripts/backfill-plan-text.js --apply`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
