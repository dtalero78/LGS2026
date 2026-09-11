#!/usr/bin/env node
/**
 * normalize-aprobacion-finalizada.js — restaura PEOPLE.aprobacion cuando quedó
 * contaminada con 'FINALIZADA'.
 *
 * Modelo (confirmado con el usuario):
 *   - `aprobacion` = decisión de aprobación al ENTRAR el contrato. Es INMUTABLE
 *     una vez aprobado → debe quedar 'Aprobado'. NUNCA debe valer 'FINALIZADA'.
 *   - `estado` = ciclo de vida (ACTIVA / CON EXTENSION / ON HOLD / FINALIZADA).
 *     Aquí vive 'FINALIZADA', NO en aprobacion.
 *
 * Data histórica (previa a la política de mayo 2026) dejó `aprobacion='FINALIZADA'`
 * en muchos registros. Como un contrato solo llega a FINALIZADA tras haber sido
 * aprobado, se restaura a 'Aprobado'. NO se toca `estado` (el ciclo de vida ya
 * quedó normalizado por normalize-estado-extensiones / el cron).
 *
 * Idempotente. Dry-run por defecto; --apply escribe en transacción.
 * USO: node scripts/normalize-aprobacion-finalizada.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

const MATCH = `UPPER(TRIM("aprobacion")) = 'FINALIZADA'`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== NORMALIZAR aprobacion 'FINALIZADA' → 'Aprobado' (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const before = (await c.query(
    `SELECT "tipoUsuario", COALESCE("estado",'(null)') AS estado, COUNT(*)::int AS n
       FROM "PEOPLE" WHERE ${MATCH}
      GROUP BY 1,2 ORDER BY 3 DESC`)).rows;
  const total = before.reduce((s, r) => s + r.n, 0);
  console.log(`\naprobacion='FINALIZADA' encontrados: ${total}`);
  before.forEach(r => console.log(`  ${String(r.tipoUsuario).padEnd(13)} · estado=${String(r.estado).padEnd(16)} · ${r.n}`));

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para escribir`); await c.end(); return; }

  await c.query('BEGIN');
  try {
    const r = await c.query(
      `UPDATE "PEOPLE" SET "aprobacion"='Aprobado', "_updatedDate"=NOW() WHERE ${MATCH}`);
    await c.query('COMMIT');
    console.log(`\n✔ aprobacion normalizada: ${r.rowCount} fila(s)`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  const rest = (await c.query(`SELECT COUNT(*)::int n FROM "PEOPLE" WHERE ${MATCH}`)).rows[0].n;
  console.log(`aprobacion='FINALIZADA' restantes: ${rest}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
