/**
 * Normaliza los teléfonos guardados SIN indicativo de país (Chile 56, Colombia 57,
 * Ecuador 593, Perú 51). Misma regla que src/lib/telefono.ts (normalizarTelefono):
 *   - solo dígitos; quita "00" internacional;
 *   - si ya trae el indicativo de un país LGS con el largo correcto → no se toca;
 *   - si es un número nacional del país del registro (sin ceros iniciales) → se
 *     antepone el indicativo;
 *   - cualquier otro caso (país desconocido, extranjero, largo raro) → NO se toca
 *     (se reporta como "revisar a mano").
 *
 * Solo modifica filas cuyo valor cambia. Dry-run por defecto.
 *
 *   node scripts/normalizar-telefonos.js            → reporte (no escribe)
 *   node scripts/normalizar-telefonos.js --apply    → aplica en una transacción
 *                                                     y guarda backup en docs/
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

const PAISES = {
  chile: { cc: '56', local: 9 },
  colombia: { cc: '57', local: 10 },
  ecuador: { cc: '593', local: 9 },
  peru: { cc: '51', local: 9 },
};
const clavePais = (p) => String(p || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const traeIndicativo = (d) => Object.values(PAISES).some((p) => d.startsWith(p.cc) && d.length === p.cc.length + p.local);

/** → { valor, estado: 'ok' | 'corregido' | 'revisar' | 'vacio' } */
function normalizar(raw, pais) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return { valor: null, estado: 'vacio' };
  if (d.startsWith('00')) d = d.slice(2);
  if (traeIndicativo(d)) return { valor: d, estado: d === String(raw) ? 'ok' : 'corregido' };
  const p = PAISES[clavePais(pais)];
  if (p) {
    const local = d.replace(/^0+/, '');
    if (local.length === p.local) return { valor: p.cc + local, estado: 'corregido' };
  }
  return { valor: raw, estado: 'revisar' };
}

// [tabla, columna, expresión SQL del país]
const CAMPOS = [
  ['PEOPLE', 'celular', '"plataforma"'],
  ['PEOPLE', 'telefono', '"plataforma"'],
  ['PEOPLE', 'telefonoRefUno', '"plataforma"'],
  ['PEOPLE', 'telefonoRefDos', '"plataforma"'],
  ['PEOPLE', 'replegalcel', '"plataforma"'],
  ['ACADEMICA', 'celular', '"plataforma"'],
  ['USUARIOS_ROLES', 'celular', '"plataforma"'],
  ['ADVISORS', 'telefono', '"pais"'],
  ['KIDS_INSCRIPCIONES', 'apoderadoTelefono', '"plataforma"'],
];

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const resumen = [];
  const cambios = []; // { tabla, columna, _id, antes, despues }
  const revisar = [];

  for (const [tabla, col, paisExpr] of CAMPOS) {
    let rows;
    try {
      rows = (await c.query(
        `SELECT "_id", "${col}" AS v, ${paisExpr} AS p FROM "${tabla}"
          WHERE "${col}" IS NOT NULL AND TRIM("${col}"::text) <> ''`
      )).rows;
    } catch (e) {
      resumen.push({ campo: `${tabla}.${col}`, error: e.message.slice(0, 60) });
      continue;
    }
    const k = { ok: 0, corregido: 0, revisar: 0 };
    for (const r of rows) {
      const n = normalizar(r.v, r.p);
      if (n.estado === 'vacio') continue;
      k[n.estado]++;
      if (n.estado === 'corregido') cambios.push({ tabla, columna: col, _id: r._id, pais: r.p, antes: r.v, despues: n.valor });
      if (n.estado === 'revisar') revisar.push({ tabla, columna: col, _id: r._id, pais: r.p, valor: r.v });
    }
    resumen.push({ campo: `${tabla}.${col}`, con_valor: rows.length, bien: k.ok, a_corregir: k.corregido, revisar_a_mano: k.revisar });
  }

  console.table(resumen);
  console.log('\nEjemplos a corregir:');
  console.table(cambios.slice(0, 12).map(({ tabla, columna, pais, antes, despues }) => ({ campo: `${tabla}.${columna}`, pais, antes, despues })));
  console.log('\nEjemplos para revisar a mano (no se tocan):');
  console.table(revisar.slice(0, 12).map(({ tabla, columna, pais, valor }) => ({ campo: `${tabla}.${columna}`, pais, valor })));

  if (!APPLY) {
    console.log(`\nDRY-RUN: ${cambios.length} valores se corregirían. Usa --apply para escribir.`);
    await c.end();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `docs/backup-normalizar-telefonos-${stamp}.json`;
  fs.writeFileSync(backup, JSON.stringify({ cambios, revisar }, null, 2));
  console.log(`\nBackup: ${backup}`);

  try {
    await c.query('BEGIN');
    for (const x of cambios) {
      await c.query(`UPDATE "${x.tabla}" SET "${x.columna}" = $1 WHERE "_id" = $2`, [x.despues, x._id]);
    }
    await c.query('COMMIT');
    console.log(`APLICADO: ${cambios.length} valores corregidos.`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK:', e.message);
    process.exitCode = 1;
  }
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
