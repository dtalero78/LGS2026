// Fix (autorizado 2026-10-05): titulares APROBADOS con PEOPLE.estado vacío (legacy Wix).
// Regla según sus beneficiarios:
//   A. algún beneficiario vigente (no FINALIZADA, no inactivo) → titular ACTIVA, estadoInactivo=false,
//      finalContrato = la mayor entre la del titular y la de sus beneficiarios vigentes (extensiones
//      aplicadas solo al beneficiario, ej. 01-8570-25 → 10/10/2026).
//   B. todos los beneficiarios FINALIZADA → titular FINALIZADA (+ estadoInactivo).
//   C. titular y beneficiarios inactivos sin OnHold y contrato VENCIDO (hoy ≥ final+2, regla de
//      contract-expiry) → titular FINALIZADA y esos beneficiarios FINALIZADA (lo que hace el cron).
//   Resto (inactivo pero no vencido, sin beneficiarios, OnHold) → NO se toca; se lista para revisar.
// Copia previa de las filas en docs/backup-estado-titulares-null-<ts>.json. Dry-run por defecto; --apply.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const APPLY = process.argv.includes('--apply');
const vencido = (d) => d && Date.parse(d) + 2 * 86400000 <= Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    const tits = (await c.query(
      `SELECT * FROM "PEOPLE" WHERE "tipoUsuario"='TITULAR' AND "aprobacion"='Aprobado' AND ("estado" IS NULL OR "estado"='')
          AND COALESCE("contrato",'') NOT LIKE 'PRB-%' FOR UPDATE`)).rows;
    const backup = [], res = { A: [], B: [], C: [], revisar: [] };
    for (const t of tits) {
      const bens = (await c.query(`SELECT * FROM "PEOPLE" WHERE "contrato"=$1 AND "tipoUsuario"<>'TITULAR' FOR UPDATE`, [t.contrato])).rows;
      const vivos = bens.filter(b => b.estado !== 'FINALIZADA' && b.estadoInactivo !== true);
      const fin = d => d ? new Date(d).toISOString().slice(0, 10) : null;
      const finTit = fin(t.finalContrato);
      if (t.estadoInactivo === true && t.fechaOnHold) { res.revisar.push({ contrato: t.contrato, motivo: 'titular en OnHold' }); continue; }
      if (vivos.length) {
        const maxB = vivos.map(b => fin(b.finalContrato)).filter(Boolean).sort().pop() || null;
        const nuevaFin = [finTit, maxB].filter(Boolean).sort().pop() || null;
        backup.push({ titular: t });
        await c.query(`UPDATE "PEOPLE" SET "estado"='ACTIVA', "estadoInactivo"=false, "finalContrato"=$2::date, "_updatedDate"=NOW() WHERE "_id"=$1`, [t._id, nuevaFin]);
        res.A.push({ contrato: t.contrato, final: `${finTit} → ${nuevaFin}` });
      } else if (bens.length && bens.every(b => b.estado === 'FINALIZADA')) {
        backup.push({ titular: t });
        await c.query(`UPDATE "PEOPLE" SET "estado"='FINALIZADA', "estadoInactivo"=true, "_updatedDate"=NOW() WHERE "_id"=$1`, [t._id]);
        res.B.push({ contrato: t.contrato, final: finTit });
      } else if (bens.length && bens.every(b => b.estadoInactivo === true && !b.fechaOnHold)
                 && vencido([finTit, ...bens.map(b => fin(b.finalContrato))].filter(Boolean).sort().pop())) {
        const aFin = bens.filter(b => b.estado !== 'FINALIZADA');
        backup.push({ titular: t, beneficiarios: aFin });
        await c.query(`UPDATE "PEOPLE" SET "estado"='FINALIZADA', "estadoInactivo"=true, "_updatedDate"=NOW() WHERE "_id"=$1`, [t._id]);
        if (aFin.length) await c.query(`UPDATE "PEOPLE" SET "estado"='FINALIZADA', "_updatedDate"=NOW() WHERE "_id" = ANY($1::text[])`, [aFin.map(b => b._id)]);
        res.C.push({ contrato: t.contrato, final: finTit, beneficiarios_finalizados: aFin.length });
      } else {
        res.revisar.push({ contrato: t.contrato, final: finTit, beneficiarios: bens.length,
          motivo: !bens.length ? 'sin beneficiarios' : bens.some(b => b.fechaOnHold) ? 'beneficiario en OnHold' : 'inactivo sin vencer' });
      }
    }
    console.log(`Titulares con estado vacío: ${tits.length}`);
    console.log(`A → ACTIVA: ${res.A.length}`); console.table(res.A);
    console.log(`B → FINALIZADA (beneficiarios ya finalizados): ${res.B.length}`); console.table(res.B);
    console.log(`C → FINALIZADA (vencidos e inactivos): ${res.C.length} · beneficiarios pasados a FINALIZADA: ${res.C.reduce((s, r) => s + r.beneficiarios_finalizados, 0)}`);
    console.log(`Sin tocar (revisar): ${res.revisar.length}`); console.table(res.revisar);
    if (APPLY) {
      const f = `docs/backup-estado-titulares-null-${Date.now()}.json`;
      fs.writeFileSync(f, JSON.stringify(backup, null, 2));
      await c.query('COMMIT'); console.log(`✅ APLICADO. Copia previa en ${f}`);
    } else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK. Use --apply.'); }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
