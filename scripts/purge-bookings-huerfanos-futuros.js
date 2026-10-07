/**
 * Borra los agendamientos FUTUROS cuyo evento ya no existe en CALENDARIO
 * (huérfanos que dejó el borrado de eventos por Restructuración/Suspensión antes
 * del fix del 2026-10-07: la agenda no mandaba deleteBookings y el endpoint lo
 * tomaba como false). Solo futuros y no cancelados: el historial pasado no se toca.
 *
 * Dry-run por defecto; --apply borra en una transacción y deja un respaldo JSON
 * local en docs/ (no versionado).
 *
 *   node scripts/purge-bookings-huerfanos-futuros.js            # simula
 *   node scripts/purge-bookings-huerfanos-futuros.js --apply    # borra
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const WHERE = `COALESCE(b."eventoId", b."idEvento") IS NOT NULL
  AND b."cancelo" IS NOT TRUE
  AND b."fechaEvento" > NOW()
  AND NOT EXISTS (SELECT 1 FROM "CALENDARIO" c WHERE c."_id" = COALESCE(b."eventoId", b."idEvento"))`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    const rows = (await c.query(`SELECT b.* FROM "ACADEMICA_BOOKINGS" b WHERE ${WHERE} FOR UPDATE`)).rows;
    const resumen = {};
    for (const r of rows) {
      const k = `${new Date(r.fechaEvento).toISOString().slice(0, 16)} ${r.nivel || ''} ${r.step || ''}`;
      resumen[k] = (resumen[k] || 0) + 1;
    }
    console.log(`Agendamientos futuros huérfanos: ${rows.length}`);
    console.table(resumen);
    if (!APPLY) { await c.query('ROLLBACK'); console.log('DRY-RUN: nada se borró. Use --apply.'); return; }
    const file = path.join('docs', `backup-bookings-huerfanos-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
    const del = await c.query(`DELETE FROM "ACADEMICA_BOOKINGS" b WHERE ${WHERE}`);
    await c.query('COMMIT');
    console.log(`APLICADO: ${del.rowCount} agendamientos borrados. Respaldo: ${file}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => null);
    console.error('ERROR (rollback):', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
