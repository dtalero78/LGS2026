/**
 * Sólo lectura. Diagnóstico de los 4 contratos NOT_FOUND.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const casos = [
  { contrato: '03-871-25', numeroId: '802717751' },
  { contrato: '03-10000-25', numeroId: '401487277' },
  { contrato: '03-756-25', numeroId: '802802736' },
  { contrato: '03-833-25', numeroId: '1723427132' },
];

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const c of casos) {
      console.log(`\n--- contrato="${c.contrato}" numeroId="${c.numeroId}" ---`);

      // Match exacto por contrato
      let r = await pool.query(`
        SELECT "_id", "primerNombre", "primerApellido", "numeroId", "tipoUsuario", "contrato", "plataforma"
        FROM "PEOPLE" WHERE "contrato" = $1
      `, [c.contrato]);
      console.log(`  Match exacto contrato="${c.contrato}": ${r.rowCount}`);
      for (const p of r.rows) console.log(`    [${p.tipoUsuario}] ${p.primerNombre} ${p.primerApellido} | numeroId=${p.numeroId} | plataforma=${p.plataforma} | _id=${p._id}`);

      // Match por numeroId
      r = await pool.query(`
        SELECT "_id", "primerNombre", "primerApellido", "numeroId", "tipoUsuario", "contrato", "plataforma"
        FROM "PEOPLE" WHERE "numeroId" = $1
      `, [c.numeroId]);
      console.log(`  Match exacto numeroId="${c.numeroId}": ${r.rowCount}`);
      for (const p of r.rows) console.log(`    [${p.tipoUsuario}] ${p.primerNombre} ${p.primerApellido} | contrato=${p.contrato} | plataforma=${p.plataforma} | _id=${p._id}`);

      // Match LIKE contrato (sin guiones/espacios)
      r = await pool.query(`
        SELECT "_id", "primerNombre", "primerApellido", "numeroId", "tipoUsuario", "contrato", "plataforma"
        FROM "PEOPLE" WHERE REPLACE(REPLACE("contrato", '-', ''), ' ', '') = REPLACE(REPLACE($1, '-', ''), ' ', '')
      `, [c.contrato]);
      console.log(`  Match contrato sin separadores: ${r.rowCount}`);
      for (const p of r.rows) console.log(`    [${p.tipoUsuario}] ${p.primerNombre} ${p.primerApellido} | contrato="${p.contrato}" | numeroId=${p.numeroId} | _id=${p._id}`);
    }
  } finally {
    await pool.end();
  }
})();
