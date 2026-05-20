/**
 * Sólo lectura. Detecta inconsistencias: registros con
 * plataforma='Chile' cuyo celular empieza con '57' (prefijo de
 * Colombia, no de Chile que es '56').
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // Total con plataforma Chile
    const totalChile = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "PEOPLE" WHERE "plataforma" = 'Chile'`
    );
    console.log(`Total registros con plataforma='Chile': ${totalChile.rows[0].n}`);

    // Con celular que empieza con 57 (después de limpiar no-dígitos)
    const conflict = await pool.query(
      `SELECT "_id", "primerNombre", "primerApellido", "numeroId", "tipoUsuario",
              "celular", "contrato", "plataforma"
       FROM "PEOPLE"
       WHERE "plataforma" = 'Chile'
         AND REGEXP_REPLACE(COALESCE("celular", ''), '[^0-9]', '', 'g') LIKE '57%'
       ORDER BY "primerApellido" NULLS LAST, "primerNombre" NULLS LAST`
    );

    console.log(`\nRegistros Chile con celular empezando en '57': ${conflict.rowCount}`);
    if (conflict.rowCount === 0) {
      console.log('  (ninguno)');
      return;
    }

    conflict.rows.forEach(r => {
      const cleaned = (r.celular || '').replace(/[^0-9]/g, '');
      const display = `${r.primerNombre || ''} ${r.primerApellido || ''}`.trim() || '(sin nombre)';
      console.log(
        `  ${r._id.slice(0,16).padEnd(16)}  ${display.padEnd(35)}  ` +
        `tipo=${(r.tipoUsuario || '—').padEnd(12)}  ID=${(r.numeroId || '—').padEnd(15)}  ` +
        `contrato=${r.contrato ?? '—'}  celular="${r.celular}" (limpio=${cleaned})`
      );
    });

    // Por tipoUsuario
    const byType = await pool.query(
      `SELECT "tipoUsuario", COUNT(*)::int AS n
       FROM "PEOPLE"
       WHERE "plataforma" = 'Chile'
         AND REGEXP_REPLACE(COALESCE("celular", ''), '[^0-9]', '', 'g') LIKE '57%'
       GROUP BY "tipoUsuario"
       ORDER BY n DESC`
    );
    console.log('\nResumen por tipoUsuario:');
    byType.rows.forEach(r => console.log(`  ${r.tipoUsuario}: ${r.n}`));
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
