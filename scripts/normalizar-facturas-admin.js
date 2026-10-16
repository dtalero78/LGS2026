/**
 * Normaliza la facturación de PAGOS_TITULARES a "Admin" (decisión 2026-10-16).
 *
 * La factura se emite FUERA de la plataforma; aquí solo se marca. Nunca se cargó un
 * número real: solo valores genéricos (LGS, LGS01, LGS-000, ADMIN, VALIDA, A, B…).
 *   1) Pagos VALIDADOS sin factura con fechaPago anterior a --corte (default
 *      2026-04-01) → "Admin" (facturados por Admin fuera de la plataforma). Incluye
 *      las inscripciones retroactivas de los scripts backfill-cuota0.
 *   2) Todo número de factura genérico (sin al menos 3 dígitos, o LGS…) → "Admin".
 *
 * Respaldo JSON (_id + numeroFactura anterior) en docs/ antes de escribir.
 * Dry-run por defecto; --apply escribe (en transacción). Excluye contratos PRB-.
 *
 *   node scripts/normalizar-facturas-admin.js [--corte 2026-04-01] [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const iCorte = process.argv.indexOf('--corte');
const CORTE = iCorte > -1 ? process.argv[iCorte + 1] : '2026-04-01';
if (!/^\d{4}-\d{2}-\d{2}$/.test(CORTE)) { console.error('--corte debe ser YYYY-MM-DD'); process.exit(1); }

// Misma regla que src/lib/numero-factura.ts: real = ≥3 dígitos y no "LGS…".
const ES_GENERICO_SQL = `(
  TRIM(pt."numeroFactura") <> 'Admin' AND (
    length(regexp_replace(pt."numeroFactura", '[^0-9]', '', 'g')) < 3
    OR TRIM(pt."numeroFactura") ~* '^LGS[-_ ]?[0-9]*$'
  ))`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const NO_PRB = `pt."idPeople" IN (SELECT "_id" FROM "PEOPLE" WHERE COALESCE("contrato",'') NOT LIKE 'PRB-%')`;

  const historicas = await c.query(
    `SELECT pt."_id", pt."numeroFactura", pt."fechaPago"::text AS "fechaPago"
       FROM "PAGOS_TITULARES" pt
      WHERE pt."validado" = true AND TRIM(COALESCE(pt."numeroFactura",'')) = ''
        AND pt."fechaPago" < $1::date AND ${NO_PRB}`, [CORTE]);
  const genericas = await c.query(
    `SELECT pt."_id", pt."numeroFactura" FROM "PAGOS_TITULARES" pt
      WHERE TRIM(COALESCE(pt."numeroFactura",'')) <> '' AND ${ES_GENERICO_SQL} AND ${NO_PRB}`);
  const porValor = {};
  for (const r of genericas.rows) porValor[r.numeroFactura] = (porValor[r.numeroFactura] || 0) + 1;

  console.log(`Corte: pagos con fecha anterior a ${CORTE}`);
  console.log(`1) Pendientes históricas → "Admin": ${historicas.rows.length}`);
  console.log(`2) Números genéricos → "Admin": ${genericas.rows.length}`);
  console.table(Object.entries(porValor).sort((a, b) => b[1] - a[1]).map(([valor, n]) => ({ valor, n })));
  const pendientesQueQuedan = await c.query(
    `SELECT count(*)::int n FROM "PAGOS_TITULARES" pt
      WHERE pt."validado" = true AND TRIM(COALESCE(pt."numeroFactura",'')) = ''
        AND pt."fechaPago" >= $1::date AND ${NO_PRB}`, [CORTE]);
  console.log(`Quedarán en la cola de Facturación: ${pendientesQueQuedan.rows[0].n} (pagos desde ${CORTE})`);

  if (!APPLY) { console.log('\nDry-run: no se escribió nada. Use --apply para aplicar.'); await c.end(); return; }

  const backup = path.join('docs', `backup-numero-factura-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
  fs.writeFileSync(backup, JSON.stringify({ corte: CORTE, historicas: historicas.rows, genericas: genericas.rows }, null, 1));
  console.log(`Respaldo: ${backup}`);

  await c.query('BEGIN');
  try {
    const ids = [...historicas.rows.map((r) => r._id), ...genericas.rows.map((r) => r._id)];
    const u = await c.query(
      `UPDATE "PAGOS_TITULARES" SET "numeroFactura" = 'Admin', "_updatedDate" = NOW() WHERE "_id" = ANY($1::text[])`, [ids]);
    await c.query('COMMIT');
    console.log(`✅ COMMIT — ${u.rowCount} pagos quedaron con numeroFactura = 'Admin'`);
  } catch (e) {
    await c.query('ROLLBACK'); throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
