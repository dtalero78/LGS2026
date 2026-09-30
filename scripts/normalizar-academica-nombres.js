// Normaliza los 4 campos de nombre en ACADEMICA:
//   (1) Limpia espacios de borde y colapsa espacios dobles.
//   (2) Rellena segundoNombre/segundoApellido VACIOS desde PEOPLE
//       (preferido = BENEFICIARIO por numeroId normalizado). NUNCA pisa
//       un valor ya existente en ACADEMICA.
// Las divergencias de primer nombre/apellido (16+21) NO se tocan: se
// exportan a CSV para revision manual.
//
// Dry-run por defecto. Escribe solo con --apply. Todo en transaccion.
// Idempotente: solo actualiza filas cuyo valor normalizado difiere.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

// Expresion de normalizacion de un campo -> NULL si queda vacio.
const norm = (expr) => `NULLIF(TRIM(REGEXP_REPLACE(COALESCE(${expr},''), '\\s+', ' ', 'g')), '')`;
// numeroId normalizado (solo alfanumerico, mayusculas) para el match PEOPLE<->ACADEMICA.
const NID = (col) => `REGEXP_REPLACE(UPPER(${col}), '[^0-9A-Z]', '', 'g')`;

// CTE: un registro PEOPLE por numeroId, prefiriendo BENEFICIARIO.
const PPL_CTE = `
  ppl AS (
    SELECT DISTINCT ON (${NID('"numeroId"')})
           ${NID('"numeroId"')} AS nid,
           "primerNombre" pn, "segundoNombre" sn,
           "primerApellido" pa, "segundoApellido" sa
      FROM "PEOPLE"
     ORDER BY ${NID('"numeroId"')},
              (CASE WHEN "tipoUsuario"='BENEFICIARIO' THEN 0 ELSE 1 END)
  )`;

// CTE: valores normalizados objetivo por fila de ACADEMICA.
//  - primer nombre/apellido: solo se limpian (no se toma de PEOPLE).
//  - segundo nombre/apellido: si ACADEMICA esta vacio, se toma de PEOPLE.
const CALC_CTE = `
  calc AS (
    SELECT a."_id",
      ${norm('a."primerNombre"')}  AS n_pn,
      COALESCE(${norm('a."segundoNombre"')},  ${norm('p.sn')}) AS n_sn,
      ${norm('a."primerApellido"')} AS n_pa,
      COALESCE(${norm('a."segundoApellido"')}, ${norm('p.sa')}) AS n_sa
    FROM "ACADEMICA" a
    LEFT JOIN ppl p ON p.nid = ${NID('a."numeroId"')}
  )`;

// Predicado de "fila cambia" (tratando '' y NULL como equivalentes).
const CHANGED = `(
     ${norm('a."primerNombre"')}    IS DISTINCT FROM c.n_pn
  OR ${norm('a."segundoNombre"')}   IS DISTINCT FROM c.n_sn
  OR ${norm('a."primerApellido"')}  IS DISTINCT FROM c.n_pa
  OR ${norm('a."segundoApellido"')} IS DISTINCT FROM c.n_sa
)`;

function toCsv(rows, cols) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // ---- Conteos de alcance (siempre, solo lectura) ----
  const scope = (await c.query(`
    WITH ${PPL_CTE}, ${CALC_CTE}
    SELECT
      COUNT(*) FILTER (WHERE ${CHANGED})::int AS filas_a_actualizar,
      COUNT(*) FILTER (WHERE ${norm('a."segundoNombre"')}   IS NULL AND c.n_sn IS NOT NULL)::int AS backfill_2do_nombre,
      COUNT(*) FILTER (WHERE ${norm('a."segundoApellido"')} IS NULL AND c.n_sa IS NOT NULL)::int AS backfill_2do_apellido,
      COUNT(*) FILTER (WHERE (${norm('a."primerNombre"')}    IS DISTINCT FROM c.n_pn
                          OR  ${norm('a."segundoNombre"')}   IS DISTINCT FROM c.n_sn
                          OR  ${norm('a."primerApellido"')}  IS DISTINCT FROM c.n_pa
                          OR  ${norm('a."segundoApellido"')} IS DISTINCT FROM c.n_sa)
                        AND NOT (${norm('a."segundoNombre"')}   IS NULL AND c.n_sn IS NOT NULL)
                        AND NOT (${norm('a."segundoApellido"')} IS NULL AND c.n_sa IS NOT NULL))::int AS solo_espacios
    FROM "ACADEMICA" a
    JOIN calc c ON c."_id" = a."_id"`)).rows[0];

  console.log(`\n== Alcance normalizacion ACADEMICA ==  (modo: ${APPLY ? 'APPLY' : 'DRY-RUN'})`);
  console.table([scope]);

  // ---- Muestra antes/despues ----
  const sample = (await c.query(`
    WITH ${PPL_CTE}, ${CALC_CTE}
    SELECT a."numeroId",
      (COALESCE(a."primerNombre",'∅')||'|'||COALESCE(a."segundoNombre",'∅')||'|'||COALESCE(a."primerApellido",'∅')||'|'||COALESCE(a."segundoApellido",'∅')) AS antes,
      (COALESCE(c.n_pn,'∅')||'|'||COALESCE(c.n_sn,'∅')||'|'||COALESCE(c.n_pa,'∅')||'|'||COALESCE(c.n_sa,'∅')) AS despues
    FROM "ACADEMICA" a JOIN calc c ON c."_id"=a."_id"
    WHERE ${CHANGED} LIMIT 15`)).rows;
  console.log('\nMuestra antes -> despues (primerN|segundoN|primerA|segundoA):');
  console.table(sample);

  // ---- CSV de divergencias de primer nombre/apellido (siempre) ----
  const div = (await c.query(`
    WITH ${PPL_CTE}
    SELECT a."_id" AS academica_id, a."numeroId",
      a."primerNombre"  AS acad_primer_nombre,  p.pn AS people_primer_nombre,
      a."primerApellido" AS acad_primer_apellido, p.pa AS people_primer_apellido,
      a."tipoUsuario"
    FROM "ACADEMICA" a JOIN ppl p ON p.nid = ${NID('a."numeroId"')}
    WHERE UPPER(TRIM(COALESCE(a."primerNombre",'')))   <> UPPER(TRIM(COALESCE(p.pn,'')))
       OR UPPER(TRIM(COALESCE(a."primerApellido",''))) <> UPPER(TRIM(COALESCE(p.pa,'')))
    ORDER BY a."numeroId"`)).rows;
  const csvPath = path.join(__dirname, '..', 'docs', 'divergencias-primer-nombre-apellido.csv');
  fs.writeFileSync(csvPath, '﻿' + toCsv(div, [
    'academica_id','numeroId','acad_primer_nombre','people_primer_nombre',
    'acad_primer_apellido','people_primer_apellido','tipoUsuario']), 'utf8');
  console.log(`\nDivergencias primer nombre/apellido (revision manual): ${div.length}  ->  ${csvPath}`);

  if (!APPLY) {
    await c.end();
    console.log('\nDRY-RUN: no se escribio nada. Corre con --apply para aplicar.');
    return;
  }

  // ---- APPLY (transaccional) ----
  await c.query('BEGIN');
  const upd = await c.query(`
    WITH ${PPL_CTE}, ${CALC_CTE}
    UPDATE "ACADEMICA" a
       SET "primerNombre"   = c.n_pn,
           "segundoNombre"  = c.n_sn,
           "primerApellido" = c.n_pa,
           "segundoApellido"= c.n_sa
      FROM calc c
     WHERE a."_id" = c."_id" AND ${CHANGED}`);
  await c.query('COMMIT');
  console.log(`\n✅ APPLY OK: ${upd.rowCount} fila(s) actualizada(s).`);

  await c.end();
})().catch(async e => { console.error('ERROR:', e.message); process.exit(1); });
