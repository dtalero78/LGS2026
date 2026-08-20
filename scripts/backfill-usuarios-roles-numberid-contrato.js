#!/usr/bin/env node
/**
 * backfill-usuarios-roles-numberid-contrato.js
 *
 * Rellena en USUARIOS_ROLES (solo rol ESTUDIANTE) los campos `numberid`
 * (= numeroId) y `contrato` a partir de ACADEMICA, emparejando por email
 * (LOWER(TRIM(email)) — la misma llave que usa el resto del sistema).
 *
 * Reglas:
 *   - Solo rellena lo que está VACÍO (COALESCE): nunca pisa un valor existente
 *     → idempotente, re-correr no cambia nada.
 *   - Si un email tiene duplicados en ACADEMICA, prefiere el BENEFICIARIO
 *     (mismo criterio que login / JOIN ACADEMICA-PEOPLE del proyecto).
 *   - Solo toca filas donde realmente hay algo que rellenar.
 *
 * Idempotente. Dry-run por defecto (muestra cuántas filas se actualizarían).
 * Gestiona el firewall solo (whitelist tu IP al iniciar, la remueve al salir).
 *
 * USO:
 *   node scripts/backfill-usuarios-roles-numberid-contrato.js           # dry-run
 *   node scripts/backfill-usuarios-roles-numberid-contrato.js --apply    # aplica
 *   node scripts/backfill-usuarios-roles-numberid-contrato.js --apply --no-fw
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');
const NO_FW = process.argv.includes('--no-fw');

// ACADEMICA colapsada a 1 fila por email (prefiere BENEFICIARIO ante duplicados).
const ACAD_CTE = `
  WITH acad AS (
    SELECT DISTINCT ON (LOWER(TRIM("email"))) LOWER(TRIM("email")) AS em,
           NULLIF(TRIM("numeroId"),'') AS num, NULLIF(TRIM("contrato"),'') AS con
    FROM "ACADEMICA"
    WHERE "email" IS NOT NULL AND TRIM("email") <> ''
    ORDER BY LOWER(TRIM("email")), ("tipoUsuario"='BENEFICIARIO') DESC
  )`;

// Condición: estudiante con al menos un campo vacío que ACADEMICA sí puede rellenar.
const FILL = `
    ur."rol" = 'ESTUDIANTE'
    AND (
      ((ur."numberid" IS NULL OR TRIM(ur."numberid")='') AND ac.num IS NOT NULL)
      OR ((ur."contrato" IS NULL OR TRIM(ur."contrato")='') AND ac.con IS NOT NULL)
    )`;

const DRY_SQL = `${ACAD_CTE}
  SELECT
    COUNT(*)::int AS filas_a_actualizar,
    COUNT(*) FILTER (WHERE (ur."numberid" IS NULL OR TRIM(ur."numberid")='') AND ac.num IS NOT NULL)::int AS numberid_a_llenar,
    COUNT(*) FILTER (WHERE (ur."contrato" IS NULL OR TRIM(ur."contrato")='') AND ac.con IS NOT NULL)::int AS contrato_a_llenar
  FROM "USUARIOS_ROLES" ur
  JOIN acad ac ON ac.em = LOWER(TRIM(ur."email"))
  WHERE ${FILL}`;

const UPDATE_SQL = `${ACAD_CTE}
  UPDATE "USUARIOS_ROLES" ur
  SET "numberid"     = COALESCE(NULLIF(TRIM(ur."numberid"),''), ac.num),
      "contrato"     = COALESCE(NULLIF(TRIM(ur."contrato"),''), ac.con),
      "_updatedDate" = NOW()
  FROM acad ac
  WHERE ac.em = LOWER(TRIM(ur."email")) AND ${FILL}`;

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
    console.log(`\n===== BACKFILL USUARIOS_ROLES numberid/contrato (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

    const d = (await c.query(DRY_SQL)).rows[0];
    console.log(`Filas ESTUDIANTE a actualizar: ${d.filas_a_actualizar}`);
    console.log(`  · numberid a rellenar: ${d.numberid_a_llenar}`);
    console.log(`  · contrato a rellenar: ${d.contrato_a_llenar}`);

    if (!APPLY) { console.log(`\n[dry-run] usa --apply para escribir (solo rellena campos vacíos, no pisa nada).`); return; }

    await c.query('BEGIN');
    const r = await c.query(UPDATE_SQL);
    await c.query('COMMIT');
    console.log(`\n🟢 Aplicado. Filas actualizadas: ${r.rowCount}`);
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch {}
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
