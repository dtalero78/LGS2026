#!/usr/bin/env node
/**
 * add-academica-msg-counts.js — contadores de envío de mensajes por estudiante.
 *
 * Agrega a ACADEMICA 3 contadores (INTEGER DEFAULT 0) que llevan cuántas veces
 * se envió cada mensaje desde el detalle del estudiante:
 *   - msgWelcomeCount     → "Crea Perfil con Welcome"
 *   - msgSoloPerfilCount  → "Crear solo perfil" (noWelcome)
 *   - msgReagendarCount   → "Reagendar Welcome"
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto. Gestiona el firewall solo.
 * USO: node scripts/add-academica-msg-counts.js [--apply] [--no-fw]
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');
const NO_FW = process.argv.includes('--no-fw');
const COLS = [
  ['msgWelcomeCount', 'INTEGER DEFAULT 0'],
  ['msgSoloPerfilCount', 'INTEGER DEFAULT 0'],
  ['msgReagendarCount', 'INTEGER DEFAULT 0'],
];

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
    console.log(`\n===== ACADEMICA msg counters (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);
    const existing = new Set((await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='ACADEMICA'`)).rows.map(r => r.column_name));
    const faltan = COLS.filter(([n]) => !existing.has(n));
    console.log(`Columnas a agregar: ${faltan.length ? faltan.map(x => x[0]).join(', ') : '(ninguna, ya existen)'}`);
    if (!APPLY) { console.log(`\n[dry-run] usa --apply para agregarlas`); return; }
    for (const [name, type] of COLS) {
      await c.query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
    }
    console.log(`🟢 Listo. ${COLS.length} contadores asegurados.`);
  } catch (e) {
    console.error('ERROR:', e.message); process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
