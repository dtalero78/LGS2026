#!/usr/bin/env node
/**
 * Migración idempotente: agrega EXAM_CICLOS."diasEspeciales" (JSONB, default []).
 *
 * Guarda las decisiones por fecha del SetUp Ciclo (Exam. Intern.) sobre festivos
 * y días off: cada entrada = { fecha, tipo:'FESTIVO'|'OFF', accion:'OMITIR'|'MOVER',
 * fechaReemplazo?, motivo? }. Solo se guardan las fechas con decisión != generar.
 *
 * Dry-run por defecto; --apply para ejecutar. Gestiona firewall (whitelist IP →
 * migra → remueve). NUNCA DDL en el request path.
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');

function getPublicIP(){ return new Promise((res,rej)=>{ https.get('https://api.ipify.org',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d.trim()));}).on('error',rej); }); }
const sh = cmd => { try { return execSync(cmd,{stdio:['ignore','pipe','ignore']}).toString(); } catch { return ''; } };
async function fwAdd(ip){ process.stdout.write(`🔓 ${ip}...`); sh(`doctl databases firewalls append ${CLUSTER} --rule ip_addr:${ip}`); await new Promise(r=>setTimeout(r,9000)); console.log(' ok'); }
function fwRemove(ip){ const l=sh(`doctl databases firewalls list ${CLUSTER}`); const u=l.split('\n').find(x=>x.includes(ip))?.trim().split(/\s+/)[0]; if(u){ sh(`doctl databases firewalls remove ${CLUSTER} --uuid ${u}`); console.log(`🔒 ${ip} removida`);} }

(async () => {
  let ip=null;
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:15000 });
  try {
    ip = await getPublicIP(); await fwAdd(ip);
    await c.connect();

    const exists = (await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='EXAM_CICLOS' AND column_name='diasEspeciales'`
    )).rows.length > 0;
    console.log(`Columna "diasEspeciales": ${exists ? 'YA EXISTE' : 'FALTA'}`);

    if (!APPLY) { console.log('\n[dry-run] usa --apply para crear la columna.'); return; }
    if (exists) { console.log('Nada que hacer.'); return; }

    await c.query(`ALTER TABLE "EXAM_CICLOS" ADD COLUMN IF NOT EXISTS "diasEspeciales" JSONB DEFAULT '[]'::jsonb`);
    await c.query(`UPDATE "EXAM_CICLOS" SET "diasEspeciales"='[]'::jsonb WHERE "diasEspeciales" IS NULL`);
    console.log('✅ Columna "diasEspeciales" creada (default []).');
  } catch (e) { console.error('❌ ERROR:', e.message); process.exitCode = 1; }
  finally { try { await c.end(); } catch {}; if (ip) fwRemove(ip); }
})();
