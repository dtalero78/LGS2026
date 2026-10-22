/**
 * Copia los permisos de un rol a otros roles en ROL_PERMISOS.
 *
 *   node scripts/copiar-permisos-rol.js --origen COMERCIAL --destino COMERCIAL_DIRECTOR,COMERCIAL_LIDER
 *   ... --apply              → escribe (en una transacción)
 *   ... --apply --reemplazar → el destino queda IGUAL al origen (quita lo que tenga de más)
 *
 * Por defecto (sin --reemplazar) SUMA los permisos del origen a los que el destino
 * ya tenga, así no se le quita nada. Si el rol destino no existe, se crea activo.
 * Dry-run por defecto. El caché de permisos del middleware expira en 5 min.
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { randomUUID } = require('crypto');

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes('--apply');
const REEMPLAZAR = process.argv.includes('--reemplazar');
const ORIGEN = (arg('--origen') || '').trim();
const DESTINOS = (arg('--destino') || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!ORIGEN || !DESTINOS.length) {
  console.error('Uso: --origen ROL --destino ROL1,ROL2 [--apply] [--reemplazar]');
  process.exit(1);
}

const parse = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? JSON.parse(v || '[]') : []);

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const origen = (await c.query(`SELECT "rol", "permisos" FROM "ROL_PERMISOS" WHERE "rol" = $1`, [ORIGEN])).rows[0];
  if (!origen) throw new Error(`No existe el rol origen ${ORIGEN}`);
  const permisosOrigen = parse(origen.permisos);
  console.log(`Origen ${ORIGEN}: ${permisosOrigen.length} permisos`);

  const planes = [];
  for (const rol of DESTINOS) {
    const actual = (await c.query(`SELECT "rol", "permisos" FROM "ROL_PERMISOS" WHERE "rol" = $1`, [rol])).rows[0];
    const antes = actual ? parse(actual.permisos) : [];
    const despues = REEMPLAZAR ? [...permisosOrigen] : [...new Set([...antes, ...permisosOrigen])];
    const agrega = despues.filter((p) => !antes.includes(p));
    const quita = antes.filter((p) => !despues.includes(p));
    planes.push({ rol, existe: !!actual, antes, despues });
    console.log(`\n${rol}: ${actual ? 'existe' : 'NO existe → se crea'} | ${antes.length} → ${despues.length} permisos (+${agrega.length} / -${quita.length})`);
    if (quita.length) console.log('  quita:', quita.join(', '));
  }

  if (!APPLY) {
    console.log('\nDRY-RUN: usa --apply para escribir.');
    await c.end();
    return;
  }

  try {
    await c.query('BEGIN');
    for (const p of planes) {
      if (p.existe) {
        await c.query(
          `UPDATE "ROL_PERMISOS" SET "permisos" = $1, "_updatedDate" = NOW(), "fechaActualizacion" = NOW() WHERE "rol" = $2`,
          [JSON.stringify(p.despues), p.rol]
        );
      } else {
        await c.query(
          `INSERT INTO "ROL_PERMISOS" ("_id", "rol", "permisos", "descripcion", "activo", "fechaCreacion", "fechaActualizacion", "_createdDate", "_updatedDate")
           VALUES ($1, $2, $3, $4, true, NOW(), NOW(), NOW(), NOW())`,
          [randomUUID(), p.rol, JSON.stringify(p.despues), `Permisos copiados de ${ORIGEN}`]
        );
      }
    }
    await c.query('COMMIT');
    console.log('\nAPLICADO.');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK:', e.message);
    process.exitCode = 1;
  }
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
