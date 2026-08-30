#!/usr/bin/env node
/**
 * add-kids-inscripciones-integracion-cols.js
 *
 * Columnas para la integración LGS → KIDS2026 sobre KIDS_INSCRIPCIONES:
 *   - salón elegido del catálogo: classroomId, salonNombre
 *   - apoderado tercero: apoderadoApellidos, apoderadoDoc, parentesco
 *   - ids devueltos por KIDS al reservar: kidsContractId, kidsEnrollmentId
 *   - aprobación en KIDS: aprobadoEnKids, fechaAprobacionKids
 *   - credenciales del alumno (guardar + mostrar): kidsUserId, kidsUsername, kidsPassword
 *   - diagnóstico: errorKids (último error de envío/aprobación, best-effort)
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto. Gestiona el firewall solo.
 * USO: node scripts/add-kids-inscripciones-integracion-cols.js [--apply] [--no-fw]
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

const COLS = [
  ['classroomId', 'VARCHAR(255)'],
  ['salonNombre', 'VARCHAR(255)'],
  ['apoderadoApellidos', 'VARCHAR(255)'],
  ['apoderadoDoc', 'VARCHAR(50)'],
  ['parentesco', 'VARCHAR(60)'],
  ['kidsContractId', 'VARCHAR(255)'],
  ['kidsEnrollmentId', 'VARCHAR(255)'],
  ['aprobadoEnKids', 'BOOLEAN DEFAULT false'],
  ['fechaAprobacionKids', 'TIMESTAMPTZ'],
  ['kidsUserId', 'VARCHAR(255)'],
  ['kidsUsername', 'VARCHAR(255)'],
  ['kidsPassword', 'VARCHAR(255)'],
  ['errorKids', 'TEXT'],
];

(async () => {
  let ip = null;
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    if (!NO_FW) { ip = await getPublicIP(); await fwAdd(ip); }
    await c.connect();
    console.log(`\n===== KIDS_INSCRIPCIONES cols integración (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

    const existing = new Set((await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='KIDS_INSCRIPCIONES'`)).rows.map(r => r.column_name));
    const faltan = COLS.filter(([n]) => !existing.has(n));
    console.log(`Columnas a agregar: ${faltan.length ? faltan.map(c => c[0]).join(', ') : '(ninguna, ya existen)'}`);

    if (!APPLY) { console.log(`\n[dry-run] usa --apply para agregarlas`); return; }

    for (const [name, type] of COLS) {
      await c.query(`ALTER TABLE "KIDS_INSCRIPCIONES" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
    }
    console.log(`🟢 Listo. ${COLS.length} columnas aseguradas.`);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
