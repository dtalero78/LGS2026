#!/usr/bin/env node
/**
 * create-financieros-equip-table.js — crea la tabla FINANCIEROS_EQUIP.
 *
 * Registro del equipo de recaudos (una fila por ejecutivo/jefe). Se llena desde
 * "Crea UserRol" → opción Administrativo cuando el rol elegido es RECAUDOS_JEFE
 * o RECAUDO_ASIST: ese flujo crea el login en USUARIOS_ROLES y, a partir de él,
 * la fila aquí, enlazada por `usuarioRolId` (mismo patrón que EQUIPO_COMERCIAL
 * y ADVISORS.usuarioRolId).
 *
 * Relaciones (FK lógicas — USUARIOS_ROLES no tiene FK físicas en este esquema):
 *   FINANCIEROS_EQUIP.usuarioRolId → USUARIOS_ROLES._id   (la cuenta de login)
 *   FINANCIEROS_EQUIP.rol          → ROL_PERMISOS.rol     (RECAUDOS_JEFE | RECAUDO_ASIST)
 *   y por ese mismo usuarioRolId se enlaza con la cartera:
 *   PAGOS_TITULARES.gestorRecaudo = PEOPLE.gestorRecaudo = USUARIOS_ROLES._id
 *
 * Columnas: _id (PK), nombre, apellido, correo (UNIQUE ci), celular, numberid,
 *   plataforma, rol, montomensual (NUMERIC 12,2), vigenstart / vigenfinal /
 *   fechaopcional (DATE), clave (espejo del login,
 *   convención del sistema), usuarioRolId, activo, _createdDate, _updatedDate.
 *
 * Idempotente: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + índices.
 * Dry-run por defecto; --apply para escribir.
 * --backfill carga los usuarios RECAUDOS_JEFE/RECAUDO_ASIST que ya existen en
 * USUARIOS_ROLES y aún no tienen fila (montomensual queda NULL, se completa
 * después desde el panel).
 *
 * USO: node scripts/create-financieros-equip-table.js [--apply] [--backfill]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');
const BACKFILL = process.argv.includes('--backfill');

const ROLES = ['RECAUDOS_JEFE', 'RECAUDO_ASIST'];

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await c.connect();
  console.log(`\n===== CREATE FINANCIEROS_EQUIP (${APPLY ? 'APPLY' : 'DRY-RUN'}${BACKFILL ? ' +BACKFILL' : ''}) =====`);

  const exists = (await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'FINANCIEROS_EQUIP'`
  )).rowCount > 0;
  console.log(`\nTabla FINANCIEROS_EQUIP: ${exists ? 'ya existe' : 'no existe (se creará)'}`);

  // Universo del backfill: cuentas de recaudos que aún no tienen fila.
  const pendientes = (await c.query(
    `SELECT ur."_id", ur."email", ur."nombre", ur."apellido", ur."celular",
            ur."numberid", ur."plataforma", ur."rol", ur."password", ur."activo"
       FROM "USUARIOS_ROLES" ur
      WHERE ur."rol" = ANY($1::text[])
        ${exists ? `AND NOT EXISTS (
              SELECT 1 FROM "FINANCIEROS_EQUIP" fe
               WHERE fe."usuarioRolId" = ur."_id"
                  OR LOWER(TRIM(fe."correo")) = LOWER(TRIM(ur."email")))` : ''}
      ORDER BY ur."rol", ur."nombre"`,
    [ROLES],
  )).rows;
  console.log(`Cuentas de recaudos sin fila en FINANCIEROS_EQUIP: ${pendientes.length}`);
  for (const p of pendientes.slice(0, 20)) {
    console.log(`  · ${p.rol.padEnd(14)} ${(p.nombre || '—')} <${p.email}> ${p.activo ? '' : '(inactivo)'}`);
  }
  if (pendientes.length > 20) console.log(`  … y ${pendientes.length - 20} más`);

  if (!APPLY) {
    console.log('\n[dry-run] usa --apply para crear la tabla' + (BACKFILL ? ' y cargar el backfill' : '') + '\n');
    await c.end();
    return;
  }

  await c.query(`
    CREATE TABLE IF NOT EXISTS "FINANCIEROS_EQUIP" (
      "_id"          TEXT PRIMARY KEY,
      "nombre"       TEXT NOT NULL,
      "apellido"     TEXT,
      "correo"       TEXT NOT NULL,
      "celular"      TEXT,
      "numberid"     TEXT,
      "plataforma"   TEXT,
      "rol"          TEXT NOT NULL,
      "montomensual" NUMERIC(12,2),
      "vigenstart"   DATE,
      "vigenfinal"   DATE,
      "fechaopcional" DATE,
      "clave"        TEXT,
      "usuarioRolId" TEXT,
      "activo"       BOOLEAN DEFAULT true,
      "_createdDate" TIMESTAMPTZ DEFAULT NOW(),
      "_updatedDate" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Idempotencia sobre tablas ya creadas por una corrida anterior.
  for (const [col, type] of [
    ['apellido', 'TEXT'], ['celular', 'TEXT'], ['numberid', 'TEXT'],
    ['plataforma', 'TEXT'], ['rol', 'TEXT'], ['montomensual', 'NUMERIC(12,2)'],
    ['vigenstart', 'DATE'], ['vigenfinal', 'DATE'], ['fechaopcional', 'DATE'],
    ['clave', 'TEXT'], ['usuarioRolId', 'TEXT'], ['activo', 'BOOLEAN DEFAULT true'],
  ]) {
    await c.query(`ALTER TABLE "FINANCIEROS_EQUIP" ADD COLUMN IF NOT EXISTS "${col}" ${type}`);
  }

  // Un ejecutivo por correo (case-insensitive) y por cuenta de login.
  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_financieros_equip_correo" ON "FINANCIEROS_EQUIP" (LOWER(TRIM("correo")))`);
  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_financieros_equip_usuariorol" ON "FINANCIEROS_EQUIP" ("usuarioRolId") WHERE "usuarioRolId" IS NOT NULL`);
  await c.query(`CREATE INDEX IF NOT EXISTS "idx_financieros_equip_rol" ON "FINANCIEROS_EQUIP" ("rol")`);

  const cols = (await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name='FINANCIEROS_EQUIP' ORDER BY ordinal_position`
  )).rows;
  console.log(`\n✔ Tabla lista (${cols.length} columnas):`);
  for (const col of cols) console.log(`   ${col.column_name.padEnd(14)} ${col.data_type}`);

  if (BACKFILL && pendientes.length) {
    let ok = 0;
    await c.query('BEGIN');
    try {
      for (const p of pendientes) {
        await c.query(
          `INSERT INTO "FINANCIEROS_EQUIP" (
             "_id","nombre","apellido","correo","celular","numberid",
             "plataforma","rol","montomensual","clave","usuarioRolId","activo",
             "_createdDate","_updatedDate"
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,NOW(),NOW())
           ON CONFLICT DO NOTHING`,
          [
            'feq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
            p.nombre || p.email, p.apellido, p.email, p.celular, p.numberid,
            p.plataforma, p.rol, p.password, p._id, p.activo !== false,
          ],
        );
        ok++;
      }
      await c.query('COMMIT');
      console.log(`\n✔ Backfill: ${ok} fila(s) cargadas (montomensual queda NULL)`);
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  }

  const total = (await c.query(`SELECT COUNT(*)::int AS n FROM "FINANCIEROS_EQUIP"`)).rows[0].n;
  console.log(`\nTotal en FINANCIEROS_EQUIP: ${total}\n`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
