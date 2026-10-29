/**
 * sync-filiales.js
 *
 * 1. Catálogo FILIALES por país: agrega las filiales que ya llegan del CRM en los
 *    contratos (PEOPLE.filial del TITULAR, con su plataforma) y que aún no están.
 *    Los nombres del catálogo se dejan iguales a los del CRM (p. ej. 'Olimpo' → 'OLIMPO')
 *    para que el filtro del Libro de Producción agrupe igual.
 * 2. EQUIPO_COMERCIAL.filial: a cada comercial SIN filial le asigna la de su contrato
 *    MÁS RECIENTE con filial (PEOPLE.asesor = correo). Nunca pisa una ya asignada.
 *
 * Idempotente. Dry-run por defecto; --apply escribe en una transacción.
 *   node scripts/sync-filiales.js
 *   node scripts/sync-filiales.js --apply
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
const crypto = require('crypto');

const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    // Filiales reales por país (del CRM), una fila por nombre normalizado + país.
    const reales = (await c.query(
      `SELECT UPPER(TRIM("filial")) AS nombre, "plataforma", COUNT(*)::int AS contratos
         FROM "PEOPLE"
        WHERE "tipoUsuario" = 'TITULAR' AND COALESCE(TRIM("filial"),'') <> '' AND COALESCE("plataforma",'') <> ''
        GROUP BY 1, 2 ORDER BY 2, 1`)).rows;
    const catalogo = (await c.query(`SELECT "_id","nombre","plataforma","activo" FROM "FILIALES"`)).rows;
    const clave = (n, p) => `${String(n).trim().toLowerCase()}|${p}`;
    const enCat = new Map(catalogo.map((f) => [clave(f.nombre, f.plataforma), f]));

    const nuevas = reales.filter((r) => !enCat.has(clave(r.nombre, r.plataforma)));
    const renombrar = reales
      .map((r) => ({ r, f: enCat.get(clave(r.nombre, r.plataforma)) }))
      .filter((x) => x.f && x.f.nombre !== x.r.nombre);

    console.log('Filiales en contratos (CRM):'); console.table(reales);
    console.log(`Nuevas en el catálogo: ${nuevas.length}`); if (nuevas.length) console.table(nuevas);
    console.log(`Renombrar al nombre del CRM: ${renombrar.length}`);
    renombrar.forEach((x) => console.log(`  ${x.f.nombre} → ${x.r.nombre} (${x.r.plataforma})`));

    // Comerciales sin filial → la de su contrato más reciente con filial.
    const asignar = (await c.query(
      `SELECT e."_id", e."correo", e."plataforma" AS pais_comercial, ult.filial, ult.plataforma AS pais_contrato, ult.fecha
         FROM "EQUIPO_COMERCIAL" e
         JOIN LATERAL (
           SELECT UPPER(TRIM(p."filial")) AS filial, p."plataforma", p."fechaCreacion"::date AS fecha
             FROM "PEOPLE" p
            WHERE p."tipoUsuario" = 'TITULAR' AND LOWER(TRIM(p."asesor")) = LOWER(TRIM(e."correo"))
              AND COALESCE(TRIM(p."filial"),'') <> ''
            ORDER BY p."fechaCreacion" DESC NULLS LAST LIMIT 1
         ) ult ON true
        WHERE COALESCE(TRIM(e."filial"),'') = ''
        ORDER BY ult.filial, e."correo"`)).rows;
    const sinDato = (await c.query(
      `SELECT COUNT(*)::int n FROM "EQUIPO_COMERCIAL" WHERE COALESCE(TRIM("filial"),'') = ''`)).rows[0].n - asignar.length;
    console.log(`Comerciales a los que se asigna filial: ${asignar.length} (quedan ${sinDato} sin contratos con filial)`);
    const resumen = {};
    asignar.forEach((a) => { resumen[a.filial] = (resumen[a.filial] || 0) + 1; });
    console.table(resumen);
    const otroPais = asignar.filter((a) => a.pais_comercial && a.pais_contrato && a.pais_comercial !== a.pais_contrato);
    if (otroPais.length) { console.log('⚠️  Filial de un país distinto al del comercial:'); console.table(otroPais); }

    if (!APPLY) { console.log('(dry-run — use --apply para escribir)'); return; }

    await c.query('BEGIN');
    try {
      for (const n of nuevas) {
        await c.query(
          `INSERT INTO "FILIALES" ("_id","nombre","plataforma","activo","_createdDate","_updatedDate")
           VALUES ($1,$2,$3,true,NOW(),NOW())`, [crypto.randomUUID(), n.nombre, n.plataforma]);
      }
      for (const x of renombrar) {
        await c.query(`UPDATE "FILIALES" SET "nombre" = $2, "activo" = true, "_updatedDate" = NOW() WHERE "_id" = $1`, [x.f._id, x.r.nombre]);
      }
      for (const a of asignar) {
        await c.query(
          `UPDATE "EQUIPO_COMERCIAL" SET "filial" = $2, "_updatedDate" = NOW()
            WHERE "_id" = $1 AND COALESCE(TRIM("filial"),'') = ''`, [a._id, a.filial]);
      }
      await c.query('COMMIT');
      console.log(`✅ Catálogo: +${nuevas.length} filiales, ${renombrar.length} renombradas · ${asignar.length} comerciales con filial.`);
    } catch (e) { await c.query('ROLLBACK'); throw e; }
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
