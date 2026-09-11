#!/usr/bin/env node
/**
 * add-kids-column.js — Agrega PEOPLE.kids (BOOLEAN, default false).
 *
 * Marca a una persona como "kids" (programa/segmento infantil). Columna nueva,
 * nullable=NO con DEFAULT false → todas las filas existentes quedan en false.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto.
 * Gestiona el firewall solo (whitelist tu IP al iniciar, la remueve al salir).
 *
 * USO:
 *   node scripts/add-kids-column.js            # dry-run
 *   node scripts/add-kids-column.js --apply     # crea la columna
 *   node scripts/add-kids-column.js --apply --no-fw
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
    console.log(`\n===== ADD PEOPLE.kids (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

    const exists = (await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='PEOPLE' AND column_name='kids' LIMIT 1`)).rowCount > 0;
    console.log(`Columna kids existe: ${exists ? 'sí' : 'no'}`);

    if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear la columna.`); return; }

    await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "kids" BOOLEAN DEFAULT false`);
    const n = (await c.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE "kids"=true)::int kids FROM "PEOPLE"`)).rows[0];
    console.log(`🟢 Columna lista. PEOPLE: ${n.total} · kids=true: ${n.kids}`);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
