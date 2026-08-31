#!/usr/bin/env node
/**
 * add-kids-inscripciones-aprobado-cols.js — agrega a KIDS_INSCRIPCIONES la marca
 * de aprobación local en LGS (independiente de la reserva en KIDS2026):
 *   aprobado      (BOOLEAN default false) — el beneficiario kid fue aprobado en LGS
 *   fechaAprobado (TIMESTAMPTZ)           — cuándo se aprobó
 *
 * Distinto de `aprobadoEnKids` (que es la aprobación de la reserva en KIDS2026).
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto. Gestiona el firewall solo.
 * USO: node scripts/add-kids-inscripciones-aprobado-cols.js [--apply] [--no-fw]
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');
const NO_FW = process.argv.includes('--no-fw');
const COLS = [
  ['aprobado', 'BOOLEAN DEFAULT false'],
  ['fechaAprobado', 'TIMESTAMPTZ'],
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
    console.log(`\n===== add-kids-inscripciones-aprobado-cols (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

    const names = COLS.map(x => x[0]);
    const existing = new Set((await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='KIDS_INSCRIPCIONES' AND column_name = ANY($1)`, [names])).rows.map(r => r.column_name));
    const faltan = COLS.filter(x => !existing.has(x[0]));
    console.log(`Existen: ${[...existing].join(', ') || '(ninguna)'}`);
    console.log(`Faltan : ${faltan.map(x => x[0]).join(', ') || '(ninguna)'}`);

    if (!faltan.length) { console.log('\n✅ Nada que hacer, las columnas ya existen.'); return; }
    if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear: ${faltan.map(x => x[0]).join(', ')}`); return; }

    for (const [col, type] of faltan) {
      await c.query(`ALTER TABLE "KIDS_INSCRIPCIONES" ADD COLUMN IF NOT EXISTS "${col}" ${type}`);
      console.log(`  + ${col} (${type})`);
    }
    console.log(`\n🟢 Columnas creadas: ${faltan.map(x => x[0]).join(', ')}`);
  } catch (e) {
    console.error('ERROR:', e.message); process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
