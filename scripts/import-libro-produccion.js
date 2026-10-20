/**
 * import-libro-produccion.js — carga ÚNICA desde un Libro de Producción (Google Sheets)
 * de lo que todavía no existe en LGS para los contratos ya creados:
 *   escalera comercial del día de la matrícula (Full Executive, Jefe de grupo, Gerente,
 *   Gerente división, Sales Manager, Filial), Origen matrícula y las casillas
 *   Suscripción de pago / Prixus.
 *
 * Entrada: JSON { CHILE: csv, COLOMBIA: csv, ECUADOR: csv[, PERU: csv] } descargado del
 * libro (gviz CSV, headers=0). Las columnas se ubican por NOMBRE (cambian de posición
 * entre países). Cruce por N° de contrato contra el TITULAR en PEOPLE.
 * Nunca pisa un dato que ya exista en LGS (solo llena vacíos; casillas solo false→true).
 * Dry-run por defecto; --apply escribe en una transacción.
 *
 * Uso: node scripts/import-libro-produccion.js --json=docs/libro-produccion-oct-2026.json [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
const APPLY = process.argv.includes('--apply');
const ruta = arg('json');
if (!ruta) { console.error('Falta --json=ruta'); process.exit(1); }

let raw = JSON.parse(fs.readFileSync(ruta, 'utf8'));
if (typeof raw === 'string') raw = JSON.parse(raw); // el navegador lo guardó como string JSON

function parseCsv(txt) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"' && txt[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const norm = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const limpio = (v) => { const s = String(v || '').replace(/\s+/g, ' ').trim(); return !s || /^(N\/?A|NA|-|PENDIENTE)$/i.test(s) ? null : s; };
const si = (v) => /^S[IÍ]$/i.test(String(v || '').trim());

/** Índice de columna por nombre, mirando las dos filas de encabezado. */
function columnas(h1, h2) {
  const idx = {};
  const max = Math.max(h1.length, h2.length);
  for (let i = 0; i < max; i++) {
    for (const n of [norm(h1[i]), norm(h2[i])]) if (n && idx[n] === undefined) idx[n] = i;
  }
  return idx;
}

const CAMPOS = [
  ['fullExecutive', ['FULL EXECUTIVE']],
  ['jefeGrupo', ['JEFE DE GRUPO']],
  ['gerente', ['GERENTE']],
  ['gerenteDivision', ['GERENTE DIV', 'GERENTE DIVISION']],
  ['salesManager', ['SALES MANAGER']],
  ['filial', ['FILIAL']],
  ['origenMatricula', ['ORIGEN MATRICULA']],
];

const filas = [];
for (const [pais, csv] of Object.entries(raw)) {
  const rows = parseCsv(csv);
  if (rows.length < 3) continue;
  const c = columnas(rows[0], rows[1]);
  const iContrato = c['N°CONTRATO'];
  if (iContrato === undefined) { console.warn(`${pais}: sin columna N°CONTRATO, se omite`); continue; }
  const pos = (nombres) => nombres.map((n) => c[n]).find((x) => x !== undefined);
  for (const r of rows.slice(2)) {
    const contrato = String(r[iContrato] || '').trim();
    if (!/^\d{2}-\d+[A-Z]?-\d{2}$/i.test(contrato)) continue;
    const datos = {};
    for (const [campo, nombres] of CAMPOS) { const i = pos(nombres); datos[campo] = i === undefined ? null : limpio(r[i]); }
    const iSus = c['SUSCRICION DE PAGO'] ?? c['SUSCRIPCION DE PAGO'];
    const iPrx = c['PRIXUS'];
    datos.suscripcionPago = iSus !== undefined && si(r[iSus]);
    datos.prixus = iPrx !== undefined && si(r[iPrx]);
    filas.push({ pais, contrato, datos });
  }
}
console.log(`Filas con contrato en el libro: ${filas.length} (${Object.entries(filas.reduce((a, f) => (a[f.pais] = (a[f.pais] || 0) + 1, a), {})).map(([k, v]) => `${k} ${v}`).join(', ')})`);

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const res = { actualizados: 0, sinCambios: 0, noEncontrados: [], duplicadosLibro: [] };
  const vistos = new Set();
  try {
    await c.query('BEGIN');
    for (const f of filas) {
      if (vistos.has(f.contrato)) { res.duplicadosLibro.push(f.contrato); continue; }
      vistos.add(f.contrato);
      const tit = (await c.query(
        `SELECT "_id","fullExecutive","jefeGrupo","gerente","gerenteDivision","salesManager","filial","origenMatricula","suscripcionPago","prixus"
           FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'`, [f.contrato])).rows;
      if (!tit.length) { res.noEncontrados.push(f.contrato); continue; }
      let cambio = false;
      for (const t of tit) { // si hay titulares duplicados del mismo contrato, se llenan todos
        const sets = [], vals = [];
        for (const [campo] of CAMPOS) {
          if (!t[campo] && f.datos[campo]) { vals.push(f.datos[campo]); sets.push(`"${campo}" = $${vals.length}`); }
        }
        if (f.datos.suscripcionPago && !t.suscripcionPago) sets.push(`"suscripcionPago" = true`);
        if (f.datos.prixus && !t.prixus) sets.push(`"prixus" = true`);
        if (!sets.length) continue;
        vals.push(t._id);
        await c.query(`UPDATE "PEOPLE" SET ${sets.join(', ')}, "_updatedDate" = NOW() WHERE "_id" = $${vals.length}`, vals);
        cambio = true;
      }
      cambio ? res.actualizados++ : res.sinCambios++;
    }
    console.log(`Contratos actualizados: ${res.actualizados} · ya tenían los datos: ${res.sinCambios} · no están en LGS: ${res.noEncontrados.length} · repetidos en el libro: ${res.duplicadosLibro.length}`);
    if (res.noEncontrados.length) console.log('No encontrados en LGS:', res.noEncontrados.join(', '));
    const ej = filas.slice(0, 3).map((f) => `${f.contrato}: ${JSON.stringify(f.datos)}`).join('\n');
    console.log('Ejemplo de lo leído:\n' + ej);
    if (APPLY) { await c.query('COMMIT'); console.log('✅ APLICADO.'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK, no se escribió nada (use --apply).'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR (ROLLBACK):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
