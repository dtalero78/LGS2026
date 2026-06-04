// Limpieza idempotente: TRIM de emails con espacios al borde en ACADEMICA y PEOPLE.
//
// Origen del problema: la migración Wix (marzo 2026) trajo algunos emails con
// espacio al inicio o al final. Esto rompía flujos que normalizan el email
// cliente-side (ej. `Crea UserRol` → INSERT en USUARIOS_ROLES choca con
// `email_key` UNIQUE constraint porque tras trim el email iguala uno ya existente).
//
// Operación SEGURA:
//   - Solo actualiza filas donde `email != TRIM(email)` → idempotente.
//   - TRIM elimina solo espacios al borde, no toca el cuerpo del email.
//   - Ninguna de las 2 tablas tiene UNIQUE en email (en USUARIOS_ROLES sí, pero
//     esa tabla está limpia — 0 filas sucias).
//
//   node scripts/trim-emails-academica-people.js              # dry-run (cuenta)
//   node scripts/trim-emails-academica-people.js --apply      # ejecuta UPDATE
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const APPLY = process.argv.includes('--apply');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const tables = ['ACADEMICA', 'PEOPLE'];
    const summary = {};

    // Conteo inicial
    for (const t of tables) {
      const r = await pool.query(
        `SELECT COUNT(*)::int n FROM "${t}" WHERE "email" IS NOT NULL AND "email" != TRIM("email")`
      );
      summary[t] = { antes: r.rows[0].n, actualizadas: 0 };
    }

    console.log(`=== DRY-RUN ${APPLY ? '(seguido de APPLY)' : '(solo conteo)'} ===`);
    for (const t of tables) {
      console.log(`  ${t.padEnd(20)} | filas con espacios: ${summary[t].antes}`);
    }

    if (!APPLY) {
      console.log('\nℹ Para aplicar los UPDATE, ejecuta con --apply');
      return;
    }

    console.log('\n=== APLICANDO UPDATE ===');
    for (const t of tables) {
      const r = await pool.query(
        `UPDATE "${t}" SET "email" = TRIM("email"), "_updatedDate" = NOW()
         WHERE "email" IS NOT NULL AND "email" != TRIM("email")`
      );
      summary[t].actualizadas = r.rowCount ?? 0;
      console.log(`  ${t.padEnd(20)} | filas actualizadas: ${summary[t].actualizadas}`);
    }

    console.log('\n=== VERIFICACIÓN POST-UPDATE ===');
    for (const t of tables) {
      const r = await pool.query(
        `SELECT COUNT(*)::int n FROM "${t}" WHERE "email" IS NOT NULL AND "email" != TRIM("email")`
      );
      const status = r.rows[0].n === 0 ? '✅ limpio' : `⚠ aún quedan ${r.rows[0].n}`;
      console.log(`  ${t.padEnd(20)} | ${status}`);
    }
  } finally {
    await pool.end();
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
