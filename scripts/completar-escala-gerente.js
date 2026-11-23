/**
 * Completa la escala comercial ya guardada: los niveles Full Executive / Jefe de Grupo vacíos ENTRE
 * el ejecutivo y su gerente se llenan con el nombre del gerente (misma regla que src/lib/escala-comercial.ts).
 * Afecta PEOPLE (titulares: fullExecutive, jefeGrupo, gerente) y EQUIPO_COMERCIAL.
 * Dry-run por defecto; --apply escribe en una transacción y guarda copia en docs/.
 *   node scripts/completar-escala-gerente.js [--apply]
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');
const apply = process.argv.includes('--apply');
const vacio = v => !String(v ?? '').trim();

// Misma regla que src/lib/escala-comercial.ts: se llena con el gerente lo que quede POR ENCIMA del \u00faltimo
// nivel con nombre (fe/jg) hasta el gerente; lo de por debajo de un nivel con nombre no se toca.
function completar({ fe, jg, ge }) {
  if (vacio(ge)) return null;
  const base = !vacio(jg) ? 1 : !vacio(fe) ? 0 : -1;
  if (base === 1) return null;
  const out = { fe, jg: ge };
  if (base < 0) out.fe = ge;
  return out;
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const eq = (await c.query(`SELECT "_id","nombre","correo","fullExecutive","jefeGrupo","gerente" FROM "EQUIPO_COMERCIAL" WHERE COALESCE(TRIM("gerente"),'')<>''`)).rows;
    const cambiosEq = eq.map(r => ({ r, n: completar({ fe: r.fullExecutive, jg: r.jefeGrupo, ge: r.gerente }) })).filter(x => x.n);
    const pe = (await c.query(`SELECT "_id","contrato","asesorCreadorContrato","fullExecutive","jefeGrupo","gerente" FROM "PEOPLE"
        WHERE "tipoUsuario"='TITULAR' AND COALESCE(TRIM("gerente"),'')<>'' AND (COALESCE(TRIM("fullExecutive"),'')='' OR COALESCE(TRIM("jefeGrupo"),'')='')`)).rows;
    const cambiosPe = pe.map(r => ({ r, n: completar({ fe: r.fullExecutive, jg: r.jefeGrupo, ge: r.gerente }) })).filter(x => x.n);
    console.log(`EQUIPO_COMERCIAL: ${cambiosEq.length} de ${eq.length} con gerente · PEOPLE titulares: ${cambiosPe.length} de ${pe.length} con huecos`);
    console.table(cambiosEq.slice(0, 8).map(x => ({ nombre: x.r.nombre, antesFE: x.r.fullExecutive, antesJG: x.r.jefeGrupo, gerente: x.r.gerente, nuevoFE: x.n.fe, nuevoJG: x.n.jg })));
    console.table(cambiosPe.slice(0, 8).map(x => ({ contrato: x.r.contrato, ejecutivo: x.r.asesorCreadorContrato, antesFE: x.r.fullExecutive, antesJG: x.r.jefeGrupo, gerente: x.r.gerente, nuevoFE: x.n.fe, nuevoJG: x.n.jg })));
    if (!apply) { console.log('(dry-run — use --apply)'); return; }
    fs.writeFileSync(`docs/backup-escala-gerente-${Date.now()}.json`, JSON.stringify({
      equipo: cambiosEq.map(x => x.r), people: cambiosPe.map(x => x.r) }, null, 1));
    await c.query('BEGIN');
    for (const x of cambiosEq) await c.query(`UPDATE "EQUIPO_COMERCIAL" SET "fullExecutive"=$2,"jefeGrupo"=$3,"_updatedDate"=NOW() WHERE "_id"=$1`, [x.r._id, x.n.fe || null, x.n.jg || null]);
    for (const x of cambiosPe) await c.query(`UPDATE "PEOPLE" SET "fullExecutive"=$2,"jefeGrupo"=$3 WHERE "_id"=$1`, [x.r._id, x.n.fe || null, x.n.jg || null]);
    await c.query('COMMIT');
    console.log('APLICADO');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERROR', e.message); process.exit(1); }
  finally { await c.end(); }
})();
