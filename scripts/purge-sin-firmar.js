/**
 * purge-sin-firmar.js
 *
 * Borra DEFINITIVAMENTE contratos "Sin firmar" del Centro de Aprobaciones que se
 * decidió depurar (abandonados o borradores rehechos), con respaldo completo.
 *
 * Antes de borrar vuelve a verificar EN VIVO, contrato por contrato, y lo salta si:
 *   - el titular ya firmó (hashConsentimiento) o alguna fila tiene aprobacion,
 *   - hay clases (ACADEMICA_BOOKINGS) en sus filas o alguna ficha ACADEMICA apunta a él,
 *   - tiene pagos validados por una PERSONA (solo se permiten la cuota #0 de migración),
 *   - tiene una reserva enviada a KIDS2026.
 * Borra PAGOS_TITULARES (por idPeople), FINANCIEROS, KIDS_INSCRIPCIONES y PEOPLE del
 * contrato. NO toca ACADEMICA, clases ni USUARIOS_ROLES.
 * Respaldo: PURGE_LOG (tipoPurga SIN_FIRMAR_DEPURADO) + docs/backup-sin-firmar-*.json.
 *
 * Uso:
 *   node scripts/purge-sin-firmar.js --contratos=01-1,02-2 --motivo="..."            # dry-run
 *   node scripts/purge-sin-firmar.js --csv=docs/sin-firmar-analisis-AAAA-MM-DD.csv --grupo=6 --motivo="..." [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3).trim();
const APPLY = process.argv.includes('--apply');
const MOTIVO = arg('motivo');
if (MOTIVO.length < 10) { console.error('--motivo="..." es obligatorio (≥10 caracteres)'); process.exit(1); }

function leerCsv(ruta) {
  const L = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split('\n').filter(Boolean);
  const h = L[0].split(';');
  return L.slice(1).map((l) => {
    const v = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ';' && !q) { v.push(cur); cur = ''; } else cur += ch; }
    v.push(cur);
    return Object.fromEntries(h.map((k, i) => [k, v[i]]));
  });
}

let contratos = arg('contratos').split(',').map((s) => s.trim()).filter(Boolean);
if (arg('csv')) {
  const g = arg('grupo');
  contratos = contratos.concat(leerCsv(arg('csv')).filter((r) => r.grupo.startsWith(`${g} `) || r.grupo.startsWith(`${g}·`) || r.grupo.split(' ')[0] === g).map((r) => r.contrato));
}
contratos = [...new Set(contratos)];
if (!contratos.length) { console.error('Sin contratos (--contratos o --csv + --grupo)'); process.exit(1); }

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const resumen = [], backup = [];
  try {
    await c.query('BEGIN');
    for (const contrato of contratos) {
      if (contrato.startsWith('PRB-')) { resumen.push({ contrato, estado: '⛔ contrato de prueba' }); continue; }
      const people = (await c.query(`SELECT * FROM "PEOPLE" WHERE "contrato" = $1 FOR UPDATE`, [contrato])).rows;
      if (!people.length) { resumen.push({ contrato, estado: 'ya no existe' }); continue; }
      const ids = people.map((p) => p._id);
      const tit = people.find((p) => p.tipoUsuario === 'TITULAR');
      const problemas = [];
      if (people.some((p) => String(p.hashConsentimiento || '') !== '')) problemas.push('firmado');
      // "Pendiente" no es una aprobación: el resto (Aprobado, Rechazado, Contrato nulo…) sí bloquea.
      if (people.some((p) => !['', 'PENDIENTE'].includes(String(p.aprobacion || '').trim().toUpperCase()))) problemas.push('con estado de aprobación');
      const bk = (await c.query(`SELECT COUNT(*)::int n FROM "ACADEMICA_BOOKINGS" WHERE "studentId" = ANY($1::text[]) OR "idEstudiante" = ANY($1::text[])`, [ids])).rows[0].n;
      if (bk) problemas.push(`${bk} clases`);
      const ac = (await c.query(`SELECT COUNT(*)::int n FROM "ACADEMICA" WHERE "usuarioId" = ANY($1::text[]) OR "contrato" = $2`, [ids, contrato])).rows[0].n;
      if (ac) problemas.push(`${ac} ficha(s) académica(s)`);
      const pagos = (await c.query(`SELECT * FROM "PAGOS_TITULARES" WHERE "idPeople" = ANY($1::text[])`, [ids])).rows;
      const persona = pagos.filter((p) => p.validado === true && !String(p.validadoPor || '').toLowerCase().startsWith('migracion') && !String(p.createdBy || '').startsWith('script:'));
      if (persona.length) problemas.push(`${persona.length} pago(s) validado(s) por persona`);
      const kids = (await c.query(`SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "contrato" = $1`, [contrato]).catch(() => ({ rows: [] }))).rows;
      if (kids.some((k) => k.enviadoAKids)) problemas.push('reserva en KIDS');
      const fin = (await c.query(`SELECT * FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato])).rows;
      resumen.push({
        contrato, titular: tit ? `${(tit.primerNombre || '').trim()} ${(tit.primerApellido || '').trim()}` : '—',
        filas: people.length, pagos: pagos.length, financieros: fin.length,
        estado: problemas.length ? `⛔ ${problemas.join('; ')}` : 'OK → borrar',
      });
      if (problemas.length) continue;

      const snapshot = { people, financieros: fin, pagos, kidsInscripciones: kids };
      backup.push({ contrato, ...snapshot });
      await c.query(
        `INSERT INTO "PURGE_LOG" ("_id","tipoPurga","contrato","titularId","titularNombre","snapshot","motivo","realizadoPor","realizadoPorNombre","filasBorradas")
         VALUES ($1,'SIN_FIRMAR_DEPURADO',$2,$3,$4,$5::jsonb,$6,'script:purge-sin-firmar','Claude (autorizado por plataformalgsdigital)',$7::jsonb)`,
        [`aud_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`, contrato, tit?._id || null,
         tit ? `${(tit.primerNombre || '').trim()} ${(tit.primerApellido || '').trim()}` : null, JSON.stringify(snapshot), MOTIVO,
         JSON.stringify({ people: people.length, financieros: fin.length, pagos: pagos.length, kidsInscripciones: kids.length })]);
      await c.query(`DELETE FROM "PAGOS_TITULARES" WHERE "idPeople" = ANY($1::text[])`, [ids]);
      await c.query(`DELETE FROM "FINANCIEROS" WHERE "contrato" = $1`, [contrato]);
      await c.query(`DELETE FROM "KIDS_INSCRIPCIONES" WHERE "contrato" = $1`, [contrato]).catch(() => null);
      await c.query(`DELETE FROM "PEOPLE" WHERE "contrato" = $1`, [contrato]);
    }
    const bloqueados = resumen.filter((r) => String(r.estado).startsWith('⛔'));
    console.log(`Contratos: ${contratos.length} · a borrar: ${backup.length} · bloqueados: ${bloqueados.length} · ya no existían: ${resumen.filter((r) => r.estado === 'ya no existe').length}`);
    if (bloqueados.length) console.table(bloqueados);
    if (APPLY) {
      fs.writeFileSync(`docs/backup-sin-firmar-${Date.now()}.json`, JSON.stringify(backup, null, 2));
      await c.query('COMMIT');
      console.log(`✅ APLICADO: ${backup.length} contrato(s) borrado(s). Respaldo en PURGE_LOG (SIN_FIRMAR_DEPURADO) y docs/backup-sin-firmar-*.json`);
    } else {
      await c.query('ROLLBACK');
      console.log('DRY-RUN: ROLLBACK, no se borró nada (use --apply).');
    }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR (ROLLBACK):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
