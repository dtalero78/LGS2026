/**
 * regenerate-contratos-vacios.js
 *
 * Regenera el PDF de los contratos cuyo PDF ARCHIVADO quedó SIN valores
 * financieros. Causa: entre 2026-02-24 y 2026-05-26 el generador buscaba
 * FINANCIEROS por `titularId` (columna NULL) en vez de por `contrato`, así que
 * el PDF se archivó con los placeholders financieros vacíos. `download-pdf` sirve
 * ese archivo estático (no regenera), por eso se sigue descargando vacío aunque
 * la BD ya tenga los valores. La solución es regenerar (sobreescribe el archivo
 * en Drive con los datos actuales, ya leídos por `contrato`).
 *
 * La regeneración corre en PRODUCCIÓN vía POST /api/contracts/{titularId}/regenerate-drive
 * porque las credenciales de Drive (GOOGLE_SERVICE_ACCOUNT_JSON) solo viven allí.
 * Se autentica con la cookie de sesión de un usuario con GENERAR_CONTRATO / SUPER_ADMIN.
 *
 * Uso:
 *   node scripts/regenerate-contratos-vacios.js                         # dry-run: lista candidatos
 *   node scripts/regenerate-contratos-vacios.js --only=01-15222-26      # dry-run de un solo contrato
 *   SESSION_COOKIE='...' node scripts/regenerate-contratos-vacios.js --only=01-15222-26 --apply   # regenera UNO
 *   SESSION_COOKIE='...' node scripts/regenerate-contratos-vacios.js --apply --limit=50            # regenera un lote
 *
 * Env:
 *   DATABASE_URL    (de .env.local) — para listar candidatos.
 *   SESSION_COOKIE  — cookie NextAuth completa, p.ej.
 *                     '__Secure-next-auth.session-token=eyJ...'  (solo para --apply).
 *                     La sacás del navegador (F12 → Application → Cookies → lgs-plataforma.com).
 *   BASE_URL        — default https://lgs-plataforma.com
 *   DELAY_MS        — default 1500 (pausa entre regeneraciones, para no saturar API2PDF)
 *   BEFORE          — default 2026-05-26 (fecha del fix; candidatos con _createdDate anterior)
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { execSync } = require('child_process');

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const BASE_URL = (process.env.BASE_URL || 'https://lgs-plataforma.com').replace(/\/$/, '');
const DELAY_MS = Number(process.env.DELAY_MS || 1500);
const BEFORE = process.env.BEFORE || '2026-05-26';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const NO_FW = args.includes('--no-fw');
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
const limit = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);

function sh(cmd) { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function whitelist() {
  if (NO_FW) return null;
  const ip = sh('curl -s https://api.ipify.org');
  if (!ip) { console.warn('⚠️ no pude obtener IP pública; corré con --no-fw si ya estás whitelisteado'); return null; }
  sh(`doctl databases firewalls append ${CLUSTER} --rule ip_addr:${ip}`);
  await sleep(9000);
  return ip;
}
function unwhitelist(ip) {
  if (!ip) return;
  const list = sh(`doctl databases firewalls list ${CLUSTER}`);
  list.split('\n').forEach((l) => { if (l.includes(ip)) { const id = l.trim().split(/\s+/)[0]; if (id) sh(`doctl databases firewalls remove ${CLUSTER} --uuid ${id}`); } });
}

async function getCandidates() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const where = [
      `p."tipoUsuario" = 'TITULAR'`,
      `p."driveFileId" IS NOT NULL`,
      `COALESCE(p."contrato",'') NOT LIKE 'PRB-%'`,
      `COALESCE(f."totalPlan",'') <> ''`,
    ];
    const params = [];
    if (only) { params.push(only); where.push(`p."contrato" = $${params.length}`); }
    else { params.push(BEFORE); where.push(`p."_createdDate" < $${params.length}::timestamp`); }
    const sql =
      `SELECT p."_id", p."contrato", p."plataforma",
              p."primerNombre"||' '||p."primerApellido" AS nombre,
              p."_createdDate", f."totalPlan"
         FROM "PEOPLE" p
         JOIN "FINANCIEROS" f ON f."contrato" = p."contrato"
        WHERE ${where.join(' AND ')}
        ORDER BY p."_createdDate" ASC` + (limit > 0 ? ` LIMIT ${limit}` : '');
    const { rows } = await client.query(sql, params);
    return rows;
  } finally { await client.end(); }
}

async function regenerate(titularId) {
  const cookie = process.env.SESSION_COOKIE;
  if (!cookie) throw new Error('Falta SESSION_COOKIE para --apply');
  const res = await fetch(`${BASE_URL}/api/contracts/${titularId}/regenerate-drive`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok || !(json && (json.success || json.pdfUrl))) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

(async () => {
  let ip = null;
  let candidates;
  try { ip = await whitelist(); candidates = await getCandidates(); }
  finally { unwhitelist(ip); }

  console.log(`\nCandidatos: ${candidates.length}  (driveFileId + FINANCIEROS con valores${only ? `, contrato ${only}` : `, _createdDate < ${BEFORE}`}${limit ? `, limit ${limit}` : ''})`);
  candidates.slice(0, 15).forEach((r) => console.log(`  ${r.contrato}  ${r.nombre}  [${r.plataforma}]  total=${r.totalPlan}  ${new Date(r._createdDate).toISOString().slice(0, 10)}`));
  if (candidates.length > 15) console.log(`  … y ${candidates.length - 15} más`);

  if (!APPLY) {
    console.log('\n(DRY-RUN) No se regeneró nada. Agregá --apply (con SESSION_COOKIE) para ejecutar en prod.\n');
    return;
  }
  if (!process.env.SESSION_COOKIE) { console.error('\n❌ Falta SESSION_COOKIE para --apply.\n'); process.exit(1); }

  console.log(`\n🚀 Regenerando en ${BASE_URL} … (pausa ${DELAY_MS}ms entre cada uno)\n`);
  let ok = 0, fail = 0;
  for (const r of candidates) {
    try { await regenerate(r._id); ok++; console.log(`  ✅ ${r.contrato}  ${r.nombre}`); }
    catch (e) { fail++; console.log(`  ❌ ${r.contrato}  ${r.nombre} — ${e.message}`); }
    await sleep(DELAY_MS);
  }
  console.log(`\nListo. OK=${ok}  FALLIDOS=${fail}  de ${candidates.length}.\n`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
