/**
 * filiales-equipo-comercial-csv.js
 *
 * Asignación MANUAL de filial a los comerciales de EQUIPO_COMERCIAL que no la tienen.
 *
 *   node scripts/filiales-equipo-comercial-csv.js --exportar [--file docs/x.csv]
 *     → CSV (separador ';', UTF-8 con BOM para Excel) con los comerciales ACTIVOS sin
 *       filial: correo (llave), nombre, pais, contratos, ultimo_contrato, dias_sin_contrato,
 *       filiales_validas (las del catálogo de su país), y dos columnas para llenar:
 *         filial      → nombre exacto de una filial del país (vacío = no cambia)
 *         desactivar  → SI para marcarlo inactivo (ya no está en el CRM)
 *
 *   node scripts/filiales-equipo-comercial-csv.js --cargar --file docs/x.csv [--apply]
 *     → valida cada fila (correo existe, filial del catálogo ACTIVO de su país) y la
 *       escribe. Solo llena filiales vacías: nunca pisa una ya asignada.
 *
 * Dry-run por defecto en --cargar; --apply escribe en una transacción.
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
const fs = require('fs');

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes('--apply');
const FILE = arg('--file') || 'docs/equipo-comercial-sin-filial.csv';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
const csvCampo = (v) => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function parseCsv(texto) {
  texto = texto.replace(/^﻿/, '');
  const sep = (texto.split(/\r?\n/)[0].match(/;/g) || []).length >= (texto.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  const filas = []; let fila = [], campo = '', q = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (q) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') q = false; else campo += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = ''; if (fila.some((x) => x.trim())) filas.push(fila); fila = [];
    } else campo += ch;
  }
  fila.push(campo); if (fila.some((x) => x.trim())) filas.push(fila);
  const [cab, ...resto] = filas;
  const h = cab.map((x) => x.trim().toLowerCase());
  return resto.map((f) => Object.fromEntries(h.map((k, i) => [k, (f[i] || '').trim()])));
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const catalogo = (await c.query(`SELECT "nombre","plataforma" FROM "FILIALES" WHERE "activo" = true ORDER BY "plataforma","nombre"`)).rows;
    const porPais = {};
    catalogo.forEach((f) => { (porPais[f.plataforma] = porPais[f.plataforma] || []).push(f.nombre); });

    if (process.argv.includes('--exportar')) {
      const r = await c.query(`
        SELECT e."correo", e."nombre", e."plataforma",
               COUNT(p."_id")::int AS contratos, MAX(p."fechaCreacion")::date AS ultimo
          FROM "EQUIPO_COMERCIAL" e
          LEFT JOIN "PEOPLE" p ON p."tipoUsuario" = 'TITULAR'
               AND LOWER(TRIM(p."asesor")) = LOWER(TRIM(e."correo")) AND COALESCE(p."contrato",'') NOT LIKE 'PRB-%'
         WHERE COALESCE(TRIM(e."filial"),'') = '' AND e."activo" IS NOT false
         GROUP BY e."_id" ORDER BY e."plataforma", MAX(p."fechaCreacion") DESC NULLS LAST, e."nombre"`);
      const hoy = Date.now();
      const cab = ['correo', 'nombre', 'pais', 'contratos', 'ultimo_contrato', 'dias_sin_contrato', 'filiales_validas', 'filial', 'desactivar'];
      const lineas = [cab.join(';')].concat(r.rows.map((x) => [
        x.correo, x.nombre, x.plataforma, x.contratos,
        x.ultimo ? x.ultimo.toISOString().slice(0, 10) : '',
        x.ultimo ? Math.round((hoy - new Date(x.ultimo)) / 864e5) : '',
        (porPais[x.plataforma] || []).join(' / '), '', '',
      ].map(csvCampo).join(';')));
      fs.writeFileSync(FILE, '﻿' + lineas.join('\r\n') + '\r\n', 'utf8');
      console.log(`✅ ${r.rows.length} comerciales → ${FILE}`);
      return;
    }

    if (!process.argv.includes('--cargar')) { console.log('Use --exportar o --cargar --file <csv> [--apply]'); return; }
    const filas = parseCsv(fs.readFileSync(FILE, 'utf8'));
    const plan = [], errores = [];
    for (const f of filas) {
      const filial = f.filial || '', desact = norm(f.desactivar) === 'SI';
      if (!filial && !desact) continue;
      const e = (await c.query(`SELECT "_id","correo","plataforma","filial","activo" FROM "EQUIPO_COMERCIAL" WHERE LOWER(TRIM("correo")) = LOWER(TRIM($1))`, [f.correo])).rows[0];
      if (!e) { errores.push({ correo: f.correo, error: 'no existe en EQUIPO_COMERCIAL' }); continue; }
      let fil = null;
      if (filial) {
        fil = (porPais[e.plataforma] || []).find((n) => norm(n) === norm(filial));
        if (!fil) { errores.push({ correo: f.correo, error: `filial "${filial}" no está en el catálogo activo de ${e.plataforma}` }); continue; }
        if ((e.filial || '').trim()) { errores.push({ correo: f.correo, error: `ya tiene filial ${e.filial} (no se pisa)` }); fil = null; }
      }
      if (fil || (desact && e.activo !== false)) plan.push({ id: e._id, correo: e.correo, pais: e.plataforma, filial: fil || '', desactivar: desact && e.activo !== false });
    }
    console.table(plan.map(({ id, ...x }) => x));
    if (errores.length) { console.log('⚠️  Filas con problema (no se aplican):'); console.table(errores); }
    if (!APPLY) { console.log('(dry-run — use --apply para escribir)'); return; }
    await c.query('BEGIN');
    try {
      for (const x of plan) {
        if (x.filial) await c.query(`UPDATE "EQUIPO_COMERCIAL" SET "filial"=$2,"_updatedDate"=NOW() WHERE "_id"=$1 AND COALESCE(TRIM("filial"),'')=''`, [x.id, x.filial]);
        if (x.desactivar) await c.query(`UPDATE "EQUIPO_COMERCIAL" SET "activo"=false,"_updatedDate"=NOW() WHERE "_id"=$1`, [x.id]);
      }
      await c.query('COMMIT');
      console.log(`✅ ${plan.length} comerciales actualizados.`);
    } catch (e) { await c.query('ROLLBACK'); throw e; }
  } finally { await c.end(); }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
