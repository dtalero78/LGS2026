// READ-ONLY: inspecciona la tabla NIVELES (code, step, orden, esParalelo)
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  // columnas reales
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='NIVELES' ORDER BY ordinal_position`);
  console.log('Columnas NIVELES:', cols.rows.map(c=>c.column_name).join(', '));
  console.log('');
  const { rows } = await pool.query(`SELECT * FROM "NIVELES"`);
  console.log('Total filas NIVELES:', rows.length);
  console.log('');
  // mostrar campos clave
  const pick = (r) => ({
    code: r.code ?? r.nivel ?? r.nombreNivel,
    step: r.step,
    orden: r.orden,
    esParalelo: r.esParalelo,
  });
  const shown = rows.map(pick).sort((a,b)=> (a.orden??999)-(b.orden??999) || String(a.code).localeCompare(String(b.code)) || String(a.step).localeCompare(String(b.step)));
  for (const r of shown) console.log(`  orden=${r.orden ?? '∅'}\tcode=${r.code}\tstep=${r.step ?? '∅'}\tparalelo=${r.esParalelo===true}`);
  await pool.end();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
