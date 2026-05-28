/** Solo lectura. Descripciones completas + arrays de permisos por rol. */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const { rows } = await pool.query(`
      SELECT "rol", "descripcion", "activo", "origen",
             "fechaActualizacion", "_updatedDate",
             jsonb_array_length("permisos") AS n,
             "permisos"
      FROM "ROL_PERMISOS" ORDER BY "rol"
    `);
    for (const r of rows) {
      console.log(`\n━━━ ${r.rol}  (${r.n} permisos, activo=${r.activo}, origen=${r.origen}) ━━━`);
      console.log(`  descripcion: "${r.descripcion}"`);
      console.log(`  fechaActualizacion=${r.fechaActualizacion ? r.fechaActualizacion.toISOString() : 'NULL'}  _updatedDate=${r._updatedDate ? r._updatedDate.toISOString() : 'NULL'}`);
      if (r.n <= 6) console.log(`  permisos: ${JSON.stringify(r.permisos)}`);
    }
  } finally {
    await pool.end();
  }
})();
