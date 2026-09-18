#!/usr/bin/env node
/**
 * Migración idempotente para "Subir recibo inscripción" (proceso de contrato):
 *   1. PEOPLE."reciboInscripcion" JSONB (nullable) — recibo de inscripción del
 *      contrato, INDEPENDIENTE de PEOPLE."documentacion". Guarda el archivo +
 *      metadatos + el snapshot extraído por IA.
 *   2. Permiso COMERCIAL.CONTRATO.SUBIR_RECIBO en ROL_PERMISOS (COMERCIAL,
 *      ADMIN, SUPER_ADMIN) para gatear el botón/endpoint.
 *
 * Dry-run por defecto; --apply para ejecutar. Firewall gestionado. NUNCA DDL en
 * el request path.
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');
const PERM = 'COMERCIAL.CONTRATO.SUBIR_RECIBO';
const ROLES = ['COMERCIAL', 'ADMIN', 'SUPER_ADMIN'];

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

    // 1. Columna PEOPLE.reciboInscripcion
    const hasCol = (await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='PEOPLE' AND column_name='reciboInscripcion'`
    )).rows.length > 0;
    console.log(`Columna PEOPLE."reciboInscripcion": ${hasCol ? 'YA EXISTE' : 'FALTA'}`);

    // 2. Permiso por rol
    const rolRows = (await c.query(
      `SELECT "rol", "permisos" FROM "ROL_PERMISOS" WHERE "rol" = ANY($1)`, [ROLES]
    )).rows;
    for (const r of rolRows) {
      const arr = Array.isArray(r.permisos) ? r.permisos : [];
      console.log(`  ${r.rol}: permiso ${PERM} ${arr.includes(PERM) ? 'YA presente' : 'FALTA (se agregará)'}`);
    }

    if (!APPLY) { console.log('\n[dry-run] usa --apply para ejecutar.'); return; }

    if (!hasCol) {
      await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "reciboInscripcion" JSONB`);
      console.log('✅ Columna PEOPLE."reciboInscripcion" creada.');
    }
    for (const r of rolRows) {
      const arr = Array.isArray(r.permisos) ? r.permisos : [];
      if (!arr.includes(PERM)) {
        await c.query(
          `UPDATE "ROL_PERMISOS" SET "permisos" = COALESCE("permisos",'[]'::jsonb) || $1::jsonb WHERE "rol" = $2`,
          [JSON.stringify([PERM]), r.rol]
        );
        console.log(`✅ ${r.rol}: permiso ${PERM} agregado.`);
      }
    }
    console.log('Listo.');
  } catch (e) { console.error('❌ ERROR:', e.message); process.exitCode = 1; }
  finally { try { await c.end(); } catch {}; if (ip) fwRemove(ip); }
})();
