/**
 * Sólo lectura. Diagnóstico de los NOT_FOUND de Adiela.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const casos = [
  { contrato: '04-9252-25', numeroId: '1112219474' },
  { contrato: '04-9439-25', numeroId: '1062062423' },
  { contrato: '04-9494-25', numeroId: '1003317182' },
  { contrato: '04-9621-25', numeroId: '1049607840' },
];

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const c of casos) {
      console.log(`\n--- contrato="${c.contrato}" numeroId="${c.numeroId}" ---`);

      // Match exacto contrato
      let r = await pool.query(`
        SELECT "_id", "primerNombre", "primerApellido", "numeroId", "tipoUsuario", "contrato", "plataforma"
        FROM "PEOPLE" WHERE "contrato" = $1
      `, [c.contrato]);
      console.log(`  Match contrato="${c.contrato}": ${r.rowCount}`);
      for (const p of r.rows) console.log(`    [${p.tipoUsuario}] ${p.primerNombre} ${p.primerApellido} | numeroId=${p.numeroId} | plataforma=${p.plataforma} | _id=${p._id}`);

      // Match por numeroId
      r = await pool.query(`
        SELECT "_id", "primerNombre", "primerApellido", "numeroId", "tipoUsuario", "contrato", "plataforma"
        FROM "PEOPLE" WHERE "numeroId" = $1
      `, [c.numeroId]);
      console.log(`  Match numeroId="${c.numeroId}": ${r.rowCount}`);
      for (const p of r.rows) console.log(`    [${p.tipoUsuario}] ${p.primerNombre} ${p.primerApellido} | contrato="${p.contrato}" | plataforma=${p.plataforma} | _id=${p._id}`);

      // Match LIKE contrato (sin guiones/espacios)
      r = await pool.query(`
        SELECT "_id", "primerNombre", "primerApellido", "numeroId", "tipoUsuario", "contrato"
        FROM "PEOPLE" WHERE REPLACE(REPLACE("contrato", '-', ''), ' ', '') = REPLACE(REPLACE($1, '-', ''), ' ', '')
      `, [c.contrato]);
      console.log(`  Match contrato sin separadores: ${r.rowCount}`);
      for (const p of r.rows) console.log(`    [${p.tipoUsuario}] ${p.primerNombre} ${p.primerApellido} | contrato="${p.contrato}" | numeroId=${p.numeroId} | _id=${p._id}`);
    }
  } finally {
    await pool.end();
  }
})();
