#!/usr/bin/env node
/**
 * create-filiales-table.js — crea la tabla FILIALES.
 *
 * Catálogo de filiales POR PLATAFORMA, usado en el alta de comerciales
 * ("Crea UserRol" → Comercial). Se pueden agregar y eliminar desde
 * /admin/filiales. EQUIPO_COMERCIAL.filial guarda el nombre (snapshot),
 * así que borrar una filial del catálogo no rompe comerciales ya creados.
 *
 * Columnas: _id (PK), nombre, plataforma, activo (default true),
 *           _createdDate, _updatedDate.
 * Índice único (LOWER(nombre), plataforma) → sin duplicados por plataforma.
 *
 * Idempotente: CREATE TABLE IF NOT EXISTS + índices. Dry-run por defecto;
 * --apply para escribir.
 * USO: node scripts/create-filiales-table.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await c.connect();
  console.log(`\n===== CREATE FILIALES (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const exists = (await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'FILIALES'`
  )).rowCount > 0;
  console.log(`\nTabla FILIALES: ${exists ? 'ya existe' : 'no existe (se creará)'}`);

  if (!APPLY) { console.log('\n[dry-run] usa --apply para escribir'); await c.end(); return; }

  await c.query(`
    CREATE TABLE IF NOT EXISTS "FILIALES" (
      "_id"          TEXT PRIMARY KEY,
      "nombre"       TEXT NOT NULL,
      "plataforma"   TEXT NOT NULL,
      "activo"       BOOLEAN DEFAULT true,
      "_createdDate" TIMESTAMPTZ DEFAULT NOW(),
      "_updatedDate" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_filiales_nombre_plataforma" ON "FILIALES" (LOWER(TRIM("nombre")), "plataforma")`);
  await c.query(`CREATE INDEX IF NOT EXISTS "idx_filiales_plataforma" ON "FILIALES" ("plataforma")`);

  const cols = (await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='FILIALES' ORDER BY ordinal_position`
  )).rows.map(r => r.column_name);
  console.log(`\n✔ Tabla lista. Columnas: ${cols.join(', ')}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
