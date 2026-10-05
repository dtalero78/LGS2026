// Borra definitivamente los contratos BORRADOR rehechos cuyos pagos de inscripción
// duplicados se eliminaron el 2026-10-05 (PURGE_LOG tipoPurga PAGOS_BORRADOR_DUPLICADO).
// Autorizado por el usuario el 2026-10-05 ("Borre estos 10 contratos").
//
// Borra SOLO lo que es del borrador: filas de PEOPLE del contrato, FINANCIEROS,
// PAGOS_TITULARES (por idPeople) y KIDS_INSCRIPCIONES. NO toca ACADEMICA, clases ni
// USUARIOS_ROLES: los beneficiarios estudian con la ficha del contrato APROBADO.
// Aborta un contrato si: alguna fila está Aprobada, hay clases colgando de sus filas
// de PEOPLE, alguna ficha académica apunta a él (usuarioId/contrato), o tiene pagos
// validados por una PERSONA.
// Antes de borrar: snapshot en PURGE_LOG (tipoPurga BORRADOR_REHECHO) + JSON local en docs/.
// Dry-run por defecto; --apply para borrar. Todo en una transacción.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const APPLY = process.argv.includes('--apply');
const MOTIVO = 'Contrato borrador rehecho: el titular tiene un contrato aprobado posterior con los mismos beneficiarios. Autorizado 2026-10-05.';
const fmt = v => Number(v || 0).toLocaleString('es-CO');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    const log = (await c.query(
      `SELECT DISTINCT "contrato", "snapshot"->>'contratoAprobado' AS aprobado FROM "PURGE_LOG"
        WHERE "tipoPurga" = 'PAGOS_BORRADOR_DUPLICADO' ORDER BY "contrato"`)).rows;
    console.log(`Contratos borrador (de PURGE_LOG PAGOS_BORRADOR_DUPLICADO): ${log.length}\n`);

    const resumen = [], backup = [];
    let abortados = 0;
    for (const { contrato, aprobado } of log) {
      const people = (await c.query(`SELECT * FROM "PEOPLE" WHERE "contrato" = $1 FOR UPDATE`, [contrato])).rows;
      const ids = people.map(p => p._id);
      const tit = people.find(p => p.tipoUsuario === 'TITULAR');
      const problemas = [];
      if (!people.length) { resumen.push({ contrato, aprobado, estado: 'ya no existe' }); continue; }
      if (people.some(p => String(p.aprobacion || '').toUpperCase().startsWith('APROBAD'))) problemas.push('fila aprobada');
      const aprobadoVivo = (await c.query(
        `SELECT COUNT(*)::int n FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' AND "aprobacion" ILIKE 'aprobad%'`, [aprobado])).rows[0].n;
      if (!aprobadoVivo) problemas.push(`el aprobado ${aprobado} no está aprobado`);
      const bk = (await c.query(
        `SELECT COUNT(*)::int n FROM "ACADEMICA_BOOKINGS" WHERE "studentId" = ANY($1::text[]) OR "idEstudiante" = ANY($1::text[])`, [ids])).rows[0].n;
      if (bk) problemas.push(`${bk} clases en sus filas`);
      const ac = (await c.query(
        `SELECT COUNT(*)::int n FROM "ACADEMICA" WHERE "usuarioId" = ANY($1::text[]) OR "contrato" = $2`, [ids, contrato])).rows[0].n;
      if (ac) problemas.push(`${ac} ficha(s) académica(s) apuntan a él`);
      const pagos = (await c.query(`SELECT * FROM "PAGOS_TITULARES" WHERE "idPeople" = ANY($1::text[])`, [ids])).rows;
      const persona = pagos.filter(p => p.validado === true && p.validadoPor && !String(p.validadoPor).toLowerCase().startsWith('migracion'));
      if (persona.length) problemas.push(`${persona.length} pago(s) validado(s) por persona`);
      const fin = (await c.query(`SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato])).rows;
      const kids = (await c.query(`SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "contrato" = $1`, [contrato]).catch(() => ({ rows: [] }))).rows;
      const firmado = people.some(p => String(p.hashConsentimiento || '') !== '');

      resumen.push({
        contrato, aprobado, titular: tit ? `${tit.primerNombre || ''} ${tit.primerApellido || ''}`.trim() : '—',
        aprobacion: tit?.aprobacion || '—', firmado: firmado ? 'sí' : 'no',
        filas: `${people.length} (${people.filter(p => p.tipoUsuario !== 'TITULAR').length} benef.)`,
        pagos: pagos.length ? `${pagos.length} · ${fmt(pagos.reduce((s, p) => s + Number(p.valorPagado || 0), 0))}` : '0',
        financieros: fin.length, estado: problemas.length ? `⛔ ${problemas.join('; ')}` : 'OK → borrar',
      });
      if (problemas.length) { abortados++; continue; }

      const snapshot = { people, financieros: fin, pagos, kidsInscripciones: kids, contratoAprobado: aprobado };
      backup.push({ contrato, ...snapshot });
      await c.query(
        `INSERT INTO "PURGE_LOG" ("_id","tipoPurga","contrato","titularId","titularNombre","snapshot","motivo","realizadoPor","realizadoPorNombre","filasBorradas")
         VALUES ($1,'BORRADOR_REHECHO',$2,$3,$4,$5::jsonb,$6,'script:purge-borradores-pagos-duplicados','Claude (autorizado por plataformalgsdigital)',$7::jsonb)`,
        [`aud_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`, contrato, tit?._id || null,
         tit ? `${tit.primerNombre || ''} ${tit.primerApellido || ''}`.trim() : null, JSON.stringify(snapshot), MOTIVO,
         JSON.stringify({ people: people.length, financieros: fin.length, pagos: pagos.length, kidsInscripciones: kids.length })]);
      await c.query(`DELETE FROM "PAGOS_TITULARES" WHERE "idPeople" = ANY($1::text[])`, [ids]);
      await c.query(`DELETE FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato]);
      await c.query(`DELETE FROM "KIDS_INSCRIPCIONES" WHERE "contrato" = $1`, [contrato]).catch(() => null);
      await c.query(`DELETE FROM "PEOPLE" WHERE "contrato" = $1`, [contrato]);
    }
    console.table(resumen);
    console.log(`A borrar: ${backup.length} · bloqueados: ${abortados}`);

    if (APPLY) {
      fs.writeFileSync('docs/backup-borradores-rehechos-2026-10-05.json', JSON.stringify(backup, null, 2));
      await c.query('COMMIT');
      console.log(`\n✅ APLICADO: ${backup.length} contrato(s) borrado(s). Snapshot en PURGE_LOG (BORRADOR_REHECHO) y docs/backup-borradores-rehechos-2026-10-05.json`);
    } else { await c.query('ROLLBACK'); console.log('\nDRY-RUN: ROLLBACK, no se borró nada. Use --apply para aplicar.'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR (ROLLBACK):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
