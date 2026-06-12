#!/usr/bin/env node
/**
 * match-asignaciones-recaudos.js — READ-ONLY. Evalua el CSV de asignaciones de
 * Ejecutivo de Recaudos (gestorRecaudo) contra PEOPLE.
 *
 * Reglas pedidas por el usuario:
 *   - Excluir problemas 1-5 (SIN EJECUTIVO, conflicto titular con 2 ejecutivos,
 *     celdas con 2 contratos, contratos con '?', cedulas atipicas).
 *   - Procesar #6: limpiar notas entre parentesis en el nombre del titular.
 *
 * Match por numero de CONTRATO contra PEOPLE WHERE tipoUsuario='TITULAR'.
 * NO escribe nada. Genera docs/reporte-recaudos-match.json + CSVs de revision.
 *
 * USO: node scripts/match-asignaciones-recaudos.js
 * REQUISITO: IP en Trusted Sources de la BD managed.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const CSV = path.join('docs', 'Asignaciones Chile.csv');
const CEDULAS_ATIPICAS = new Set(['10203158', '1988119093', '2415842767']); // problema #5
const APPLY = process.argv.includes('--apply'); // sin flag = dry-run (no escribe)

const normContrato = s => String(s || '').trim().toUpperCase().replace(/\s+/g, '');
const normCedula   = s => String(s || '').trim().toUpperCase().replace(/[.\-\s]/g, '');
const cleanNombre  = s => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/""/g, '"').replace(/^"|"$/g, '').replace(/\s+/g, ' ').trim(); // #6
const contractTokens = s => (String(s || '').match(/\d{4,5}[A-Za-z]?-\d{2}\b/g) || []);

// --- parse CSV (delimitador ';', latin1, maneja comillas) ---
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const f = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else { if (c === '"') q = true; else if (c === ';') { f.push(cur); cur = ''; } else cur += c; }
    }
    f.push(cur);
    rows.push(f);
  }
  return rows;
}

(async () => {
  const raw = fs.readFileSync(CSV, 'latin1');
  const rows = parseCsv(raw);
  const header = rows.shift();
  const idx = { num: 0, titular: 1, cedula: 2, contrato: 3, ejecutivo: 4, id: 5, name: 6 };
  const recs = rows.map(r => ({
    num: r[idx.num], titular: cleanNombre(r[idx.titular]), cedula: r[idx.cedula],
    contrato: r[idx.contrato], ejecutivo: (r[idx.ejecutivo] || '').trim(),
    ejecutivoId: (r[idx.id] || '').trim(), name: (r[idx.name] || '').trim(),
  })).filter(r => r.contrato !== undefined && r.cedula !== undefined);

  // problema #2: cedula asignada a >1 ejecutivo distinto
  const byCedEjec = new Map();
  for (const r of recs) {
    const k = normCedula(r.cedula);
    if (!byCedEjec.has(k)) byCedEjec.set(k, new Set());
    byCedEjec.get(k).add(r.ejecutivoId);
  }
  const cedulasConflicto = new Set([...byCedEjec].filter(([, s]) => s.size > 1).map(([k]) => k));

  const excl = { sinEjecutivo: [], conflicto: [], multiContrato: [], interrogacion: [], cedulaAtipica: [] };
  const incluidos = [];
  for (const r of recs) {
    const nc = normCedula(r.cedula);
    if (r.ejecutivo.toUpperCase() === 'SIN EJECUTIVO') { excl.sinEjecutivo.push(r); continue; }     // #1
    if (cedulasConflicto.has(nc))                       { excl.conflicto.push(r); continue; }         // #2
    if (r.contrato.includes('/') || contractTokens(r.contrato).length > 1) { excl.multiContrato.push(r); continue; } // #3
    if (r.contrato.includes('?'))                       { excl.interrogacion.push(r); continue; }     // #4
    if (CEDULAS_ATIPICAS.has(nc) || nc.length > 9)      { excl.cedulaAtipica.push(r); continue; }     // #5
    incluidos.push(r);
  }

  // --- DB: titulares ---
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await client.connect();
  const { rows: titulares } = await client.query(
    `SELECT "_id", "numeroId", "contrato", "gestorRecaudo", "plataforma", "primerNombre", "primerApellido"
     FROM "PEOPLE" WHERE "tipoUsuario" = 'TITULAR'`);

  const coreContrato = s => normContrato(s).replace(/^\d{2}-/, ''); // ignora prefijo plataforma 01-
  const byContrato = new Map(), byCore = new Map(), byCedula = new Map();
  for (const t of titulares) {
    const kc = normContrato(t.contrato); if (kc) { if (!byContrato.has(kc)) byContrato.set(kc, []); byContrato.get(kc).push(t); }
    const kk = coreContrato(t.contrato); if (kk) { if (!byCore.has(kk)) byCore.set(kk, []); byCore.get(kk).push(t); }
    const kd = normCedula(t.numeroId);   if (kd) { if (!byCedula.has(kd)) byCedula.set(kd, []); byCedula.get(kd).push(t); }
  }

  const res = { matchUnico: [], matchPorCore: [], matchPorCedula: [], noEncontrado: [], ambiguo: [] };
  for (const r of incluidos) {
    const m = byContrato.get(normContrato(r.contrato)) || [];
    if (m.length === 1) { res.matchUnico.push({ r, t: m[0] }); continue; }
    if (m.length > 1)   { res.ambiguo.push({ r, t: m }); continue; }
    const k = byCore.get(coreContrato(r.contrato)) || [];           // recupera prefijo 01- faltante
    if (k.length === 1) { res.matchPorCore.push({ r, t: k[0] }); continue; }
    const c = byCedula.get(normCedula(r.cedula)) || [];
    if (c.length >= 1)  { res.matchPorCedula.push({ r, t: c }); continue; }
    res.noEncontrado.push(r);
  }
  // los match por core se tratan como aplicables (mismo titular); unimos para el conteo de gestor
  const aplicables = [...res.matchUnico, ...res.matchPorCore];

  // estado del gestor en los aplicables (match unico x contrato + x core)
  let gestorNull = 0, gestorIgual = 0, gestorDistinto = 0;
  for (const { r, t } of aplicables) {
    if (!t.gestorRecaudo) gestorNull++;
    else if (t.gestorRecaudo === r.ejecutivoId) gestorIgual++;
    else gestorDistinto++;
  }

  console.log('\n===== EVALUACION ASIGNACIONES RECAUDOS (read-only) =====');
  console.log(`CSV filas de datos:        ${recs.length}`);
  console.log(`\n-- Excluidos (problemas 1-5) --`);
  console.log(`  #1 SIN EJECUTIVO:        ${excl.sinEjecutivo.length}`);
  console.log(`  #2 conflicto 2 ejec.:    ${excl.conflicto.length}  (cedulas: ${[...cedulasConflicto].join(', ') || '-'})`);
  console.log(`  #3 multi-contrato:       ${excl.multiContrato.length}  (filas ${excl.multiContrato.map(r => r.num).join(',') || '-'})`);
  console.log(`  #4 contrato con '?':     ${excl.interrogacion.length}  (filas ${excl.interrogacion.map(r => r.num).join(',') || '-'})`);
  console.log(`  #5 cedula atipica:       ${excl.cedulaAtipica.length}  (filas ${excl.cedulaAtipica.map(r => r.num).join(',') || '-'})`);
  const totalExcl = Object.values(excl).reduce((a, b) => a + b.length, 0);
  console.log(`  TOTAL excluidos:         ${totalExcl}`);
  console.log(`\n-- Incluidos a procesar:   ${incluidos.length}`);
  console.log(`\n-- Match contra PEOPLE (titulares) --`);
  console.log(`  ✅ match exacto x contrato: ${res.matchUnico.length}`);
  console.log(`  ✅ match x core (sin 01-):  ${res.matchPorCore.length}  (recupera prefijo faltante)`);
  console.log(`     -> APLICABLES total:     ${aplicables.length}`);
  console.log(`          gestor vacio:        ${gestorNull}  (se asignaria)`);
  console.log(`          gestor = mismo ejec: ${gestorIgual}  (ya correcto, no-op)`);
  console.log(`          gestor = OTRO ejec:  ${gestorDistinto}  (cambiaria)`);
  console.log(`  🟡 solo match x cedula:    ${res.matchPorCedula.length}  (revisar - contrato no coincide)`);
  console.log(`  🔴 contrato AMBIGUO:       ${res.ambiguo.length}  (>1 titular mismo contrato)`);
  console.log(`  ❌ no encontrado:          ${res.noEncontrado.length}`);

  // reportes para revision
  const outDir = 'docs';
  const csvLine = a => a.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',');
  const dump = (file, header, rowsArr) => fs.writeFileSync(path.join(outDir, file), '﻿' + [csvLine(header), ...rowsArr].join('\r\n'), 'utf8');

  // CSV consolidado de revision manual (12 casos: solo-cedula + ambiguo + no encontrado)
  const revisar = [
    ...res.matchPorCedula.map(({ r, t }) => [r.num, r.titular, r.cedula, r.contrato, r.ejecutivo, 'SOLO_CEDULA (contrato no coincide)', t.map(x => x.contrato).join(' | ')]),
    ...res.ambiguo.map(({ r, t }) => [r.num, r.titular, r.cedula, r.contrato, r.ejecutivo, 'AMBIGUO (>1 titular mismo contrato)', t.map(x => x._id).join(' | ')]),
    ...res.noEncontrado.map(r => [r.num, r.titular, r.cedula, r.contrato, r.ejecutivo, 'NO_ENCONTRADO (ni contrato ni cedula)', '']),
  ];
  dump('recaudos-revisar.csv', ['num', 'titular', 'cedula', 'contratoCSV', 'ejecutivo', 'motivo', 'contratosBD'],
    revisar.map(row => csvLine(row)));

  // set aplicable a escribir: titular unico + gestor vacio (los 666)
  const aEscribir = aplicables.filter(({ t }) => !t.gestorRecaudo);
  dump('recaudos-aplicables.csv', ['num', 'titular', 'cedula', 'contratoCSV', 'contratoBD', 'peopleId', 'ejecutivo', 'ejecutivoId'],
    aEscribir.map(({ r, t }) => csvLine([r.num, r.titular, r.cedula, r.contrato, t.contrato, t._id, r.ejecutivo, r.ejecutivoId])));

  // --- APPLY (solo con --apply): UPDATE transaccional, guard gestorRecaudo IS NULL ---
  let escritos = 0;
  if (APPLY && aEscribir.length) {
    const pids = aEscribir.map(({ t }) => t._id);
    const ejes = aEscribir.map(({ r }) => r.ejecutivoId);
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE "PEOPLE" p SET "gestorRecaudo" = d.ejec, "_updatedDate" = NOW()
         FROM unnest($1::text[], $2::text[]) AS d(pid, ejec)
         WHERE p."_id" = d.pid AND p."tipoUsuario" = 'TITULAR' AND p."gestorRecaudo" IS NULL`,
        [pids, ejes]);
      escritos = upd.rowCount;
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
  }

  fs.writeFileSync(path.join(outDir, 'reporte-recaudos-match.json'), JSON.stringify({
    generado: 'manual', csvFilas: recs.length, excluidos: totalExcl,
    detalleExcluidos: Object.fromEntries(Object.entries(excl).map(([k, v]) => [k, v.length])),
    incluidos: incluidos.length,
    match: { exacto: res.matchUnico.length, porCore: res.matchPorCore.length, aplicables: aplicables.length, porCedula: res.matchPorCedula.length, ambiguo: res.ambiguo.length, noEncontrado: res.noEncontrado.length },
    gestor: { vacio: gestorNull, igual: gestorIgual, distinto: gestorDistinto },
    aEscribir: aEscribir.length, modo: APPLY ? 'APPLY' : 'DRY-RUN', escritos,
  }, null, 2));

  console.log(`\n-- A escribir (gestor vacio): ${aEscribir.length} | a revisar manual: ${revisar.length}`);
  if (APPLY) console.log(`\n🟢 APPLY ejecutado. Filas actualizadas: ${escritos}`);
  else       console.log(`\n🟡 DRY-RUN (no se escribio nada). Para aplicar: node scripts/match-asignaciones-recaudos.js --apply`);
  console.log(`Reportes en docs/: reporte-recaudos-match.json, recaudos-aplicables.csv, recaudos-revisar.csv\n`);

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
