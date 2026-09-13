#!/usr/bin/env node
/**
 * create-exam-ciclos-table.js — SetUp Ciclo y Agrupación (Exam. Intern.)
 *
 * Crea el esquema de la funcionalidad "SetUp Ciclo y Agrupación":
 *
 *   1. Tabla "EXAM_CICLOS": 1 fila por ciclo de exámenes internacionales
 *      (ej. "Octubre2026"). Guarda nombre, rango de fechas, la configuración
 *      por examen (JSONB: franjas de días+hora+advisor+Zoom+cupo para
 *      IELTS/TOEFL/B2FIRST) y el estado (BORRADOR / GENERADO).
 *
 *   2. Columna "CALENDARIO"."cicloId" (VARCHAR): marca los eventos generados
 *      por un ciclo → permite listarlos en la pestaña Agrupación y evita
 *      regenerarlos (candado de idempotencia).
 *
 *   3. Columna "ACADEMICA_BOOKINGS"."confirmadoExamen" (BOOLEAN, nullable):
 *      estado por inscripción de examen. NULL/false = Pendiente, true =
 *      Confirmado. (Cancelado = cancelo=true, columna ya existente).
 *
 *   4. "EXAM_INTERN_AUDIT" (IF NOT EXISTS): la fuente de "confirmados" para
 *      Agrupación. Ya existe en prod (se auto-crea en exam-intern.service),
 *      pero la aseguramos aquí para que la consulta de Agrupación nunca falle.
 *
 * Columnas nullable / IF NOT EXISTS ⇒ idempotente y sin reescritura de tablas.
 * NUNCA ejecutar DDL en el request path (ver CLAUDE.md) — por eso vive aquí.
 *
 * USO:
 *   node scripts/create-exam-ciclos-table.js            # dry-run
 *   node scripts/create-exam-ciclos-table.js --apply    # aplica
 *   node scripts/create-exam-ciclos-table.js --apply --no-fw
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');
const NO_FW = process.argv.includes('--no-fw');

function getPublicIP() {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d.trim())); }).on('error', reject);
  });
}
const sh = cmd => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; } };
async function fwAdd(ip) { process.stdout.write(`🔓 Whitelisteando ${ip}...`); sh(`doctl databases firewalls append ${CLUSTER} --rule ip_addr:${ip}`); await new Promise(r => setTimeout(r, 9000)); console.log(' ok'); }
function fwRemove(ip) { const l = sh(`doctl databases firewalls list ${CLUSTER}`); const u = l.split('\n').find(x => x.includes(ip))?.trim().split(/\s+/)[0]; if (u) { sh(`doctl databases firewalls remove ${CLUSTER} --uuid ${u}`); console.log(`🔒 IP ${ip} removida`); } }

(async () => {
  let ip = null;
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    if (!NO_FW) { ip = await getPublicIP(); await fwAdd(ip); }
    await c.connect();
    console.log(`\n===== SetUp Ciclo y Agrupación — esquema (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

    const tExists = (await c.query(`SELECT 1 FROM information_schema.tables WHERE table_name='EXAM_CICLOS' LIMIT 1`)).rowCount > 0;
    const cCol = (await c.query(`SELECT 1 FROM information_schema.columns WHERE table_name='CALENDARIO' AND column_name='cicloId' LIMIT 1`)).rowCount > 0;
    const bCol = (await c.query(`SELECT 1 FROM information_schema.columns WHERE table_name='ACADEMICA_BOOKINGS' AND column_name='confirmadoExamen' LIMIT 1`)).rowCount > 0;
    const aExists = (await c.query(`SELECT 1 FROM information_schema.tables WHERE table_name='EXAM_INTERN_AUDIT' LIMIT 1`)).rowCount > 0;

    console.log(`Tabla EXAM_CICLOS:                       ${tExists ? '✅ existe' : '❌ falta'}`);
    console.log(`CALENDARIO.cicloId:                      ${cCol ? '✅ existe' : '❌ falta'}`);
    console.log(`ACADEMICA_BOOKINGS.confirmadoExamen:     ${bCol ? '✅ existe' : '❌ falta'}`);
    console.log(`Tabla EXAM_INTERN_AUDIT:                 ${aExists ? '✅ existe' : '❌ falta'}`);

    if (!APPLY) {
      console.log('\n🟡 DRY-RUN. Se ejecutaría:');
      console.log('  CREATE TABLE IF NOT EXISTS "EXAM_CICLOS" (...);');
      console.log('  ALTER TABLE "CALENDARIO" ADD COLUMN IF NOT EXISTS "cicloId" VARCHAR(50);');
      console.log('  CREATE INDEX IF NOT EXISTS "idx_calendario_cicloId" ON "CALENDARIO" ("cicloId");');
      console.log('  ALTER TABLE "ACADEMICA_BOOKINGS" ADD COLUMN IF NOT EXISTS "confirmadoExamen" BOOLEAN;');
      console.log('  CREATE TABLE IF NOT EXISTS "EXAM_INTERN_AUDIT" (...);');
      console.log('\n  Re-ejecutar con --apply para aplicar.');
      return;
    }

    console.log('\n🔴 Aplicando...\n');

    await c.query(`
      CREATE TABLE IF NOT EXISTS "EXAM_CICLOS" (
        "_id"              VARCHAR(50) PRIMARY KEY,
        "nombre"           VARCHAR(120) NOT NULL,
        "fechaInicial"     DATE NOT NULL,
        "fechaFinal"       DATE NOT NULL,
        "config"           JSONB NOT NULL DEFAULT '{}'::jsonb,
        "estado"           VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
        "eventosGenerados" INT NOT NULL DEFAULT 0,
        "creadoPor"        TEXT,
        "_createdDate"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "_updatedDate"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('  ✅ Tabla EXAM_CICLOS lista');

    await c.query(`ALTER TABLE "CALENDARIO" ADD COLUMN IF NOT EXISTS "cicloId" VARCHAR(50)`);
    await c.query(`CREATE INDEX IF NOT EXISTS "idx_calendario_cicloId" ON "CALENDARIO" ("cicloId")`);
    console.log('  ✅ CALENDARIO.cicloId + índice listos');

    await c.query(`ALTER TABLE "ACADEMICA_BOOKINGS" ADD COLUMN IF NOT EXISTS "confirmadoExamen" BOOLEAN`);
    console.log('  ✅ ACADEMICA_BOOKINGS.confirmadoExamen lista');

    await c.query(`
      CREATE TABLE IF NOT EXISTS "EXAM_INTERN_AUDIT" (
        "_id"                TEXT PRIMARY KEY,
        "studentId"          TEXT NOT NULL,
        "numeroId"           TEXT,
        "primerNombre"       TEXT,
        "primerApellido"     TEXT,
        "email"              TEXT,
        "celular"            TEXT,
        "prueba"             TEXT NOT NULL,
        "accion"             TEXT NOT NULL,
        "fechaBase"          DATE,
        "nuevoFinalContrato" DATE,
        "vigenciaAnterior"   DATE,
        "whatsappEnviado"    BOOLEAN DEFAULT false,
        "whatsappError"      TEXT,
        "ejecutadoPor"       TEXT,
        "_createdDate"       TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✅ Tabla EXAM_INTERN_AUDIT asegurada');

    const n = (await c.query(`SELECT COUNT(*)::int total FROM "EXAM_CICLOS"`)).rows[0];
    console.log(`\n🎉 Esquema completo. EXAM_CICLOS: ${n.total} ciclo(s).`);
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
