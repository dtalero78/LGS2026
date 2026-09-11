/**
 * fix-asistio-asistencia-sync.js
 *
 * Sincroniza las columnas gemelas ACADEMICA_BOOKINGS.asistio / .asistencia.
 * En datos migrados de Wix quedaron divergentes: ~4.272 bookings con
 * asistencia=true pero asistio NULL/false (el estudiante SÍ asistió pero la
 * columna nueva `asistio` no lo reflejaba), y ~140 al revés.
 *
 * Regla (nunca DES-marca una asistencia): si CUALQUIERA de las dos indica que
 * asistió (=true), se ponen AMBAS en true.
 *   1) asistencia=true AND asistio<>true  -> asistio=true
 *   2) asistio=true    AND asistencia<>true -> asistencia=true
 *
 * NO toca los false/null (esos ya coinciden en "no asistió"/"sin marcar").
 *
 * Uso:
 *   node scripts/fix-asistio-asistencia-sync.js            # dry-run
 *   node scripts/fix-asistio-asistencia-sync.js --apply    # aplica
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const q1 = `"asistencia" = true AND ("asistio" IS DISTINCT FROM true)`;
  const q2 = `"asistio" = true AND ("asistencia" IS DISTINCT FROM true)`;

  const n1 = (await c.query(`SELECT COUNT(*)::int n FROM "ACADEMICA_BOOKINGS" WHERE ${q1}`)).rows[0].n;
  const n2 = (await c.query(`SELECT COUNT(*)::int n FROM "ACADEMICA_BOOKINGS" WHERE ${q2}`)).rows[0].n;

  console.log('=== Divergencias a corregir ===');
  console.log(`  (1) asistencia=true, asistio<>true  -> set asistio=true    : ${n1}`);
  console.log(`  (2) asistio=true, asistencia<>true  -> set asistencia=true : ${n2}`);
  console.log(`  Total: ${n1 + n2}`);

  if (!APPLY) {
    console.log('\n[dry-run] No se escribió nada. Re-corre con --apply para aplicar.');
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    const r1 = await c.query(
      `UPDATE "ACADEMICA_BOOKINGS" SET "asistio" = true, "_updatedDate" = NOW() WHERE ${q1}`
    );
    const r2 = await c.query(
      `UPDATE "ACADEMICA_BOOKINGS" SET "asistencia" = true, "_updatedDate" = NOW() WHERE ${q2}`
    );
    await c.query('COMMIT');
    console.log(`\n[APLICADO] asistio<-true: ${r1.rowCount} · asistencia<-true: ${r2.rowCount}`);

    // Verificación post
    const restante = (await c.query(
      `SELECT COUNT(*)::int n FROM "ACADEMICA_BOOKINGS" WHERE (${q1}) OR (${q2})`
    )).rows[0].n;
    console.log(`Divergencias restantes: ${restante} (esperado 0)`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK por error:', e.message);
    process.exit(1);
  }
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
