#!/usr/bin/env node
/**
 * create-kids-inscripciones-table.js — Crea la tabla KIDS_INSCRIPCIONES.
 *
 * Guarda la inscripción "kids" de un beneficiario capturada en el wizard de
 * Crear Contrato (switch Kids → modal): datos de curso (campaña/tipo/horario,
 * catálogo de KIDS2026 — por ahora texto) + apoderado. `contrato` es el N° de
 * contrato LGS, que será el `external_ref` al enviar el alta a KIDS2026 (intake).
 * Los flags `enviadoAKids`/`kidsExternalRef`/`fechaEnvioKids` quedan preparados
 * para esa integración, hoy inactiva (KIDS2026 aún no disponible).
 *
 * Idempotente (CREATE TABLE / INDEX IF NOT EXISTS). Dry-run por defecto.
 * Gestiona el firewall solo.
 *
 * USO:
 *   node scripts/create-kids-inscripciones-table.js            # dry-run
 *   node scripts/create-kids-inscripciones-table.js --apply     # crea
 *   node scripts/create-kids-inscripciones-table.js --apply --no-fw
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
    console.log(`\n===== CREATE KIDS_INSCRIPCIONES (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

    const exists = (await c.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='KIDS_INSCRIPCIONES' LIMIT 1`)).rowCount > 0;
    console.log(`Tabla KIDS_INSCRIPCIONES existe: ${exists ? 'sí' : 'no'}`);

    if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear la tabla.`); return; }

    await c.query(`
      CREATE TABLE IF NOT EXISTS "KIDS_INSCRIPCIONES" (
        "_id"               VARCHAR(255) PRIMARY KEY,
        "contrato"          VARCHAR(255),          -- N° de contrato LGS (external_ref hacia KIDS2026)
        "beneficiarioId"    VARCHAR(255),          -- PEOPLE._id del beneficiario
        "numeroId"          VARCHAR(50),
        "nombre"            VARCHAR(255),           -- snapshot del nombre del beneficiario
        "campaign"          VARCHAR(255),           -- catálogo KIDS2026 (texto hasta conectar)
        "tipoCurso"         VARCHAR(30),            -- JUNIOR / YOUNGSTER
        "horario"           VARCHAR(255),
        "apoderado"         VARCHAR(255),
        "apoderadoTelefono" VARCHAR(50),
        "apoderadoMail"     VARCHAR(255),
        "enviadoAKids"      BOOLEAN DEFAULT false,  -- intake a KIDS2026 (hoy inactivo)
        "kidsExternalRef"   VARCHAR(255),
        "fechaEnvioKids"    TIMESTAMPTZ,
        "_createdDate"      TIMESTAMPTZ DEFAULT NOW(),
        "_updatedDate"      TIMESTAMPTZ DEFAULT NOW()
      )`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_kids_insc_contrato ON "KIDS_INSCRIPCIONES" ("contrato")`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_kids_insc_beneficiario ON "KIDS_INSCRIPCIONES" ("beneficiarioId")`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_kids_insc_numeroid ON "KIDS_INSCRIPCIONES" ("numeroId")`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_kids_insc_pendiente ON "KIDS_INSCRIPCIONES" ("enviadoAKids") WHERE "enviadoAKids" = false`);

    const n = (await c.query(`SELECT COUNT(*)::int total FROM "KIDS_INSCRIPCIONES"`)).rows[0];
    console.log(`🟢 Tabla lista. Filas: ${n.total}`);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
