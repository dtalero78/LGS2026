// Fix puntual (autorizado 2026-10-05): fechas de corte (FINANCIEROS.fechaPago) mal digitadas.
//   02-10712-26 (Eiler Urrutia):    0206-09-30 → 2026-09-30
//   01-15425-26 (Jorge Navarrete):  1991-05-29 → 2026-05-29
// Solo toca la fila si conserva el valor erróneo esperado. Dry-run por defecto; --apply para escribir.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const APPLY = process.argv.includes('--apply');
const FIXES = [
  { contrato: '02-10712-26', mal: '0206-09-30', bien: '2026-09-30' },
  { contrato: '01-15425-26', mal: '1991-05-29', bien: '2026-05-29' },
];
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    for (const f of FIXES) {
      const r = await c.query(
        `UPDATE "FINANCIEROS" SET "fechaPago" = $1::timestamptz, "_updatedDate" = NOW()
          WHERE "contrato" = $2 AND "fechaPago"::date = $3::date
          RETURNING "contrato", "fechaPago"::text`, [`${f.bien} 00:00:00+00`, f.contrato, f.mal]);
      console.log(`${f.contrato}: ${r.rowCount ? `→ ${r.rows[0].fechaPago}` : 'sin cambios (no tenía el valor erróneo)'}`);
    }
    if (APPLY) { await c.query('COMMIT'); console.log('✅ APLICADO'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK. Use --apply.'); }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
