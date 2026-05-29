// Dedupe de FINANCIEROS para grupos IDÉNTICOS (mismo contrato y mismas
// condiciones: totalPlan, valorCuota, pagoInscripcion, numeroCuotas).
// Conserva la fila con _createdDate MÁS RECIENTE (la que ya leen send-pdf /
// consent / el informe de Asignación) y borra las demás del grupo.
//
// SEGURO porque:
//   - syncFinancieroSaldo actualiza TODAS las filas del contrato (saldo igual).
//   - Toda lectura de negocio usa ORDER BY _createdDate DESC LIMIT 1 / LIMIT 1.
//   - Solo toca grupos con condiciones idénticas (los que DIFIEREN se ignoran).
//
// Uso:
//   node scripts/dedupe-financieros-identicos.js            (DRY-RUN, no borra)
//   node scripts/dedupe-financieros-identicos.js --apply    (borra; respalda antes)
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const APPLY = process.argv.includes('--apply');
const num = (v) => (v === null || v === undefined || v === '') ? '' : String(v).replace(/[^0-9.-]/g, '');
const termsKey = (r) => [num(r.totalPlan), num(r.valorCuota), num(r.pagoInscripcion), num(r.numeroCuotas)].join('|');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const dup = await pool.query(`
    SELECT "contrato" FROM "FINANCIEROS"
    WHERE "contrato" IS NOT NULL AND TRIM("contrato")<>''
    GROUP BY "contrato" HAVING COUNT(*)>1`);
  const contratos = dup.rows.map(r => r.contrato);
  if (!contratos.length) { console.log('No hay duplicados.'); await pool.end(); return; }

  // Filas completas (para respaldo) de los contratos duplicados
  const { rows } = await pool.query(`SELECT * FROM "FINANCIEROS" WHERE "contrato" = ANY($1)`, [contratos]);
  const byC = new Map();
  for (const r of rows) { if (!byC.has(r.contrato)) byC.set(r.contrato, []); byC.get(r.contrato).push(r); }

  const toDelete = [];      // filas a borrar
  let gruposIdenticos = 0, gruposDifieren = 0;
  const plan = [];          // {contrato, keep, delete:[]}

  for (const [contrato, fs2] of byC) {
    const distinctTerms = new Set(fs2.map(termsKey));
    if (distinctTerms.size !== 1) { gruposDifieren++; continue; }   // DIFIEREN → no tocar
    gruposIdenticos++;
    const sorted = [...fs2].sort((a, b) => new Date(b._createdDate || 0) - new Date(a._createdDate || 0));
    const keep = sorted[0];
    const del = sorted.slice(1);
    del.forEach(r => toDelete.push(r));
    plan.push({ contrato, keepId: keep._id, deleteIds: del.map(r => r._id), n: fs2.length });
  }

  console.log(`Grupos IDÉNTICOS: ${gruposIdenticos} | DIFIEREN (ignorados): ${gruposDifieren}`);
  console.log(`Filas a BORRAR: ${toDelete.length}  (se conserva 1 por contrato idéntico)`);
  console.log(`Modo: ${APPLY ? 'APPLY (se borrará)' : 'DRY-RUN (no se borra)'}`);
  console.log('');
  plan.slice(0, 60).forEach(p => console.log(`  ${p.contrato.padEnd(14)} ${p.n} filas → conserva ${p.keepId}, borra ${p.deleteIds.length}`));
  if (plan.length > 60) console.log(`  ... (${plan.length - 60} contratos más)`);

  if (!APPLY) { console.log('\nDRY-RUN: no se modificó nada. Re-ejecuta con --apply para borrar.'); await pool.end(); return; }

  // Respaldo COMPLETO de las filas a borrar (reversible)
  const backup = path.join(process.cwd(), 'financieros-borrados-backup.json');
  fs.writeFileSync(backup, JSON.stringify(toDelete, null, 2), 'utf8');
  console.log(`\nRespaldo escrito: ${backup} (${toDelete.length} filas)`);

  const ids = toDelete.map(r => r._id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`DELETE FROM "FINANCIEROS" WHERE "_id" = ANY($1)`, [ids]);
    await client.query('COMMIT');
    console.log(`✅ Borradas ${res.rowCount} filas.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ ROLLBACK:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  // Verificación: ¿quedan grupos idénticos?
  const after = await pool.query(`
    SELECT COUNT(*)::int n FROM (
      SELECT "contrato" FROM "FINANCIEROS"
      WHERE "contrato"=ANY($1) GROUP BY "contrato" HAVING COUNT(*)>1) t`, [contratos]);
  console.log(`Contratos que aún tienen >1 fila (deberían ser solo los 28 que DIFIEREN): ${after.rows[0].n}`);

  await pool.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
