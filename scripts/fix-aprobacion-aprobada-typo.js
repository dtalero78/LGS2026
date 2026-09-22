/**
 * fix-aprobacion-aprobada-typo.js
 *
 * Normaliza el valor mal escrito `PEOPLE.aprobacion = 'Aprobada'` (con "a" final,
 * femenino) a `'Aprobado'`. Ese typo hacía que contratos ya aprobados aparecieran
 * por error en el Centro de Aprobaciones (que lista `aprobacion != 'Aprobado'`).
 *
 * Idempotente · dry-run por defecto · `--apply` para escribir (en transacción).
 *   node scripts/fix-aprobacion-aprobada-typo.js            # dry-run (muestra)
 *   node scripts/fix-aprobacion-aprobada-typo.js --apply    # aplica
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

(async () => {
  const cs = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const sel = await c.query(
    `SELECT "_id","primerNombre","primerApellido","numeroId","contrato","tipoUsuario","aprobacion"
     FROM "PEOPLE" WHERE "aprobacion" = 'Aprobada' ORDER BY "contrato","tipoUsuario"`,
  );
  console.log(`Filas con aprobacion='Aprobada': ${sel.rows.length}`);
  for (const r of sel.rows) {
    console.log(`  ${r.contrato || '(sin contrato)'} · ${r.tipoUsuario} · ${r.primerNombre} ${r.primerApellido} · ID ${r.numeroId}`);
  }

  if (sel.rows.length === 0) { console.log('Nada que corregir.'); await c.end(); return; }

  if (!APPLY) {
    console.log('\n[DRY-RUN] No se escribió nada. Corre con --apply para normalizar a "Aprobado".');
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    const upd = await c.query(`UPDATE "PEOPLE" SET "aprobacion" = 'Aprobado' WHERE "aprobacion" = 'Aprobada'`);
    await c.query('COMMIT');
    console.log(`\n✅ APLICADO: ${upd.rowCount} fila(s) normalizada(s) 'Aprobada' → 'Aprobado'.`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK por error:', e.message);
    process.exitCode = 1;
  }
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
