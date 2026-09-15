#!/usr/bin/env node
/**
 * add-banco-pagos-titulares.js — Agrega PAGOS_TITULARES.banco (VARCHAR 80).
 *
 * Banco del pago (capturado en Registrar Pago o extraído del recibo). Columna
 * nullable → todas las filas existentes quedan en NULL. Idempotente. Dry-run.
 *
 * USO:
 *   node scripts/add-banco-pagos-titulares.js            # dry-run
 *   node scripts/add-banco-pagos-titulares.js --apply
 *   node scripts/add-banco-pagos-titulares.js --apply --no-fw
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');
const NO_FW = process.argv.includes('--no-fw');

function getPublicIP() { return new Promise((res, rej) => { https.get('https://api.ipify.org', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d.trim())); }).on('error', rej); }); }
const sh = cmd => { try { return execSync(cmd, { stdio:['ignore','pipe','ignore'] }).toString(); } catch { return ''; } };
async function fwAdd(ip){ process.stdout.write(`🔓 ${ip}...`); sh(`doctl databases firewalls append ${CLUSTER} --rule ip_addr:${ip}`); await new Promise(r=>setTimeout(r,9000)); console.log(' ok'); }
function fwRemove(ip){ const l=sh(`doctl databases firewalls list ${CLUSTER}`); const u=l.split('\n').find(x=>x.includes(ip))?.trim().split(/\s+/)[0]; if(u){ sh(`doctl databases firewalls remove ${CLUSTER} --uuid ${u}`); console.log(`🔒 ${ip} removida`);} }

(async () => {
  let ip=null;
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:15000 });
  try {
    if (!NO_FW) { ip = await getPublicIP(); await fwAdd(ip); }
    await c.connect();
    const exists = (await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='PAGOS_TITULARES' AND column_name='banco' LIMIT 1`)).rowCount > 0;
    console.log(`\nColumna PAGOS_TITULARES.banco: ${exists ? '✅ existe' : '❌ falta'} (${APPLY ? 'APPLY' : 'DRY-RUN'})`);
    if (!APPLY) { console.log('[dry-run] usa --apply.'); return; }
    await c.query(`ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "banco" VARCHAR(80)`);
    console.log('🟢 Columna banco lista.');
  } catch (e) { console.error('❌ ERROR:', e.message); process.exitCode = 1; }
  finally { try { await c.end(); } catch {}; if (ip) fwRemove(ip); }
})();
