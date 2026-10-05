// Borra los pagos VALIDADOS POR PERSONA que quedaron en contratos BORRADOR (pendientes, vivos)
// rehechos: el titular tiene un contrato APROBADO posterior con el mismo beneficiario, donde la
// inscripción ya está registrada. Autorizado por el usuario el 2026-10-05 ("esos 10").
// Antes de borrar: snapshot en PURGE_LOG (tipoPurga PAGOS_BORRADOR_DUPLICADO) + JSON local en docs/.
// Lista además los pagos que SIGUEN en esos borradores (validados por migración) para verificación.
// Dry-run por defecto; --apply para borrar. Todo en una transacción.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const APPLY = process.argv.includes('--apply');
const N = c => `UPPER(REGEXP_REPLACE(COALESCE(${c},''), '[.[:space:]_-]', '', 'g'))`;
const MUERTO = a => `(UPPER(COALESCE(${a}."estado",'')) IN ('FINALIZADA','ANULADO')
   OR UPPER(COALESCE(${a}."aprobacion",'')) IN ('CONTRATO NULO','DEVUELTO','RECHAZADO','RETRACTADO')
   OR (${a}."estadoInactivo" IS TRUE AND ${a}."fechaOnHold" IS NULL))`;
const fmt = v => Number(v || 0).toLocaleString('es-CO');
const d = v => v ? new Date(v).toISOString().slice(0, 10) : '';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    // Borradores (anterior pendiente vivo) con ≥1 beneficiario también presente en el aprobado posterior.
    const pares = (await c.query(`
      WITH tit AS (
        SELECT p."_id", p."contrato", ${N('p."numeroId"')} nid, p."aprobacion", p."_createdDate", ${MUERTO('p')} muerto
          FROM "PEOPLE" p WHERE p."tipoUsuario"='TITULAR' AND COALESCE(p."contrato",'')<>'' AND p."contrato" NOT LIKE 'PRB-%' AND COALESCE(p."numeroId",'')<>''
      )
      SELECT DISTINCT ON (b."contrato") b."contrato" borrador, a."contrato" aprobado, a."_id" aprobado_tit
        FROM tit a JOIN tit b ON b.nid=a.nid AND b."contrato"<>a."contrato" AND b."_createdDate"<a."_createdDate"
       WHERE UPPER(COALESCE(a."aprobacion",'')) IN ('APROBADO','APROBADA') AND NOT a.muerto
         AND NOT b.muerto AND UPPER(COALESCE(b."aprobacion",'')) NOT IN ('APROBADO','APROBADA')
         AND EXISTS (SELECT 1 FROM "PEOPLE" x JOIN "PEOPLE" y ON ${N('y."numeroId"')} = ${N('x."numeroId"')}
                      WHERE x."contrato"=b."contrato" AND x."tipoUsuario"<>'TITULAR' AND y."contrato"=a."contrato" AND y."tipoUsuario"<>'TITULAR')
       ORDER BY b."contrato", a."_createdDate" DESC`)).rows;
    const borradores = pares.map(p => p.borrador);
    console.log(`Borradores rehechos (pendientes, vivos): ${borradores.length}`);

    const pagos = (await c.query(`
      SELECT pt.*, x."contrato" AS borrador, x."_id" AS people_id, TRIM(CONCAT_WS(' ', x."primerNombre", x."primerApellido")) AS titular
        FROM "PAGOS_TITULARES" pt JOIN "PEOPLE" x ON x."_id" = pt."idPeople"
       WHERE x."contrato" = ANY($1::text[]) FOR UPDATE OF pt`, [borradores])).rows;
    const esPersona = p => p.validado === true && !String(p.validadoPor || '').toLowerCase().startsWith('migracion') && String(p.validadoPor || '') !== '';
    const aBorrar = pagos.filter(esPersona);
    const quedan = pagos.filter(p => !esPersona(p));

    console.log(`\n1) Pagos validados por PERSONA a BORRAR: ${aBorrar.length} · ${fmt(aBorrar.reduce((s, p) => s + Number(p.valorPagado || 0), 0))}`);
    for (const p of aBorrar) {
      const par = pares.find(x => x.borrador === p.borrador);
      const enAprobado = (await c.query(
        `SELECT "numCuota", "valorPagado", "fechaPago", "validado", "validadoPor" FROM "PAGOS_TITULARES"
          WHERE "idPeople" = $1 ORDER BY "numCuota", "fechaPago"`, [par.aprobado_tit])).rows;
      const insc = enAprobado.filter(x => Number(x.numCuota) === 0);
      console.log(`   • ${p.borrador} (${p.titular}) — cuota ${p.numCuota} · ${fmt(p.valorPagado)} · ${d(p.fechaPago)} · validado por ${p.validadoPor}`);
      console.log(`       aprobado ${par.aprobado}: inscripción(es) ${insc.length ? insc.map(x => `${fmt(x.valorPagado)} ${d(x.fechaPago)} ${x.validado ? 'validado' : 'NO validado'}${x.validadoPor ? ' por ' + x.validadoPor : ''}`).join(' | ') : '⚠️ NINGUNA'} · total pagos en aprobado: ${enAprobado.length}`);
    }

    console.log(`\n2) Pagos que SIGUEN en esos borradores (para verificar): ${quedan.length} · ${fmt(quedan.reduce((s, p) => s + Number(p.valorPagado || 0), 0))}`);
    console.table(quedan.map(p => ({
      borrador: p.borrador, aprobado: pares.find(x => x.borrador === p.borrador)?.aprobado, titular: p.titular,
      cuota: p.numCuota, valor: fmt(p.valorPagado), fecha: d(p.fechaPago),
      estado: p.validado ? `validado por ${p.validadoPor || '—'}` : 'no validado',
    })));

    if (aBorrar.length) {
      // Snapshot en PURGE_LOG (uno por borrador) + JSON local
      const porBorrador = {};
      for (const p of aBorrar) (porBorrador[p.borrador] = porBorrador[p.borrador] || []).push(p);
      for (const [borrador, arr] of Object.entries(porBorrador)) {
        await c.query(
          `INSERT INTO "PURGE_LOG" ("_id","tipoPurga","contrato","titularId","titularNombre","snapshot","motivo","realizadoPor","realizadoPorNombre","filasBorradas")
           VALUES ($1,'PAGOS_BORRADOR_DUPLICADO',$2,$3,$4,$5::jsonb,$6,'script:fix-pagos-persona-borradores-duplicados','Claude (autorizado por plataformalgsdigital)',$7::jsonb)`,
          [`aud_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`, borrador, arr[0].people_id, arr[0].titular,
           JSON.stringify({ pagos: arr, contratoAprobado: pares.find(x => x.borrador === borrador)?.aprobado }),
           'Pago de inscripción del contrato borrador rehecho; la inscripción ya está registrada en el contrato aprobado. Autorizado 2026-10-05.',
           JSON.stringify({ pagos: arr.length })]);
      }
      fs.writeFileSync('docs/backup-pagos-persona-borradores-2026-10-05.json', JSON.stringify(aBorrar, null, 2));
      await c.query(`DELETE FROM "PAGOS_TITULARES" WHERE "_id" = ANY($1::text[])`, [aBorrar.map(p => p._id)]);
    }

    if (APPLY) { await c.query('COMMIT'); console.log(`\n✅ APLICADO: ${aBorrar.length} pago(s) borrado(s). Snapshot en PURGE_LOG (PAGOS_BORRADOR_DUPLICADO) y docs/backup-pagos-persona-borradores-2026-10-05.json`); }
    else { await c.query('ROLLBACK'); console.log('\nDRY-RUN: ROLLBACK, no se borró nada. Use --apply para aplicar.'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR (ROLLBACK):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
