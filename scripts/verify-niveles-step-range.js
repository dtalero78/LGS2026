// READ-ONLY diagnóstico: registros de ACADEMICA cuyo "step" cae fuera del
// rango canónico del currículo para su "nivel". No modifica nada.
//   node scripts/verify-niveles-step-range.js
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const MAIN_LEVELS = ['BN1','BN2','BN3','P1','P2','P3','F1','F2','F3'];
const SPECIAL = { WELCOME:['WELCOME'], ESS:['Step 0'], MASTER:['Step 46'], IELTS:['Step 47'], B2FIRST:['Step 48'], TOEFL:['Step 49'], DONE:['Step 50'] };
function canonical(nivel) {
  const mi = MAIN_LEVELS.indexOf(nivel);
  if (mi >= 0) { const start = 1 + mi*5; return Array.from({length:5},(_,k)=>`Step ${start+k}`); }
  return SPECIAL[nivel] ?? null; // null = nivel desconocido (no se evalúa)
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const { rows } = await pool.query(`
    SELECT "_id", "numeroId",
      TRIM(CONCAT(COALESCE("primerNombre",''),' ',COALESCE("primerApellido",''))) AS nombre,
      "email", "nivel", "step", "estadoInactivo"
    FROM "ACADEMICA"
    WHERE "nivel" IS NOT NULL AND TRIM("nivel") <> ''`);

  const offenders = [];
  const unknownNiveles = new Set();
  for (const r of rows) {
    const allowed = canonical(r.nivel);
    if (allowed === null) { unknownNiveles.add(r.nivel); continue; }
    const step = (r.step || '').trim();
    if (!allowed.includes(step)) offenders.push(r);
  }

  console.log('Total ACADEMICA con nivel:', rows.length);
  if (unknownNiveles.size) console.log('Niveles desconocidos (no evaluados):', [...unknownNiveles].join(', '));
  console.log('Registros con STEP FUERA DEL RANGO de su nivel:', offenders.length);
  console.log('');
  offenders.sort((a,b)=> (a.nivel||'').localeCompare(b.nivel||'') || (a.step||'').localeCompare(b.step||''));
  for (const o of offenders) {
    console.log(`  ${o.nivel} / ${o.step}  | ${o.nombre} | ID ${o.numeroId} | ${o.email||'sin correo'} | inactivo=${o.estadoInactivo===true} | _id=${o._id}`);
  }
  await pool.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
