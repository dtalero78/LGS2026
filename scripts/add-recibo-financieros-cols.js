#!/usr/bin/env node
/**
 * add-recibo-financieros-cols.js — "Leer recibo" de inscripciones.
 *
 * Agrega a FINANCIEROS las columnas donde queda la información EXTRAÍDA del
 * recibo de inscripción (leído por IA). Las consultas leen de aquí.
 *   - reciboUrl        TEXT          (archivo en DO Spaces)
 *   - reciboMedioPago  VARCHAR(60)   (WebPay/Nequi/Transferencia/…)
 *   - reciboFecha      DATE
 *   - reciboMonto      NUMERIC(14,2)
 *   - reciboReferencia VARCHAR(120)
 *   - reciboBanco      VARCHAR(80)
 *   - reciboExtraido   JSONB         (extracción completa + confianza + autor/fecha)
 *
 * + seed del flag APP_CONFIG.leer_recibo_activo = 'false' (default OFF).
 *
 * Columnas nullable (ADD COLUMN IF NOT EXISTS) → sin reescritura de tabla.
 * Idempotente. Dry-run por defecto. Maneja el firewall solo.
 *
 * USO:
 *   node scripts/add-recibo-financieros-cols.js            # dry-run
 *   node scripts/add-recibo-financieros-cols.js --apply
 *   node scripts/add-recibo-financieros-cols.js --apply --no-fw
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

const COLS = [
  ['reciboUrl',        'TEXT'],
  ['reciboMedioPago',  'VARCHAR(60)'],
  ['reciboFecha',      'DATE'],
  ['reciboMonto',      'NUMERIC(14,2)'],
  ['reciboReferencia', 'VARCHAR(120)'],
  ['reciboBanco',      'VARCHAR(80)'],
  ['reciboExtraido',   'JSONB'],
];

(async () => {
  let ip=null;
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:15000 });
  try {
    if (!NO_FW) { ip = await getPublicIP(); await fwAdd(ip); }
    await c.connect();
    console.log(`\n===== FINANCIEROS recibo cols (${APPLY?'APPLY':'DRY-RUN'}) =====`);

    const existing = (await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='FINANCIEROS' AND column_name = ANY($1)`,
      [COLS.map(x=>x[0])]
    )).rows.map(r => r.column_name);
    for (const [name, type] of COLS) {
      console.log(`  ${existing.includes(name) ? '✅' : '❌'} ${name} ${type}`);
    }
    const flag = (await c.query(`SELECT "value" FROM "APP_CONFIG" WHERE "key"='leer_recibo_activo'`)).rows[0];
    console.log(`  Flag leer_recibo_activo: ${flag ? `'${flag.value}'` : '❌ falta'}`);

    if (!APPLY) { console.log('\n[dry-run] usa --apply para aplicar.'); return; }

    console.log('\n🔴 Aplicando...\n');
    for (const [name, type] of COLS) {
      await c.query(`ALTER TABLE "FINANCIEROS" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
    }
    console.log(`  ✅ ${COLS.length} columnas listas en FINANCIEROS`);
    await c.query(
      `INSERT INTO "APP_CONFIG" ("key","value","color","updatedBy","_updatedDate")
       VALUES ('leer_recibo_activo','false','#ffffff','migration',NOW())
       ON CONFLICT ("key") DO NOTHING`
    );
    console.log('  ✅ Flag leer_recibo_activo seteado (default false)');
    console.log('\n🎉 Listo.');
  } catch (e) {
    console.error('❌ ERROR:', e.message); process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
