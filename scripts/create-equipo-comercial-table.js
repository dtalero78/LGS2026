#!/usr/bin/env node
/**
 * create-equipo-comercial-table.js — crea la tabla EQUIPO_COMERCIAL.
 *
 * Registro del equipo comercial (una fila por comercial). Se llena desde
 * "Crea UserRol" → opción Comercial, que además crea el login en
 * USUARIOS_ROLES (rol COMERCIAL) enlazado por `usuarioRolId` (análogo a
 * ADVISORS.usuarioRolId).
 *
 * Columnas:
 *   _id (PK), nombre, correo (UNIQUE), plataforma, filial,
 *   clave (texto plano — espejo del login, convención del sistema),
 *   usuarioRolId (FK lógica a USUARIOS_ROLES._id), activo (default true),
 *   _createdDate, _updatedDate.
 *
 * Idempotente: CREATE TABLE IF NOT EXISTS + índices. Dry-run por defecto;
 * --apply para escribir.
 * USO: node scripts/create-equipo-comercial-table.js [--apply]
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
  console.log(`\n===== CREATE EQUIPO_COMERCIAL (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const exists = (await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'EQUIPO_COMERCIAL'`
  )).rowCount > 0;
  console.log(`\nTabla EQUIPO_COMERCIAL: ${exists ? 'ya existe' : 'no existe (se creará)'}`);

  if (!APPLY) { console.log('\n[dry-run] usa --apply para escribir'); await c.end(); return; }

  await c.query(`
    CREATE TABLE IF NOT EXISTS "EQUIPO_COMERCIAL" (
      "_id"          TEXT PRIMARY KEY,
      "nombre"       TEXT NOT NULL,
      "correo"       TEXT NOT NULL,
      "plataforma"   TEXT,
      "filial"       TEXT,
      "clave"        TEXT,
      "usuarioRolId" TEXT,
      "activo"       BOOLEAN DEFAULT true,
      "_createdDate" TIMESTAMPTZ DEFAULT NOW(),
      "_updatedDate" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // correo único (case-insensitive) para evitar duplicados del mismo comercial.
  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_equipo_comercial_correo" ON "EQUIPO_COMERCIAL" (LOWER(TRIM("correo")))`);
  await c.query(`CREATE INDEX IF NOT EXISTS "idx_equipo_comercial_usuariorol" ON "EQUIPO_COMERCIAL" ("usuarioRolId")`);

  const cols = (await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='EQUIPO_COMERCIAL' ORDER BY ordinal_position`
  )).rows.map(r => r.column_name);
  console.log(`\n✔ Tabla lista. Columnas: ${cols.join(', ')}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
