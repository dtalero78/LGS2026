#!/usr/bin/env node
/**
 * create-cancelaciones-sin-reemplazo-table.js
 *
 * Feature "Cancelación sin reemplazo": al cancelar un evento marcando la casilla
 * "Sesión con booking" (add-on de Suspensión, excluye Restructuración), se cancela
 * la clase de los inscritos DEVOLVIENDO su cupo semanal (cancelo=true libera la
 * cuota de 2 sesiones/semana) y se snapshotea cada alumno en una tabla para que
 * el Área de Servicio los gestione (contactar / reagendar).
 *
 * Crea/asegura:
 *   1. ADVISORS.cancelada  INTEGER DEFAULT 0  — contador de por vida; +1 en cada
 *      cancelación (Suspensión o Sesión-con-booking; NO Restructuración).
 *   2. ADVISORS.noasistio  INTEGER DEFAULT 0  — contador de por vida; +1 solo en
 *      Sesión-con-booking (alimenta el ítem "No Asistió" del informe de Horas
 *      junto al ADVISOR_EVENT_LOG estado='NoAsistio').
 *   3. Tabla CANCELACIONES_SIN_REEMPLAZO — persistente (guarda histórico). Vista
 *      "Actual" = loteGestionado=false; "Histórico" = loteGestionado=true.
 *
 * Idempotente (ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS).
 * Dry-run por defecto. USO: node scripts/create-cancelaciones-sin-reemplazo-table.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== CANCELACIÓN SIN REEMPLAZO (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const colExists = async (table, col) => (await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`, [table, col])).rowCount > 0;
  const tblExists = async (table) => (await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name=$1 LIMIT 1`, [table])).rowCount > 0;

  console.log(`ADVISORS.cancelada existe:            ${(await colExists('ADVISORS', 'cancelada')) ? 'sí' : 'no'}`);
  console.log(`ADVISORS.noasistio existe:            ${(await colExists('ADVISORS', 'noasistio')) ? 'sí' : 'no'}`);
  console.log(`Tabla CANCELACIONES_SIN_REEMPLAZO:    ${(await tblExists('CANCELACIONES_SIN_REEMPLAZO')) ? 'sí' : 'no'}`);

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear columnas + tabla`); await c.end(); return; }

  await c.query(`ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "cancelada" INTEGER DEFAULT 0`);
  await c.query(`ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "noasistio" INTEGER DEFAULT 0`);

  await c.query(`
    CREATE TABLE IF NOT EXISTS "CANCELACIONES_SIN_REEMPLAZO" (
      "_id"            VARCHAR(255) PRIMARY KEY,
      "loteId"         VARCHAR(255) NOT NULL,
      "eventoId"       VARCHAR(255),
      "fechaEvento"    TIMESTAMPTZ,
      "horaEvento"     VARCHAR(10),
      "tipo"           VARCHAR(30),
      "nivel"          VARCHAR(30),
      "step"           VARCHAR(80),
      "tituloEvento"   VARCHAR(255),
      "advisorId"      VARCHAR(255),
      "advisorNombre"  VARCHAR(255),
      "studentId"      VARCHAR(255),
      "numeroId"       VARCHAR(50),
      "nombre"         VARCHAR(255),
      "telefono"       VARCHAR(50),
      "email"          VARCHAR(255),
      "gestion"        VARCHAR(30) NOT NULL DEFAULT 'SIN_GESTION',
      "gestionadaPor"  VARCHAR(20),
      "fechaGestion"   TIMESTAMPTZ,
      "loteGestionado" BOOLEAN DEFAULT false,
      "_createdDate"   TIMESTAMPTZ DEFAULT NOW(),
      "_updatedDate"   TIMESTAMPTZ DEFAULT NOW()
    )`);

  await c.query(`CREATE INDEX IF NOT EXISTS idx_cancelaciones_lote ON "CANCELACIONES_SIN_REEMPLAZO" ("loteId")`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_cancelaciones_gestionado ON "CANCELACIONES_SIN_REEMPLAZO" ("loteGestionado")`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_cancelaciones_evento ON "CANCELACIONES_SIN_REEMPLAZO" ("eventoId")`);

  const adv = (await c.query(`SELECT COUNT(*)::int total FROM "ADVISORS"`)).rows[0];
  const can = (await c.query(`SELECT COUNT(*)::int total FROM "CANCELACIONES_SIN_REEMPLAZO"`)).rows[0];
  console.log(`🟢 Listo. ADVISORS: ${adv.total} · filas en CANCELACIONES_SIN_REEMPLAZO: ${can.total}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
