#!/usr/bin/env node
/* Migración idempotente: CALENDARIO."horaFin" (VARCHAR "HH:mm") y
   CALENDARIO."duracionMin" (INTEGER) — para reflejar la duración (1 o 2 horas)
   de las sesiones de Exam. Intern. generadas desde las franjas del ciclo.
   Dry-run por defecto; --apply. NUNCA DDL en el request path. */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });
const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');
function getIP(){ return new Promise((r,j)=>{ https.get('https://api.ipify.org',x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(d.trim()));}).on('error',j); }); }
const sh=c=>{try{return execSync(c,{stdio:['ignore','pipe','ignore']}).toString();}catch{return'';}};
async function fwAdd(ip){process.stdout.write(`🔓 ${ip}...`);sh(`doctl databases firewalls append ${CLUSTER} --rule ip_addr:${ip}`);await new Promise(r=>setTimeout(r,9000));console.log(' ok');}
function fwDel(ip){const l=sh(`doctl databases firewalls list ${CLUSTER}`);const u=l.split('\n').find(x=>x.includes(ip))?.trim().split(/\s+/)[0];if(u)sh(`doctl databases firewalls remove ${CLUSTER} --uuid ${u}`);}
(async()=>{let ip=null;const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''),ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000});
try{
  ip=await getIP();await fwAdd(ip);await c.connect();
  const has=n=>c.query(`SELECT 1 FROM information_schema.columns WHERE table_name='CALENDARIO' AND column_name=$1`,[n]).then(r=>r.rows.length>0);
  const hf=await has('horaFin'), dm=await has('duracionMin');
  console.log(`CALENDARIO."horaFin": ${hf?'YA EXISTE':'FALTA'} · "duracionMin": ${dm?'YA EXISTE':'FALTA'}`);
  if(!APPLY){console.log('\n[dry-run] usa --apply.');return;}
  if(!hf) await c.query(`ALTER TABLE "CALENDARIO" ADD COLUMN IF NOT EXISTS "horaFin" VARCHAR`);
  if(!dm) await c.query(`ALTER TABLE "CALENDARIO" ADD COLUMN IF NOT EXISTS "duracionMin" INTEGER`);
  console.log('✅ Columnas aseguradas.');
}catch(e){console.error('❌ ERROR:',e.message);process.exitCode=1;}
finally{try{await c.end();}catch{};if(ip)fwDel(ip);}
})();
